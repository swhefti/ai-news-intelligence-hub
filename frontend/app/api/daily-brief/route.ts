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

    // With an explicit ?date= return that single edition; without one (the
    // homepage) return recent editions across days, newest first. The client
    // groups them by date and stacks older editions below the current one — and
    // because the latest available edition is always included, the homepage
    // never renders blank before today's brief has been generated.
    const date = searchParams.get("date");

    let query = supabase.from("daily_briefs").select("*");
    if (date) {
      query = query.eq("brief_date", date).order("rank", { ascending: true });
    } else {
      query = query
        .order("brief_date", { ascending: false })
        .order("rank", { ascending: true })
        .limit(30);
    }

    const { data: briefs, error } = await query;

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
