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
    const supabase = getSupabase();

    const { count, error } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Stats error:", error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }

    return NextResponse.json({ articleCount: count ?? 0 });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
