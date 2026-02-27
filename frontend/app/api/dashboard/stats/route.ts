import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }
  return supabase;
}

/* ------------------------------------------------------------------ */
/* Paginated fetch — Supabase JS returns max 1000 rows by default.    */
/* This helper loops with .range() to retrieve ALL matching rows.     */
/* ------------------------------------------------------------------ */
const PAGE_SIZE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(
  buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: any; error: any }> }
): Promise<{ data: Record<string, any>[]; error: unknown }> {
  const allRows: Record<string, any>[] = [];
  let offset = 0;

  while (true) {
    // Re-create the query each iteration so .range() applies cleanly
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);

    if (error) return { data: [], error };
    if (!data || data.length === 0) break;

    allRows.push(...data);

    // If we got fewer rows than the page size, we've reached the end
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { data: allRows, error: null };
}

export async function GET() {
  try {
    const supabase = getSupabase();

    // Run count queries (head:true, no row limit issue) in parallel
    // with paginated full-data fetches
    const [
      articlesResult,
      chunksResult,
      articlesBySourceResult,
      chunksBySourceResult,
      dailyArticlesResult,
    ] = await Promise.all([
      // Total article count (head-only, no pagination needed)
      supabase.from("articles").select("*", { count: "exact", head: true }),

      // Total chunk count (head-only, no pagination needed)
      supabase.from("chunks").select("*", { count: "exact", head: true }),

      // Articles per source — paginated to get ALL rows
      fetchAll(() =>
        supabase
          .from("articles")
          .select("source_name, source_category, published_at")
      ),

      // Chunks per source — paginated to get ALL rows
      fetchAll(() => supabase.from("chunks").select("source_name")),

      // Articles from the last 14 days — paginated
      fetchAll(() =>
        supabase
          .from("articles")
          .select("source_name, published_at")
          .gte(
            "published_at",
            new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
          )
          .order("published_at", { ascending: true })
      ),
    ]);

    if (articlesResult.error || chunksResult.error || articlesBySourceResult.error || chunksBySourceResult.error || dailyArticlesResult.error) {
      console.error("Dashboard stats errors:", {
        articles: articlesResult.error,
        chunks: chunksResult.error,
        articlesBySource: articlesBySourceResult.error,
        chunksBySource: chunksBySourceResult.error,
        dailyArticles: dailyArticlesResult.error,
      });
      return NextResponse.json(
        { error: "Failed to fetch dashboard stats" },
        { status: 500 }
      );
    }

    // Aggregate articles per source
    const sourceMap = new Map<
      string,
      {
        source_name: string;
        source_category: string;
        article_count: number;
        chunk_count: number;
        last_article: string | null;
      }
    >();

    for (const row of articlesBySourceResult.data ?? []) {
      const existing = sourceMap.get(row.source_name);
      if (existing) {
        existing.article_count += 1;
        if (
          row.published_at &&
          (!existing.last_article || row.published_at > existing.last_article)
        ) {
          existing.last_article = row.published_at;
        }
      } else {
        sourceMap.set(row.source_name, {
          source_name: row.source_name,
          source_category: row.source_category,
          article_count: 1,
          chunk_count: 0,
          last_article: row.published_at,
        });
      }
    }

    // Aggregate chunks per source
    for (const row of chunksBySourceResult.data ?? []) {
      const existing = sourceMap.get(row.source_name);
      if (existing) {
        existing.chunk_count += 1;
      }
    }

    const sources = Array.from(sourceMap.values()).sort(
      (a, b) => b.article_count - a.article_count
    );

    // Aggregate daily articles by source
    const dailyMap = new Map<string, Map<string, number>>();
    for (const row of dailyArticlesResult.data ?? []) {
      if (!row.published_at) continue;
      const date = row.published_at.slice(0, 10); // YYYY-MM-DD
      if (!dailyMap.has(date)) {
        dailyMap.set(date, new Map());
      }
      const daySourceMap = dailyMap.get(date)!;
      daySourceMap.set(
        row.source_name,
        (daySourceMap.get(row.source_name) ?? 0) + 1
      );
    }

    // Build daily array with all sources as keys
    const allSourceNames = sources.map((s) => s.source_name);
    const daily: Record<string, string | number>[] = [];
    for (const [date, sourceCounts] of dailyMap) {
      const entry: Record<string, string | number> = { date };
      for (const name of allSourceNames) {
        entry[name] = sourceCounts.get(name) ?? 0;
      }
      daily.push(entry);
    }
    daily.sort((a, b) => (a.date as string).localeCompare(b.date as string));

    // Find last ingestion time (most recent article across all sources)
    let lastIngestion: string | null = null;
    for (const s of sources) {
      if (
        s.last_article &&
        (!lastIngestion || s.last_article > lastIngestion)
      ) {
        lastIngestion = s.last_article;
      }
    }

    return NextResponse.json({
      totalArticles: articlesResult.count ?? 0,
      totalChunks: chunksResult.count ?? 0,
      lastIngestion,
      sources,
      daily,
    });
  } catch (error) {
    console.error("Dashboard stats API error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
