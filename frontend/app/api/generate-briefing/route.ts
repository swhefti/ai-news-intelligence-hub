import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { KEYWORD_CATEGORIES } from "@/lib/keyword-categories";

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ChunkRow {
  text: string;
  article_id: string;
  article_title: string;
  article_url: string;
  source_name: string;
  source_category: string;
  published_at: string;
  articles: { keywords: string[] } | null;
}

/* ------------------------------------------------------------------ */
/* Smart Chunk Selection Helpers                                       */
/* ------------------------------------------------------------------ */

/** Dynamic chunk limit based on time range */
function getChunkLimit(days: number): number {
  if (days <= 3) return 30;
  if (days <= 7) return 45;
  if (days <= 14) return 60;
  return 60;
}

/** Cap any single source to at most maxPerSource chunks */
function enforceSourceDiversity(
  chunks: ChunkRow[],
  maxPerSource: number
): ChunkRow[] {
  const sourceCount: Record<string, number> = {};
  return chunks.filter((chunk) => {
    const count = sourceCount[chunk.source_name] || 0;
    if (count >= maxPerSource) return false;
    sourceCount[chunk.source_name] = count + 1;
    return true;
  });
}

/** Determine which category a chunk belongs to based on its article keywords */
function getCategoryForChunk(chunk: ChunkRow): string {
  const articleKeywords = chunk.articles?.keywords ?? [];
  for (const [category, data] of Object.entries(KEYWORD_CATEGORIES)) {
    if (articleKeywords.some((k: string) => data.keywords.includes(k))) {
      return category;
    }
  }
  return "Other";
}

/** Balance chunks evenly across the 4 keyword categories */
function balanceByCategory(
  chunks: ChunkRow[],
  limit: number
): ChunkRow[] {
  const categories = Object.keys(KEYWORD_CATEGORIES);
  const perCategory = Math.floor(limit / categories.length);
  const result: ChunkRow[] = [];

  for (const category of categories) {
    const categoryChunks = chunks.filter(
      (c) => getCategoryForChunk(c) === category
    );
    result.push(...categoryChunks.slice(0, perCategory));
  }

  // Fill remaining slots with any leftover chunks
  const remaining = limit - result.length;
  if (remaining > 0) {
    const usedSet = new Set(
      result.map((c) => `${c.article_id}:${c.text.slice(0, 50)}`)
    );
    const extras = chunks
      .filter(
        (c) => !usedSet.has(`${c.article_id}:${c.text.slice(0, 50)}`)
      )
      .slice(0, remaining);
    result.push(...extras);
  }

  return result;
}

/**
 * Apply recency weighting: split available chunks into time buckets
 * and draw proportionally more from recent buckets.
 */
function applyRecencyWeighting(
  chunks: ChunkRow[],
  days: number,
  limit: number
): ChunkRow[] {
  if (days <= 3) {
    // All from recent — no bucketing needed
    return chunks.slice(0, limit);
  }

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  const cutoff3 = now - 3 * msPerDay;
  const cutoff7 = now - 7 * msPerDay;

  const last3Days = chunks.filter(
    (c) => new Date(c.published_at).getTime() >= cutoff3
  );
  const days4to7 = chunks.filter((c) => {
    const t = new Date(c.published_at).getTime();
    return t < cutoff3 && t >= cutoff7;
  });
  const days8plus = chunks.filter(
    (c) => new Date(c.published_at).getTime() < cutoff7
  );

  let buckets: { chunks: ChunkRow[]; share: number }[];

  if (days <= 7) {
    buckets = [
      { chunks: last3Days, share: 0.6 },
      { chunks: days4to7, share: 0.4 },
    ];
  } else {
    buckets = [
      { chunks: last3Days, share: 0.5 },
      { chunks: days4to7, share: 0.3 },
      { chunks: days8plus, share: 0.2 },
    ];
  }

  const result: ChunkRow[] = [];
  let remaining = limit;

  for (const bucket of buckets) {
    const take = Math.min(
      Math.floor(limit * bucket.share),
      bucket.chunks.length,
      remaining
    );
    result.push(...bucket.chunks.slice(0, take));
    remaining -= take;
  }

  // Fill any shortfall from all buckets in order
  if (remaining > 0) {
    const usedSet = new Set(
      result.map((c) => `${c.article_id}:${c.text.slice(0, 50)}`)
    );
    for (const bucket of buckets) {
      for (const chunk of bucket.chunks) {
        if (remaining <= 0) break;
        const key = `${chunk.article_id}:${chunk.text.slice(0, 50)}`;
        if (!usedSet.has(key)) {
          result.push(chunk);
          usedSet.add(key);
          remaining--;
        }
      }
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Main Smart Chunk Selection                                          */
/* ------------------------------------------------------------------ */

async function getSmartChunks(
  supabase: SupabaseClient,
  days: number,
  selectedKeywords: string[],
  mode: "simple" | "extended"
): Promise<{ chunks: ChunkRow[]; articleCount: number }> {
  const chunkLimit = getChunkLimit(days);
  const maxPerSource = Math.ceil(chunkLimit * 0.2); // 20% max per source

  const cutoff = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();

  // Fetch 3x chunks to have enough headroom for diversity/recency filtering
  const fetchLimit = chunkLimit * 3;

  if (selectedKeywords.length > 0) {
    // ---- KEYWORD-FILTERED PATH ----
    // Get articles matching selected keywords, then fetch their chunks
    const { data: articles, error: articlesError } = await supabase
      .from("articles")
      .select("id, keywords")
      .gte("published_at", cutoff)
      .overlaps("keywords", selectedKeywords);

    if (articlesError || !articles) {
      console.error("Smart chunks: articles query error", articlesError);
      return { chunks: [], articleCount: 0 };
    }

    const articleCount = articles.length;
    if (articleCount === 0) return { chunks: [], articleCount: 0 };

    // Sort articles by keyword match count (richness scoring)
    const sortedArticles = [...articles].sort((a, b) => {
      const aMatches = (a.keywords ?? []).filter((k: string) =>
        selectedKeywords.includes(k)
      ).length;
      const bMatches = (b.keywords ?? []).filter((k: string) =>
        selectedKeywords.includes(k)
      ).length;
      return bMatches - aMatches;
    });

    const articleIds = sortedArticles.map((a) => a.id);

    const { data: rawChunks, error: chunksError } = await supabase
      .from("chunks")
      .select(
        "text, article_id, article_title, article_url, source_name, source_category, published_at, articles!inner(keywords)"
      )
      .in("article_id", articleIds)
      .order("published_at", { ascending: false })
      .limit(fetchLimit);

    if (chunksError || !rawChunks) {
      console.error("Smart chunks: chunks query error", chunksError);
      return { chunks: [], articleCount };
    }

    const chunks = rawChunks as unknown as ChunkRow[];

    // Sort by keyword richness (articles with more matching keywords first), then recency
    chunks.sort((a, b) => {
      const aKws = (a.articles?.keywords ?? []).filter((k: string) =>
        selectedKeywords.includes(k)
      ).length;
      const bKws = (b.articles?.keywords ?? []).filter((k: string) =>
        selectedKeywords.includes(k)
      ).length;
      if (bKws !== aKws) return bKws - aKws;
      return (
        new Date(b.published_at).getTime() -
        new Date(a.published_at).getTime()
      );
    });

    // Apply source diversity
    const diverse = enforceSourceDiversity(chunks, maxPerSource);

    // Apply recency weighting
    const recencyWeighted = applyRecencyWeighting(diverse, days, chunkLimit);

    return { chunks: recencyWeighted, articleCount };
  } else {
    // ---- ALL-TOPICS PATH ----
    // Fetch a broad set of chunks, then balance by category

    // First get article count
    const { count: articleCount, error: countError } = await supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .gte("published_at", cutoff);

    if (countError) {
      console.error("Smart chunks: count error", countError);
    }

    const { data: rawChunks, error: chunksError } = await supabase
      .from("chunks")
      .select(
        "text, article_id, article_title, article_url, source_name, source_category, published_at, articles!inner(keywords)"
      )
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false })
      .limit(fetchLimit);

    if (chunksError || !rawChunks) {
      console.error("Smart chunks: all-topics query error", chunksError);
      return { chunks: [], articleCount: articleCount ?? 0 };
    }

    const chunks = rawChunks as unknown as ChunkRow[];

    // Sort by keyword richness (more keywords = higher signal), then recency
    chunks.sort((a, b) => {
      const aLen = (a.articles?.keywords ?? []).length;
      const bLen = (b.articles?.keywords ?? []).length;
      if (bLen !== aLen) return bLen - aLen;
      return (
        new Date(b.published_at).getTime() -
        new Date(a.published_at).getTime()
      );
    });

    // Apply source diversity
    const diverse = enforceSourceDiversity(chunks, maxPerSource);

    // Apply recency weighting
    const recencyWeighted = applyRecencyWeighting(diverse, days, chunkLimit);

    // Balance across categories
    const balanced = balanceByCategory(recencyWeighted, chunkLimit);

    return { chunks: balanced, articleCount: articleCount ?? 0 };
  }
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const VALID_DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 21, 30];

/* ------------------------------------------------------------------ */
/* POST Handler                                                        */
/* ------------------------------------------------------------------ */

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

    // ---- Smart chunk selection ----
    const { chunks: selectedChunks, articleCount } = await getSmartChunks(
      supabase,
      days,
      keywords,
      mode
    );

    if (selectedChunks.length === 0) {
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

    // ---- Logging ----
    const sourcesRepresented = [
      ...new Set(selectedChunks.map((c) => c.source_name)),
    ];
    const categoriesRepresented = [
      ...new Set(selectedChunks.map((c) => getCategoryForChunk(c))),
    ];
    console.log(
      `Briefing generation stats:\n` +
        `  - Time range: ${days} days\n` +
        `  - Chunk limit: ${getChunkLimit(days)}\n` +
        `  - Selected keywords: ${keywords.length ? keywords.join(", ") : "all"}\n` +
        `  - Articles in range: ${articleCount}\n` +
        `  - Final chunks sent to Claude: ${selectedChunks.length}\n` +
        `  - Sources represented (${sourcesRepresented.length}): ${sourcesRepresented.join(", ")}\n` +
        `  - Categories represented: ${categoriesRepresented.join(", ")}`
    );

    // ---- Build context ----
    const context = selectedChunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}: "${chunk.article_title}" - ${chunk.source_name}${chunk.published_at ? ` (${new Date(chunk.published_at).toLocaleDateString()})` : ""}]\nURL: ${chunk.article_url}\n${chunk.text}`
      )
      .join("\n\n---\n\n");

    // ---- Build prompt ----
    const languageInstruction =
      language === "de"
        ? `\n\nIMPORTANT: Write the entire briefing in German. Use professional German suitable for a news briefing. Translate all headlines and content to German. Keep source titles in their original language but write everything else in German.`
        : "";

    let systemPrompt: string;
    let maxTopics: number;

    if (mode === "simple") {
      maxTopics = 4;
      systemPrompt = `You are an AI news analyst creating a focused briefing.

You have been given a diverse selection of article chunks covering:
- Multiple AI companies and models
- Technical developments
- Industry applications
- Societal implications

STRICT RULES:
- Cover a MAXIMUM of ${maxTopics} of the most important stories/topics
- Fewer is fine if there aren't ${maxTopics} major stories
- Prioritize stories that appear across multiple sources (higher signal)
- Prioritize genuinely significant developments over minor updates
- Combine related articles into single topics
- Be concise: 2-3 sentences per topic
- Each topic must cite at least one source

DO NOT:
- Include minor product updates unless truly significant
- Repeat similar stories as separate topics
- Include more than ${maxTopics} topics even if there's more content

Format each topic as:
## [Topic Headline]
[2-3 sentence summary]

Source: [Article title](url)${languageInstruction}`;
    } else {
      maxTopics = 8;
      systemPrompt = `You are an AI news analyst creating a comprehensive briefing.

You have been given a diverse selection of article chunks covering:
- Multiple AI companies and models
- Technical developments
- Industry applications
- Societal implications

STRICT RULES:
- Cover a MAXIMUM of ${maxTopics} of the most important stories/topics
- Fewer is fine if there aren't ${maxTopics} major stories
- Prioritize stories that appear across multiple sources (higher signal)
- Prioritize genuinely significant developments over minor updates
- Combine related articles into single topics
- Provide context and analysis for each topic
- Explain why each development matters
- 4-6 sentences per topic with deeper insight
- Each topic must cite at least one source

DO NOT:
- Include minor product updates unless truly significant
- Repeat similar stories as separate topics
- Include more than ${maxTopics} topics even if there's more content

Format each topic as:
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

    // ---- Deduplicate sources ----
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
