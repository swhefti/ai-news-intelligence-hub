import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "7", 10), 30);

  const { data: summaries, error } = await supabase
    .from("daily_summaries")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = new Date().toISOString().split("T")[0];

  return NextResponse.json({
    summaries: summaries || [],
    today: summaries?.[0]?.date === today ? summaries[0] : null,
  });
}
