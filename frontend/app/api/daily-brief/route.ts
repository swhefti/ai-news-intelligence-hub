import { NextRequest, NextResponse } from "next/server";
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

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value as T) ?? fallback;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);

    // Resolve which date to serve: the explicitly requested ?date=, or — when
    // none is given (the homepage) — the most recent brief available. This way
    // the homepage shows the latest edition (e.g. yesterday's) until today's
    // has been generated, instead of rendering blank.
    let date = searchParams.get("date");
    if (!date) {
      const { data: latest, error: latestError } = await supabase
        .from("daily_briefs")
        .select("brief_date")
        .order("brief_date", { ascending: false })
        .limit(1);

      if (latestError) {
        console.error("Daily brief latest-date error:", latestError);
        if (latestError.message?.includes("does not exist")) {
          return NextResponse.json([]);
        }
        return NextResponse.json({ error: latestError.message }, { status: 500 });
      }

      date = latest?.[0]?.brief_date ?? null;
      if (!date) return NextResponse.json([]);
    }

    const { data: briefs, error } = await supabase
      .from("daily_briefs")
      .select("*")
      .eq("brief_date", date)
      .order("rank", { ascending: true });

    if (error) {
      console.error("Daily brief fetch error:", error);
      // Return empty instead of 500 if the table doesn't exist yet.
      if (error.message?.includes("does not exist")) {
        return NextResponse.json([]);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (briefs || []).map((b) => ({
      ...b,
      source_article_ids: parseJsonField<string[]>(b.source_article_ids, []),
      source_titles: parseJsonField<string[]>(b.source_titles, []),
      source_names: parseJsonField<string[]>(b.source_names, []),
      source_urls: parseJsonField<string[]>(b.source_urls, []),
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Daily brief API error:", error);
    return NextResponse.json([]);
  }
}
