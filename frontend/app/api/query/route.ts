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

export async function POST(request: NextRequest) {
  try {
    const { supabase, openai, anthropic } = getClients();
    const { question } = await request.json();

    if (!question || typeof question !== "string" || question.trim() === "") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

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
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are an AI news analyst assistant. Answer questions based on the provided context from recent AI news articles.

Rules:
- Only use information from the provided context to answer
- Cite your sources by referencing the source numbers [Source N]
- If the context doesn't contain enough information, say so
- Be concise and informative
- Format your response in clear paragraphs`,
      messages: [
        {
          role: "user",
          content: `Context from recent AI news articles:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        },
      ],
    });

    // Extract text from Claude's response
    const answerBlock = message.content.find((block) => block.type === "text");
    const answer = answerBlock ? answerBlock.text : "No response generated.";

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
    });
  } catch (error) {
    console.error("Query API error:", error);
    return NextResponse.json(
      { error: "An internal error occurred while processing your question" },
      { status: 500 }
    );
  }
}
