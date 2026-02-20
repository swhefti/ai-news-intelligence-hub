import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

let supabase: SupabaseClient;
let openai: OpenAI;
let anthropic: Anthropic;

function getClients() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return { supabase, openai, anthropic };
}

interface ChunkResult {
  id: string;
  article_id: string;
  chunk_index: number;
  text: string;
  article_title: string;
  article_url: string;
  source_name: string;
  source_category: string;
  published_at: string;
  similarity: number;
}

/* ------------------------------------------------------------------ */
/* System prompts                                                      */
/* ------------------------------------------------------------------ */

const NEWS_DATABASE_PROMPT = `You are an AI news analyst. Answer questions based ONLY on the provided context from recent AI news articles.

Rules:
- Only use information from the provided context
- Cite sources by referencing [Source N]
- If the context doesn't contain enough information, say so clearly
- Be concise: answer in 4–7 sentences
- Use clear, direct language — no filler phrases
- Format as a single block of text (no bullet points or headers)

After your answer, on a new line write FOLLOW_UP_QUESTIONS: followed by exactly 3 short follow-up questions the user might want to ask next, separated by |. Each question should be under 60 characters and directly related to the topic. Do not number them.`;

const NEWS_PLUS_AI_PROMPT = `You are an AI news analyst with deep expertise in artificial intelligence. Answer questions using BOTH the provided news context AND your own knowledge of AI.

Rules:
- Use the provided news context as your primary source and cite with [Source N]
- Supplement with your own AI knowledge when helpful — but clearly distinguish sourced facts from your analysis
- Be concise: answer in 4–7 sentences
- Use clear, direct language — no filler phrases
- Format as a single block of text (no bullet points or headers)

After your answer, on a new line write FOLLOW_UP_QUESTIONS: followed by exactly 3 short follow-up questions the user might want to ask next, separated by |. Each question should be under 60 characters and directly related to the topic. Do not number them.`;

/* ------------------------------------------------------------------ */
/* Response parsing                                                    */
/* ------------------------------------------------------------------ */

function parseResponse(raw: string): {
  answer: string;
  followUpQuestions: string[];
} {
  const marker = "FOLLOW_UP_QUESTIONS:";
  const idx = raw.indexOf(marker);

  if (idx === -1) {
    return { answer: raw.trim(), followUpQuestions: [] };
  }

  const answer = raw.slice(0, idx).trim();
  const followUpRaw = raw.slice(idx + marker.length).trim();
  const followUpQuestions = followUpRaw
    .split("|")
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && q.length < 80)
    .slice(0, 3);

  return { answer, followUpQuestions };
}

/* ------------------------------------------------------------------ */
/* POST handler                                                        */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const { supabase, openai, anthropic } = getClients();
    const body = await request.json();
    const { question, mode = "news" } = body;

    if (!question || typeof question !== "string" || question.trim() === "") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const validModes = ["news", "news_plus_ai"];
    const selectedMode = validModes.includes(mode) ? mode : "news";

    // Step 1: Embed the question using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question.trim(),
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Step 2: Search for similar chunks using Supabase's match_chunks function
    const { data: chunks, error: searchError } = await supabase.rpc(
      "match_chunks",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.2,
        match_count: 10,
        filter_source: null,
        filter_category: null,
      }
    );

    if (searchError) {
      console.error("Supabase search error:", searchError);
      return NextResponse.json(
        { error: "Failed to search knowledge base" },
        { status: 500 }
      );
    }

    const typedChunks = (chunks ?? []) as ChunkResult[];

    if (typedChunks.length === 0) {
      return NextResponse.json({
        answer:
          "I don't have enough information in my knowledge base to answer that question. Try asking about recent AI news, company announcements, or research papers.",
        sources: [],
        followUpQuestions: [],
      });
    }

    // Step 3: Build context from retrieved chunks
    const context = typedChunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}: "${chunk.article_title}" - ${chunk.source_name}]\n${chunk.text}`
      )
      .join("\n\n---\n\n");

    // Step 4: Send to Claude with the context
    const systemPrompt =
      selectedMode === "news_plus_ai"
        ? NEWS_PLUS_AI_PROMPT
        : NEWS_DATABASE_PROMPT;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Context from recent AI news articles:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        },
      ],
    });

    // Extract text from Claude's response
    const answerBlock = message.content.find((block) => block.type === "text");
    const rawAnswer = answerBlock ? answerBlock.text : "No response generated.";

    // Parse answer and follow-up questions
    const { answer, followUpQuestions } = parseResponse(rawAnswer);

    // Step 5: Deduplicate sources by URL
    const sourceMap = new Map<
      string,
      { title: string; url: string; source_name: string; published_at: string }
    >();
    for (const chunk of typedChunks) {
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
      answer,
      sources: Array.from(sourceMap.values()),
      followUpQuestions,
    });
  } catch (error) {
    console.error("Query API error:", error);
    return NextResponse.json(
      { error: "An internal error occurred while processing your question" },
      { status: 500 }
    );
  }
}
