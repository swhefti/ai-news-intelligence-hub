# AI News Intelligence Hub

A RAG-powered platform that aggregates AI/tech news and lets you query it with natural language.

## 🎯 Purpose

- **Learn**: Understand RAG, vector databases, and AI-powered applications
- **Showcase**: Demonstrate AI product thinking for job interviews
- **Use**: Stay on top of AI news with intelligent summaries and queries

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│            (Next.js + Tailwind on Vercel)              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND / API                        │
│     RAG Query  │  Analytics  │  Briefing Generation    │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ Supabase   │  │ Supabase   │  │ Claude API │
   │ (articles) │  │ pgvector   │  │ (LLM)      │
   └────────────┘  └────────────┘  └────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│                  DATA INGESTION                         │
│       RSS Feeds → Parse → Chunk → Embed → Store        │
└─────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
ai-news-hub/
├── ingestion/           # Data ingestion pipeline (Python)
│   ├── config.py        # RSS feeds and settings
│   ├── fetcher.py       # RSS feed fetching
│   ├── processor.py     # Text chunking and cleaning
│   ├── embedder.py      # Generate embeddings
│   ├── storage.py       # Supabase storage
│   └── run_ingestion.py # Main ingestion script
├── api/                 # Backend API (Next.js API routes)
├── frontend/            # Next.js frontend
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Supabase account (free tier works)
- OpenAI API key (for embeddings)
- Anthropic API key (for Claude)

### Setup

1. Clone this repo
2. Set up environment variables (see `.env.example`)
3. Run the ingestion pipeline
4. Start the frontend

## 📊 Current Status

- [x] Project structure
- [ ] RSS feed ingestion
- [ ] Text chunking
- [ ] Embedding generation
- [ ] Supabase storage
- [ ] RAG query endpoint
- [ ] Chat interface
- [ ] Dashboard
- [ ] Briefing generation

## 🔧 Development Notes

This project is being built as a learning exercise and portfolio piece.
Documenting decisions and learnings along the way.
