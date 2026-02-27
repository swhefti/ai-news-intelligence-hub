#!/usr/bin/env python3
"""
Daily Summary Generator for AI News Intelligence Hub.

Generates a concise daily summary from recently ingested articles,
including top headlines and trending keywords. Stores the result
in the daily_summaries table for display on the homepage.

Usage:
    python generate_daily_summary.py [--hours 24] [--dry-run]

Required database table (run in Supabase SQL Editor if not exists):

    CREATE TABLE IF NOT EXISTS daily_summaries (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      date DATE UNIQUE NOT NULL,
      summary TEXT NOT NULL,
      headlines JSONB DEFAULT '[]',
      trending_keywords JSONB DEFAULT '[]',
      article_count INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS daily_summaries_date_idx
      ON daily_summaries(date DESC);
"""

import argparse
import logging
import os
import sys
import traceback
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv(override=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def ensure_table_exists(supabase):
    """Check that daily_summaries table exists by doing a lightweight query."""
    try:
        supabase.table("daily_summaries").select("id").limit(1).execute()
        return True
    except Exception as e:
        err_msg = str(e).lower()
        if "relation" in err_msg and "does not exist" in err_msg:
            logger.error(
                "Table 'daily_summaries' does not exist. "
                "Run the CREATE TABLE SQL in Supabase SQL Editor. "
                "See the docstring at the top of this file."
            )
            return False
        # Some other error — table might exist but query failed for another reason
        logger.warning("Could not verify table exists: %s", e)
        return True  # optimistically continue


def generate_daily_summary(hours: int = 24, dry_run: bool = False):
    """Generate a daily summary from recently ingested articles."""

    # Lazy imports so --help works without credentials
    from supabase import create_client
    from anthropic import Anthropic

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    missing = []
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not supabase_key:
        missing.append("SUPABASE_KEY")
    if not anthropic_key:
        missing.append("ANTHROPIC_API_KEY")

    if missing:
        logger.error("Missing required env vars: %s", ", ".join(missing))
        sys.exit(1)

    supabase = create_client(supabase_url, supabase_key)
    anthropic = Anthropic(api_key=anthropic_key)

    # Verify table exists
    if not ensure_table_exists(supabase):
        sys.exit(1)

    today = datetime.now(timezone.utc).date()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    # ── Fetch recent articles ────────────────────────────────────────
    logger.info("Fetching articles from the last %d hours...", hours)
    articles_resp = (
        supabase.table("articles")
        .select("id, title, url, source_name, keywords, summary, published_at")
        .gte("fetched_at", cutoff)
        .execute()
    )
    articles = articles_resp.data or []
    article_count = len(articles)

    # Filter to articles actually published within the last 24 hours
    # (fetched_at tracks ingestion time, but published_at may be older)
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent_articles = [
        a for a in articles
        if a.get("published_at") and a["published_at"] >= recent_cutoff
    ]
    logger.info("Of %d fetched articles, %d were published in the last 24h", article_count, len(recent_articles))

    if article_count == 0:
        logger.info("No new articles in the last %d hours — skipping summary.", hours)
        return

    logger.info("Found %d articles in the last %d hours", article_count, hours)

    # ── Fetch chunks for detailed context ────────────────────────────
    logger.info("Fetching chunks for context...")
    chunks_resp = (
        supabase.table("chunks")
        .select("text, article_title, article_url, source_name")
        .gte("created_at", cutoff)
        .limit(50)
        .execute()
    )
    chunks = chunks_resp.data or []
    logger.info("Got %d chunks for context", len(chunks))

    # Build context from up to 30 diverse chunks
    context = "\n\n".join(
        f"Source: {c['source_name']}\nTitle: {c['article_title']}\nURL: {c['article_url']}\nContent: {c['text']}"
        for c in chunks[:30]
    )

    # Build article list for headline selection — prefer recently published articles
    headline_candidates = recent_articles if recent_articles else articles
    article_list = "\n".join(
        f"- {a['title']} | {a['source_name']} | {a['url']}"
        for a in headline_candidates[:50]
    )

    # ── Generate summary with Claude ─────────────────────────────────
    prompt = f"""Analyze today's AI news articles and create a daily summary.

ARTICLES AVAILABLE TODAY ({article_count} total):
{article_list}

DETAILED CONTENT FROM KEY ARTICLES:
{context}

GENERATE THE FOLLOWING:

1. SUMMARY
Write a summary of today's most important AI news (4-7 sentences).
Organize by topic — separate each distinct topic into its own paragraph.
Use blank lines between paragraphs. Each paragraph should cover one topic.
Be informative and direct. Put the most important topic FIRST.

2. TITLE
Now that the summary is written, create a catchy newspaper-style title for it.
IMPORTANT RULES:
- The title MUST reflect the first topic (or the first and second topics) of the summary above
- Do NOT reference topics that only appear later in the summary
- Do NOT copy a headline verbatim — make it original, engaging and creative
- Maximum 20 words, but shorter is better
- No quotes around it. Make it punchy, interesting and easy to read

3. HEADLINES
Select the 3 most important/newsworthy stories from today.
IMPORTANT RULES:
- Only include genuinely significant stories published TODAY (within the last 24 hours)
- Maximum 3 headlines — pick only the most relevant ones
- If there are fewer than 3 standout stories, include fewer or none
- Do NOT include older articles that were merely re-ingested today
- Each headline needs the exact URL from the article list above

4. TRENDING_KEYWORDS
List 3-7 keywords/topics that appear frequently in today's news.
Use short terms like: "AI Agents", "OpenAI", "Regulation", "Healthcare AI", etc.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

SUMMARY:
[Topic 1 paragraph here]

[Topic 2 paragraph here]

[Topic 3 paragraph here if needed]

TITLE:
[Your catchy newspaper-style title here]

HEADLINES:
- [Headline title 1] | [exact URL]
- [Headline title 2] | [exact URL]

TRENDING_KEYWORDS:
[keyword1], [keyword2], [keyword3], ...
"""

    logger.info("Calling Claude to generate summary...")
    response = anthropic.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = response.content[0].text
    logger.info("Got response from Claude (%d chars)", len(response_text))

    # ── Parse the response ───────────────────────────────────────────
    title = ""
    summary = ""
    headlines = []
    trending_keywords = []

    if "SUMMARY:" in response_text:
        # SUMMARY comes before TITLE in the response
        summary = response_text.split("SUMMARY:")[1].split("TITLE:")[0].strip()

    if "TITLE:" in response_text:
        # TITLE comes between SUMMARY and HEADLINES
        title = response_text.split("TITLE:")[1].split("HEADLINES:")[0].strip()

    if "HEADLINES:" in response_text:
        headlines_section = response_text.split("HEADLINES:")[1].split("TRENDING_KEYWORDS:")[0].strip()
        for line in headlines_section.split("\n"):
            line = line.strip()
            if line.startswith("-") and "|" in line:
                parts = line[1:].strip().split("|")
                if len(parts) >= 2:
                    h_title = parts[0].strip()
                    url = parts[-1].strip()  # use last part in case title has |
                    if h_title and url.startswith("http"):
                        headlines.append({"title": h_title, "url": url})

    if "TRENDING_KEYWORDS:" in response_text:
        keywords_line = response_text.split("TRENDING_KEYWORDS:")[1].strip().split("\n")[0]
        trending_keywords = [k.strip() for k in keywords_line.split(",") if k.strip()]

    # ── Log results ──────────────────────────────────────────────────
    logger.info("Parsed title: %s", title[:80] if title else "(none)")
    logger.info("Parsed summary: %d chars", len(summary))
    logger.info("Parsed headlines: %d", len(headlines))
    logger.info("Parsed trending keywords: %s", trending_keywords)

    if not summary:
        logger.error("Failed to parse summary from Claude response. Raw response:\n%s", response_text[:500])
        sys.exit(1)

    if dry_run:
        print("\n--- DRY RUN ---")
        print(f"Date: {today}")
        print(f"Articles: {article_count}")
        print(f"\nTitle: {title}")
        print(f"\nSummary:\n{summary}")
        print(f"\nHeadlines:")
        for h in headlines:
            print(f"  - {h['title']}")
            print(f"    {h['url']}")
        print(f"\nTrending: {', '.join(trending_keywords)}")
        return

    # ── Save to database ─────────────────────────────────────────────
    # Pass native Python objects — supabase-py handles JSONB serialization
    summary_data = {
        "date": today.isoformat(),
        "title": title or None,
        "summary": summary,
        "headlines": headlines,
        "trending_keywords": trending_keywords,
        "article_count": article_count,
    }

    logger.info("Saving summary to database...")
    result = supabase.table("daily_summaries").upsert(
        summary_data, on_conflict="date"
    ).execute()
    logger.info("Database upsert result: %d rows", len(result.data) if result.data else 0)

    logger.info("Daily summary saved for %s", today)
    logger.info("  Articles analyzed: %d", article_count)
    logger.info("  Headlines: %d", len(headlines))
    logger.info("  Trending keywords: %d", len(trending_keywords))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate daily AI news summary")
    parser.add_argument("--hours", type=int, default=24, help="Hours to look back (default: 24)")
    parser.add_argument("--dry-run", action="store_true", help="Print results without saving")
    args = parser.parse_args()

    try:
        generate_daily_summary(hours=args.hours, dry_run=args.dry_run)
    except Exception as e:
        logger.error("Fatal error generating daily summary: %s", e)
        traceback.print_exc()
        sys.exit(1)
