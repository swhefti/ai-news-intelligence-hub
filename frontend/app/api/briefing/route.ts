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

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  compact: "Provide 3-5 sentences hitting only the biggest headlines.",
  brief: "Provide 5-10 sentences covering the main stories.",
  standard: "Provide 10-15 sentences with key context for each story.",
  extended:
    "Provide 15-25 sentences organized in paragraphs with analysis.",
  detailed:
    "Provide 35-50 sentences organized in paragraphs with comprehensive coverage and analysis.",
};

const VALID_DAYS = [1, 2, 3, 5, 7, 10, 14];
const VALID_LENGTHS = Object.keys(LENGTH_INSTRUCTIONS);

export async function POST(request: NextRequest) {
  try {
    const { supabase, anthropic } = getClients();
    const body = await request.json();

    const days = VALID_DAYS.includes(body.days) ? body.days : 2;
    const length = VALID_LENGTHS.includes(body.length)
      ? body.length
      : "standard";

    // Step 1: Get recent articles within the time range
    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: articles, error: articlesError } = await supabase
      .from("articles")
      .select("id, title, url, source_name, source_category, published_at")
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false });

    if (articlesError) {
      console.error("Briefing articles error:", articlesError);
      return NextResponse.json(
        { error: "Failed to fetch articles" },
        { status: 500 }
      );
    }

    const articleCount = articles?.length ?? 0;

    if (articleCount === 0) {
      return NextResponse.json({
        briefing:
          "No articles found in the selected time range. Try expanding the time range or running the ingestion pipeline to fetch new articles.",
        sources: [],
        timeRange: `${days} day${days > 1 ? "s" : ""}`,
        articleCount: 0,
      });
    }

    // Step 2: Get a diverse sample of chunks from these articles
    // Spread across different sources for diversity
    const articleIds = (articles ?? []).map((a) => a.id);

    const { data: chunks, error: chunksError } = await supabase
      .from("chunks")
      .select(
        "text, article_title, article_url, source_name, source_category, published_at"
      )
      .in("article_id", articleIds)
      .order("published_at", { ascending: false })
      .limit(100);

    if (chunksError) {
      console.error("Briefing chunks error:", chunksError);
      return NextResponse.json(
        { error: "Failed to fetch chunks" },
        { status: 500 }
      );
    }

    // Diversify: pick chunks spread across sources
    const chunksBySource = new Map<string, typeof chunks>();
    for (const chunk of chunks ?? []) {
      const existing = chunksBySource.get(chunk.source_name) ?? [];
      existing.push(chunk);
      chunksBySource.set(chunk.source_name, existing);
    }

    const selectedChunks: typeof chunks = [];
    const targetPerSource = Math.max(
      2,
      Math.floor(20 / chunksBySource.size)
    );

    for (const [, sourceChunks] of chunksBySource) {
      selectedChunks.push(...sourceChunks.slice(0, targetPerSource));
    }

    // If we still have room, fill up to 20
    if (selectedChunks.length < 20) {
      const selectedSet = new Set(selectedChunks);
      for (const chunk of chunks ?? []) {
        if (selectedChunks.length >= 20) break;
        if (!selectedSet.has(chunk)) {
          selectedChunks.push(chunk);
          selectedSet.add(chunk);
        }
      }
    }

    // Step 3: Build context
    const context = selectedChunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}: "${chunk.article_title}" - ${chunk.source_name}${chunk.published_at ? ` (${new Date(chunk.published_at).toLocaleDateString()})` : ""}]\n${chunk.text}`
      )
      .join("\n\n---\n\n");

    // Step 4: Generate briefing with Claude
    const lengthInstruction = LENGTH_INSTRUCTIONS[length];

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are an AI news analyst creating a briefing. Summarize the most important AI developments from the provided articles.

Length instruction: ${lengthInstruction}

Structure the briefing by theme (e.g., New Models, Industry Moves, Research, Policy & Safety). Use clear section headings with "##" markdown.

Always cite your sources by referencing [Source N] after the relevant information. Focus on the most significant and interesting developments. Avoid redundancy — if multiple sources cover the same story, mention it once and cite all relevant sources.`,
      messages: [
        {
          role: "user",
          content: `Here are recent AI news articles from the last ${days} day${days > 1 ? "s" : ""}:\n\n${context}\n\n---\n\nGenerate a ${length} briefing summarizing the key AI developments.`,
        },
      ],
    });

    const answerBlock = message.content.find((block) => block.type === "text");
    const briefing = answerBlock ? answerBlock.text : "No briefing generated.";

    // Step 5: Deduplicate sources
    const sourceMap = new Map<
      string,
      { title: string; url: string; source_name: string; published_at: string }
    >();
    for (const chunk of selectedChunks) {
      if (!sourceMap.has(chunk.article_url)) {
        sourceMap.set(chunk.article_url, {
          title: chunk.article_title,
          url: chunk.article_url,
          source_name: chunk.source_name,
          published_at: chunk.published_at,
        });
      }
    }

    return NextResponse.json({
      briefing,
      sources: Array.from(sourceMap.values()),
      timeRange: `${days} day${days > 1 ? "s" : ""}`,
      articleCount,
    });
  } catch (error) {
    console.error("Briefing API error:", error);
    return NextResponse.json(
      { error: "An internal error occurred while generating the briefing" },
      { status: 500 }
    );
  }
}
