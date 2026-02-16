# 🚀 AI News Intelligence Hub - Getting Started Guide

Welcome! This guide will help you set up and run the AI News Intelligence Hub on your local machine.

## What We've Built

This is the **data ingestion pipeline** - the foundation of your RAG (Retrieval-Augmented Generation) system. It:

1. **Fetches** articles from 12+ AI/tech RSS feeds (Anthropic, OpenAI, Google, TechCrunch, etc.)
2. **Chunks** articles into smaller pieces optimized for semantic search
3. **Embeds** chunks using OpenAI's embedding API (or mock embeddings for testing)
4. **Stores** everything in Supabase with pgvector for similarity search

## Project Structure

```
ai-news-hub/
├── ingestion/
│   ├── config.py           # RSS feeds and settings
│   ├── fetcher.py          # RSS parsing and article extraction
│   ├── processor.py        # Text chunking
│   ├── embedder.py         # Embedding generation
│   ├── storage.py          # Supabase/local storage
│   ├── run_ingestion.py    # Main orchestration script
│   └── requirements.txt    # Python dependencies
├── .env.example            # Environment variable template
└── README.md               # Project overview
```

---

## Step 1: Set Up Your Environment

### Prerequisites
- Python 3.10 or higher
- A Supabase account (free tier works great)
- OpenAI API key (for embeddings)

### Install Dependencies

```bash
cd ai-news-hub/ingestion
pip install -r requirements.txt
```

### Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit with your keys
nano .env  # or use your preferred editor
```

You'll need:
- `SUPABASE_URL` - From your Supabase project settings
- `SUPABASE_KEY` - Your anon or service role key
- `OPENAI_API_KEY` - From OpenAI platform

---

## Step 2: Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Go to **SQL Editor** and run this schema:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    content TEXT,
    summary TEXT,
    published_at TIMESTAMPTZ,
    source_name TEXT NOT NULL,
    source_category TEXT NOT NULL,
    source_priority TEXT NOT NULL,
    authors JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunks table with embeddings
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    article_id TEXT REFERENCES articles(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding vector(1536),
    article_title TEXT,
    article_url TEXT,
    source_name TEXT,
    source_category TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS chunks_embedding_idx 
ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS chunks_source_idx ON chunks(source_name);
CREATE INDEX IF NOT EXISTS articles_published_idx ON articles(published_at DESC);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_source text DEFAULT NULL,
    filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id text, article_id text, chunk_index int, text text,
    article_title text, article_url text, source_name text,
    source_category text, published_at timestamptz, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.article_id, c.chunk_index, c.text, c.article_title,
           c.article_url, c.source_name, c.source_category, c.published_at,
           1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
      AND (filter_source IS NULL OR c.source_name = filter_source)
      AND (filter_category IS NULL OR c.source_category = filter_category)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END; $$;
```

---

## Step 3: Run Your First Ingestion

### Option A: Test Mode (No API Calls)

Perfect for making sure everything works:

```bash
python run_ingestion.py --local --mock
```

This uses:
- Local JSON storage (no Supabase needed)
- Mock embeddings (no OpenAI API needed)

### Option B: Full Mode with Supabase

Once your environment is configured:

```bash
python run_ingestion.py
```

### Useful Options

```bash
# Only fetch from high-priority sources
python run_ingestion.py --priorities high

# Only AI company blogs
python run_ingestion.py --categories ai_company

# Specific sources only
python run_ingestion.py --sources "Anthropic Blog,OpenAI Blog"

# See what's in your database
python run_ingestion.py --stats
```

---

## Step 4: Verify It's Working

After running ingestion, check your Supabase dashboard:

1. Go to **Table Editor**
2. Check the `articles` table - you should see fetched articles
3. Check the `chunks` table - you should see text chunks with embeddings

Or use the CLI:

```bash
python run_ingestion.py --stats
```

---

## What's Next?

Now that you have data flowing, the next steps are:

### Week 2: RAG Query System
- Create an API endpoint that:
  1. Takes a user question
  2. Embeds the question
  3. Searches for similar chunks
  4. Sends relevant chunks + question to Claude
  5. Returns a grounded answer with citations

### Week 3: Frontend
- Build a Next.js app with:
  - Chat interface for Q&A
  - Dashboard showing article stats and trends
  - "Generate briefing" feature

### Week 4: Polish
- Add more sources
- Improve chunking strategy
- Add scheduled ingestion (cron job)
- Deploy to Vercel

---

## Troubleshooting

### "No articles fetched"
- Check your internet connection
- Some RSS feeds may be temporarily down
- Try with `--sources "TechCrunch AI"` to test a single source

### "Failed to store chunks"
- Verify your Supabase credentials
- Make sure you ran the SQL schema
- Check the pgvector extension is enabled

### "OpenAI API error"
- Verify your API key is correct
- Check your OpenAI account has credits
- Use `--mock` to test without API calls

---

## Learning Resources

As you build this, you'll learn:

- **RAG Architecture**: How retrieval-augmented generation works
- **Vector Databases**: Embeddings, similarity search, pgvector
- **API Design**: Building query endpoints
- **Data Pipelines**: ETL patterns for ML applications

Great resources:
- [Anthropic Cookbook](https://github.com/anthropics/anthropic-cookbook)
- [Supabase Vector Search Docs](https://supabase.com/docs/guides/ai)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)

---

## Questions?

This is a learning project - experiment, break things, and iterate! The code is well-commented to help you understand each piece.

Good luck with your AI PM journey! 🎯
