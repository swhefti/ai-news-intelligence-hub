#!/usr/bin/env python3
"""
Re-process articles that have no chunks in the database.

This script:
1. Finds all articles in Supabase that have zero associated chunks
2. For articles with short/missing content, fetches full content from the URL
3. Re-chunks and re-embeds those articles
4. Stores the new chunks in the database

Usage:
    python reprocess_unchunked.py              # Re-process all unchunked articles
    python reprocess_unchunked.py --dry-run    # Show what would be processed
    python reprocess_unchunked.py --mock       # Use mock embeddings (no API cost)
    python reprocess_unchunked.py --source "TechCrunch AI"  # Only this source
"""

import argparse
import logging
import sys
from datetime import datetime

from config import DATABASE_CONFIG
from fetcher import Article, fetch_full_content
from processor import chunk_article
from embedder import get_embedder
from storage import get_storage
from taxonomy import classify_text

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Minimum content length — if below this, try to fetch from URL
MIN_CONTENT_LENGTH = 500


def get_unchunked_articles(client, source_name: str = None) -> list[dict]:
    """Find articles that have no chunks in the database."""
    # Get all article IDs
    query = client.table("articles").select("id, title, url, content, summary, published_at, source_name, source_category, source_priority, keywords")

    if source_name:
        query = query.eq("source_name", source_name)

    result = query.execute()
    all_articles = result.data or []

    # Get all article IDs that DO have chunks
    chunks_result = client.table("chunks").select("article_id")
    if source_name:
        chunks_result = chunks_result.eq("source_name", source_name)
    chunks_result = chunks_result.execute()

    article_ids_with_chunks = set()
    for row in (chunks_result.data or []):
        article_ids_with_chunks.add(row["article_id"])

    # Filter to articles without chunks
    unchunked = [a for a in all_articles if a["id"] not in article_ids_with_chunks]

    return unchunked


def reprocess_articles(
    use_mock: bool = False,
    dry_run: bool = False,
    source_name: str = None,
):
    """Re-process unchunked articles."""
    start_time = datetime.now()

    print("\n" + "=" * 60)
    print("Re-processing Unchunked Articles")
    print("=" * 60)

    # Initialize
    storage = get_storage(use_local=False)
    client = storage._get_client()
    embedder = get_embedder(use_mock=use_mock)

    # Find unchunked articles
    print("\n🔍 Finding articles without chunks...")
    unchunked = get_unchunked_articles(client, source_name=source_name)
    print(f"   Found {len(unchunked)} articles without chunks")

    if not unchunked:
        print("   ✅ All articles have chunks!")
        return

    # Group by source for reporting
    by_source = {}
    for article in unchunked:
        src = article["source_name"]
        by_source.setdefault(src, []).append(article)

    print("\n   Breakdown by source:")
    for src, articles in sorted(by_source.items(), key=lambda x: -len(x[1])):
        print(f"     • {src}: {len(articles)} unchunked articles")

    if dry_run:
        print("\n🏁 Dry run — not making any changes")
        return

    # Process each article
    print(f"\n📡 Fetching full content and creating chunks...")
    total_chunks_created = 0
    total_content_updated = 0
    total_failed = 0

    for i, row in enumerate(unchunked):
        content = row.get("content") or ""
        title = row.get("title", "Untitled")
        url = row.get("url", "")
        source = row.get("source_name", "Unknown")

        print(f"\n  [{i+1}/{len(unchunked)}] [{source}] {title[:60]}")
        print(f"    Current content: {len(content)} chars")

        # Fetch full content if too short
        if len(content) < MIN_CONTENT_LENGTH and url:
            print(f"    → Fetching full content from URL...")
            full_content = fetch_full_content(url)
            if full_content and len(full_content) > len(content):
                print(f"    → Got {len(full_content)} chars (was {len(content)})")
                content = full_content
                total_content_updated += 1

                # Update article content in database
                try:
                    client.table("articles").update({"content": content}).eq("id", row["id"]).execute()
                except Exception as e:
                    logger.error(f"    → Failed to update article content: {e}")
            else:
                print(f"    → URL fetch didn't improve content")

        # Re-classify keywords if missing
        keywords = row.get("keywords") or []
        if not keywords:
            text = f"{title} {content}"
            keywords = classify_text(text)
            if keywords:
                try:
                    client.table("articles").update({"keywords": keywords}).eq("id", row["id"]).execute()
                    print(f"    → Classified with keywords: {', '.join(keywords[:5])}")
                except Exception as e:
                    logger.error(f"    → Failed to update keywords: {e}")

        # Create a mock Article object for the chunker
        article = Article(
            id=row["id"],
            title=title,
            url=url,
            content=content,
            summary=row.get("summary") or content[:500],
            published_at=datetime.fromisoformat(row["published_at"]) if row.get("published_at") else None,
            source_name=source,
            source_category=row.get("source_category", ""),
            source_priority=row.get("source_priority", "medium"),
            keywords=keywords,
        )

        # Chunk
        chunks = chunk_article(article)
        if not chunks:
            print(f"    ⚠ Still no chunks after processing")
            total_failed += 1
            continue

        print(f"    → Created {len(chunks)} chunks")

        # Embed
        try:
            embedded_chunks = embedder.embed_chunks(chunks)
        except Exception as e:
            logger.error(f"    → Embedding failed: {e}")
            total_failed += 1
            continue

        # Store
        try:
            stored = storage.store_embedded_chunks(embedded_chunks)
            total_chunks_created += stored
            print(f"    → Stored {stored} embedded chunks")
        except Exception as e:
            logger.error(f"    → Storage failed: {e}")
            total_failed += 1

    # Summary
    duration = (datetime.now() - start_time).total_seconds()
    print("\n" + "=" * 60)
    print("✅ Re-processing Complete!")
    print("=" * 60)
    print(f"\n📊 Summary:")
    print(f"   • Articles processed: {len(unchunked)}")
    print(f"   • Content updated from URLs: {total_content_updated}")
    print(f"   • Total chunks created: {total_chunks_created}")
    print(f"   • Failed: {total_failed}")
    print(f"   • Duration: {duration:.1f} seconds")


def main():
    parser = argparse.ArgumentParser(
        description="Re-process articles that have no chunks"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be processed without making changes"
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Use mock embeddings (no OpenAI API calls)"
    )
    parser.add_argument(
        "--source",
        type=str,
        help="Only process articles from this source name"
    )

    args = parser.parse_args()

    if not DATABASE_CONFIG.is_configured:
        print("❌ Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY.")
        sys.exit(1)

    reprocess_articles(
        use_mock=args.mock,
        dry_run=args.dry_run,
        source_name=args.source,
    )


if __name__ == "__main__":
    main()
