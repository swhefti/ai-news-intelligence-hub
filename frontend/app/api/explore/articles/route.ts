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

export async function GET(request: NextRequest) {
  try {
    const db = getSupabase();
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword");
    const days = parseInt(searchParams.get("days") ?? "14", 10);
    const clampedDays = Math.max(1, Math.min(days, 365));

    if (!keyword) {
      return NextResponse.json(
        { error: "keyword parameter is required" },
        { status: 400 }
      );
    }

    // Calculate the cutoff date
    const cutoff = new Date(
      Date.now() - clampedDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch articles that contain this keyword in their keywords array
    const { data: articles, error } = await db
      .from("articles")
      .select("title, url, source_name, published_at")
      .contains("keywords", [keyword])
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Explore articles error:", error);
      return NextResponse.json(
        { error: "Failed to fetch articles" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      keyword,
      articles: articles ?? [],
    });
  } catch (error) {
    console.error("Explore articles API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
