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
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "7", 10), 30);

    const { data: summaries, error } = await supabase
      .from("daily_summaries")
      .select("*")
      .order("date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Summaries fetch error:", error);
      // Return empty instead of 500 if table doesn't exist yet
      if (error.message?.includes("does not exist")) {
        return NextResponse.json({ summaries: [], today: null });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const today = new Date().toISOString().split("T")[0];

    return NextResponse.json({
      summaries: summaries || [],
      today: summaries?.[0]?.date === today ? summaries[0] : null,
    });
  } catch (error) {
    console.error("Summaries API error:", error);
    return NextResponse.json({ summaries: [], today: null });
  }
}
