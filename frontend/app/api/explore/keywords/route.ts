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

export async function GET() {
  try {
    const db = getSupabase();

    // Fetch all articles with keywords and published_at
    // Supabase doesn't support UNNEST directly, so we fetch and aggregate in JS
    const { data: articles, error, count } = await db
      .from("articles")
      .select("keywords, published_at", { count: "exact" });

    if (error) {
      console.error("Explore keywords error:", error);
      return NextResponse.json(
        { error: "Failed to fetch keyword data" },
        { status: 500 }
      );
    }

    // Count keyword frequencies
    const keywordCounts = new Map<string, number>();
    let earliest: string | null = null;
    let latest: string | null = null;

    for (const article of articles ?? []) {
      // Track date range
      if (article.published_at) {
        if (!earliest || article.published_at < earliest) {
          earliest = article.published_at;
        }
        if (!latest || article.published_at > latest) {
          latest = article.published_at;
        }
      }

      // Count each keyword
      const keywords: string[] = article.keywords ?? [];
      for (const kw of keywords) {
        keywordCounts.set(kw, (keywordCounts.get(kw) ?? 0) + 1);
      }
    }

    // Build sorted keyword list
    const keywords = Array.from(keywordCounts.entries())
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      keywords,
      totalArticles: count ?? 0,
      dateRange: {
        from: earliest ? earliest.slice(0, 10) : null,
        to: latest ? latest.slice(0, 10) : null,
      },
    });
  } catch (error) {
    console.error("Explore keywords API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
