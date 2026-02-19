import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

let supabase: SupabaseClient;
let anthropic: Anthropic;

function getClients() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return { supabase, anthropic };
}

const VALID_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 30];

export async function POST(request: NextRequest) {
  try {
    const { supabase, anthropic } = getClients();
    const body = await request.json();

    const days = VALID_DAYS.includes(body.days) ? body.days : 3;
    const keywords: string[] = Array.isArray(body.keywords)
      ? body.keywords
      : [];
    const mode: "simple" | "extended" =
      body.mode === "extended" ? "extended" : "simple";
    const language: "en" | "de" = body.language === "de" ? "de" : "en";

    // Step 1: Get recent articles within the time range
    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    ).toISOString();

    let query = supabase
      .from("articles")
      .select(
        "id, title, url, source_name, source_category, published_at, keywords"
      )
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false });

    // If specific keywords are selected, filter articles that overlap
    if (keywords.length > 0) {
      query = query.overlaps("keywords", keywords);
    }

    const { data: articles, error: articlesError } = await query;

    if (articlesError) {
      console.error("Generate briefing articles error:", articlesError);
      return NextResponse.json(
        { error: "Failed to fetch articles" },
        { status: 500 }
      );
    }

    const articleCount = articles?.length ?? 0;

    if (articleCount === 0) {
      return NextResponse.json({
        briefing:
          "No articles found matching your criteria. Try expanding the time range or adjusting keyword filters.",
        sources: [],
        meta: {
          days,
          mode,
          language,
          articlesAnalyzed: 0,
          keywordsUsed: keywords.length > 0 ? keywords : "all",
        },
      });
    }

    // Step 2: Score and sort articles by keyword relevance if keywords are selected
    let sortedArticles = articles ?? [];
    if (keywords.length > 0) {
      sortedArticles = [...sortedArticles].sort((a, b) => {
        const aMatches = (a.keywords ?? []).filter((k: string) =>
          keywords.includes(k)
        ).length;
        const bMatches = (b.keywords ?? []).filter((k: string) =>
          keywords.includes(k)
        ).length;
        return bMatches - aMatches;
      });
    }

    const articleIds = sortedArticles.map((a) => a.id);

    // Step 3: Get chunks from those articles
    const { data: chunks, error: chunksError } = await supabase
      .from("chunks")
      .select(
        "text, article_id, article_title, article_url, source_name, source_category, published_at"
      )
      .in("article_id", articleIds)
      .order("published_at", { ascending: false })
      .limit(100);

    if (chunksError) {
      console.error("Generate briefing chunks error:", chunksError);
      return NextResponse.json(
        { error: "Failed to fetch chunks" },
        { status: 500 }
      );
    }

    // Diversify chunks across sources, prioritize articles with more keyword matches
    const chunksBySource = new Map<
      string,
      (typeof chunks extends (infer T)[] | null ? T : never)[]
    >();
    for (const chunk of chunks ?? []) {
      const existing = chunksBySource.get(chunk.source_name) ?? [];
      existing.push(chunk);
      chunksBySource.set(chunk.source_name, existing);
    }

    const targetTotal = 25;
    const selectedChunks: typeof chunks = [];
    const targetPerSource = Math.max(
      2,
      Math.floor(targetTotal / chunksBySource.size)
    );

    for (const [, sourceChunks] of chunksBySource) {
      selectedChunks.push(...sourceChunks.slice(0, targetPerSource));
    }

    // Fill up to target
    if (selectedChunks.length < targetTotal) {
      const selectedSet = new Set(selectedChunks);
      for (const chunk of chunks ?? []) {
        if (selectedChunks.length >= targetTotal) break;
        if (!selectedSet.has(chunk)) {
          selectedChunks.push(chunk);
          selectedSet.add(chunk);
        }
      }
    }

    // Step 4: Build context
    const context = selectedChunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}: "${chunk.article_title}" - ${chunk.source_name}${chunk.published_at ? ` (${new Date(chunk.published_at).toLocaleDateString()})` : ""}]\nURL: ${chunk.article_url}\n${chunk.text}`
      )
      .join("\n\n---\n\n");

    // Step 5: Build prompt based on mode
    const languageInstruction =
      language === "de"
        ? `\n\nIMPORTANT: Write the entire briefing in German. Use professional German suitable for a news briefing. Translate all headlines and content to German. Keep source titles in their original language but write everything else in German.`
        : "";

    let systemPrompt: string;
    let maxTopics: number;

    if (mode === "simple") {
      maxTopics = 4;
      systemPrompt = `You are an AI news analyst creating a focused briefing.

STRICT RULES:
- Cover a MAXIMUM of ${maxTopics} of the most important stories/topics
- Fewer is fine if there aren't ${maxTopics} major stories
- Combine related articles into single topics
- Focus only on the most significant and newsworthy developments
- Be concise: 2-3 sentences per topic
- Each topic should have a clear headline

Format:
## [Topic Headline]
[2-3 sentence summary]

Source: [Article title](url)${languageInstruction}`;
    } else {
      maxTopics = 8;
      systemPrompt = `You are an AI news analyst creating a comprehensive briefing.

STRICT RULES:
- Cover a MAXIMUM of ${maxTopics} of the most important stories/topics
- Fewer is fine if there aren't ${maxTopics} major stories
- Combine related articles into single topics
- Provide context and analysis for each topic
- Explain why each development matters
- 4-6 sentences per topic with deeper insight

Format:
## [Topic Headline]
[4-6 sentence summary with context and analysis]

Sources: [Article title](url), [Article title](url)${languageInstruction}`;
    }

    const topicFilter =
      keywords.length > 0
        ? `Focus on topics related to: ${keywords.join(", ")}.`
        : "";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: mode === "extended" ? 3000 : 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here are recent AI news articles from the last ${days} day${days > 1 ? "s" : ""}:\n\n${context}\n\n---\n\nGenerate a ${mode} briefing summarizing the key AI developments. ${topicFilter}`,
        },
      ],
    });

    const answerBlock = message.content.find((block) => block.type === "text");
    const briefing = answerBlock ? answerBlock.text : "No briefing generated.";

    // Step 6: Deduplicate sources
    const sourceMap = new Map<
      string,
      { title: string; url: string; source_name: string }
    >();
    for (const chunk of selectedChunks) {
      if (!sourceMap.has(chunk.article_url)) {
        sourceMap.set(chunk.article_url, {
          title: chunk.article_title,
          url: chunk.article_url,
          source_name: chunk.source_name,
        });
      }
    }

    return NextResponse.json({
      briefing,
      sources: Array.from(sourceMap.values()),
      meta: {
        days,
        mode,
        language,
        articlesAnalyzed: articleCount,
        keywordsUsed: keywords.length > 0 ? keywords : "all",
      },
    });
  } catch (error) {
    console.error("Generate briefing API error:", error);
    return NextResponse.json(
      { error: "An error occurred while generating the briefing" },
      { status: 500 }
    );
  }
}
