#!/usr/bin/env python3
"""
Main Ingestion Script for AI News Intelligence Hub.

This script orchestrates the full ingestion pipeline:
1. Fetch articles from RSS feeds
2. Chunk articles into smaller pieces
3. Generate embeddings for chunks
4. Store in database (Supabase or local)

Usage:
    python run_ingestion.py [options]

Options:
    --local         Use local storage instead of Supabase
    --mock          Use mock embeddings (no API calls)
    --sources       Comma-separated list of source names to fetch
    --categories    Comma-separated list of categories to fetch
    --priorities    Comma-separated list of priorities to fetch
    --full-content  Fetch full article content from URLs
    --stats         Show database statistics and exit
"""

import argparse
import logging
import sys
from datetime import datetime

from config import RSS_FEEDS
from fetcher import fetch_all_feeds, Article
from processor import chunk_articles, Chunk
from embedder import get_embedder, EmbeddedChunk
from storage import get_storage
from taxonomy import classify_text

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_ingestion(
    use_local: bool = False,
    use_mock: bool = False,
    categories: list[str] = None,
    priorities: list[str] = None,
    source_names: list[str] = None,
    fetch_full: bool = False,
) -> dict:
    """
    Run the full ingestion pipeline.
    
    Args:
        use_local: Use local storage instead of Supabase
        use_mock: Use mock embeddings instead of OpenAI
        categories: Filter to these categories
        priorities: Filter to these priorities
        source_names: Filter to these specific sources
        fetch_full: Fetch full article content from URLs
    
    Returns:
        Dictionary with ingestion statistics
    """
    start_time = datetime.now()
    stats = {
        "start_time": start_time.isoformat(),
        "articles_fetched": 0,
        "articles_new": 0,
        "chunks_created": 0,
        "chunks_embedded": 0,
        "chunks_stored": 0,
        "errors": [],
    }
    
    print("\n" + "="*60)
    print("AI News Intelligence Hub - Ingestion Pipeline")
    print("="*60)
    
    # -------------------------------------------------------------------------
    # Step 1: Initialize components
    # -------------------------------------------------------------------------
    print("\n📦 Initializing components...")
    
    storage = get_storage(use_local=use_local)
    embedder = get_embedder(use_mock=use_mock)
    
    # Filter feeds if specific sources requested
    feeds = RSS_FEEDS
    if source_names:
        feeds = [f for f in feeds if f['name'] in source_names]
        print(f"   Filtered to {len(feeds)} sources: {source_names}")
    
    # -------------------------------------------------------------------------
    # Step 2: Fetch articles
    # -------------------------------------------------------------------------
    print("\n📡 Fetching articles from RSS feeds...")
    
    try:
        articles = fetch_all_feeds(
            feeds=feeds,
            categories=categories,
            priorities=priorities,
            fetch_full=fetch_full,
        )
        stats["articles_fetched"] = len(articles)
        print(f"   ✓ Fetched {len(articles)} articles")
    except Exception as e:
        logger.error(f"Failed to fetch articles: {e}")
        stats["errors"].append(f"Fetch error: {e}")
        return stats
    
    if not articles:
        print("   ⚠ No articles found")
        return stats
    
    # -------------------------------------------------------------------------
    # Step 3: Filter out already-processed articles (for Supabase)
    # -------------------------------------------------------------------------
    if hasattr(storage, 'get_existing_article_ids'):
        print("\n🔍 Checking for new articles...")
        try:
            existing_ids = storage.get_existing_article_ids()
            new_articles = [a for a in articles if a.id not in existing_ids]
            stats["articles_new"] = len(new_articles)
            print(f"   ✓ {len(new_articles)} new articles (skipping {len(articles) - len(new_articles)} existing)")
            articles = new_articles
        except Exception as e:
            logger.warning(f"Could not check existing articles: {e}")
            stats["articles_new"] = len(articles)
    else:
        stats["articles_new"] = len(articles)
    
    if not articles:
        print("   ⚠ No new articles to process")
        return stats

    # -------------------------------------------------------------------------
    # Step 3b: Classify articles with keyword taxonomy
    # -------------------------------------------------------------------------
    print("\n🏷️  Classifying articles with keyword taxonomy...")

    keyword_counts = {}
    for article in articles:
        text = f"{article.title} {article.content}"
        article.keywords = classify_text(text)
        for kw in article.keywords:
            keyword_counts[kw] = keyword_counts.get(kw, 0) + 1

    total_keywords = sum(len(a.keywords) for a in articles)
    articles_with_kw = sum(1 for a in articles if a.keywords)
    print(f"   ✓ Classified {articles_with_kw}/{len(articles)} articles ({total_keywords} total keyword assignments)")

    if keyword_counts:
        top_keywords = sorted(keyword_counts.items(), key=lambda x: -x[1])[:10]
        print(f"   Top keywords: {', '.join(f'{k} ({v})' for k, v in top_keywords)}")

    stats["articles_classified"] = articles_with_kw
    stats["keyword_assignments"] = total_keywords

    # -------------------------------------------------------------------------
    # Step 4: Store articles
    # -------------------------------------------------------------------------
    print("\n💾 Storing articles...")
    
    try:
        stored_count = storage.store_articles(articles)
        print(f"   ✓ Stored {stored_count} articles")
    except Exception as e:
        logger.error(f"Failed to store articles: {e}")
        stats["errors"].append(f"Article storage error: {e}")
    
    # -------------------------------------------------------------------------
    # Step 5: Chunk articles
    # -------------------------------------------------------------------------
    print("\n✂️ Chunking articles...")
    
    try:
        chunks = chunk_articles(articles)
        stats["chunks_created"] = len(chunks)
        print(f"   ✓ Created {len(chunks)} chunks")
    except Exception as e:
        logger.error(f"Failed to chunk articles: {e}")
        stats["errors"].append(f"Chunking error: {e}")
        return stats
    
    # -------------------------------------------------------------------------
    # Step 6: Generate embeddings
    # -------------------------------------------------------------------------
    print("\n🧠 Generating embeddings...")
    
    try:
        embedded_chunks = embedder.embed_chunks(chunks)
        stats["chunks_embedded"] = len(embedded_chunks)
        print(f"   ✓ Embedded {len(embedded_chunks)} chunks")
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        stats["errors"].append(f"Embedding error: {e}")
        return stats
    
    # -------------------------------------------------------------------------
    # Step 7: Store embedded chunks
    # -------------------------------------------------------------------------
    print("\n💾 Storing embedded chunks...")
    
    try:
        stored_count = storage.store_embedded_chunks(embedded_chunks)
        stats["chunks_stored"] = stored_count
        print(f"   ✓ Stored {stored_count} embedded chunks")
    except Exception as e:
        logger.error(f"Failed to store chunks: {e}")
        stats["errors"].append(f"Chunk storage error: {e}")
    
    # -------------------------------------------------------------------------
    # Done!
    # -------------------------------------------------------------------------
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    stats["duration_seconds"] = duration
    stats["end_time"] = end_time.isoformat()
    
    print("\n" + "="*60)
    print("✅ Ingestion Complete!")
    print("="*60)
    print(f"\n📊 Summary:")
    print(f"   • Articles fetched: {stats['articles_fetched']}")
    print(f"   • New articles: {stats['articles_new']}")
    print(f"   • Articles classified: {stats.get('articles_classified', 0)}")
    print(f"   • Keyword assignments: {stats.get('keyword_assignments', 0)}")
    print(f"   • Chunks created: {stats['chunks_created']}")
    print(f"   • Chunks embedded: {stats['chunks_embedded']}")
    print(f"   • Chunks stored: {stats['chunks_stored']}")
    print(f"   • Duration: {duration:.1f} seconds")

    if stats["errors"]:
        print(f"\n⚠️ Errors encountered:")
        for error in stats["errors"]:
            print(f"   • {error}")

    # -------------------------------------------------------------------------
    # Monitoring: Warn if chunks-to-articles ratio is too low
    # -------------------------------------------------------------------------
    if stats["articles_new"] > 0:
        ratio = stats["chunks_created"] / stats["articles_new"]
        if ratio < 0.5:
            print(f"\n🚨 WARNING: Very low chunks-to-articles ratio ({ratio:.2f})")
            print(f"   {stats['articles_new']} articles produced only {stats['chunks_created']} chunks")
            print(f"   Most RSS feeds may not be providing full content.")
            print(f"   → Make sure full-content fetching is enabled (default)")
        elif ratio < 1.0:
            print(f"\n⚠️ Low chunks-to-articles ratio ({ratio:.2f})")
            print(f"   Some articles may have very short content.")

    return stats


def show_stats(use_local: bool = False):
    """Show current database statistics."""
    print("\n" + "="*60)
    print("Database Statistics")
    print("="*60 + "\n")
    
    storage = get_storage(use_local=use_local)
    stats = storage.get_stats()
    
    print(f"Total articles: {stats.get('total_articles', 0)}")
    print(f"Total chunks: {stats.get('total_chunks', 0)}")
    
    sources = stats.get('sources', {})
    if sources:
        print(f"\nArticles by source:")
        for source, count in sorted(sources.items(), key=lambda x: -x[1]):
            print(f"  • {source}: {count}")


def main():
    """Main entry point with CLI argument parsing."""
    parser = argparse.ArgumentParser(
        description="AI News Intelligence Hub - Ingestion Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument(
        "--local",
        action="store_true",
        help="Use local JSON storage instead of Supabase"
    )
    
    parser.add_argument(
        "--mock",
        action="store_true", 
        help="Use mock embeddings (no OpenAI API calls)"
    )
    
    parser.add_argument(
        "--sources",
        type=str,
        help="Comma-separated list of source names to fetch"
    )
    
    parser.add_argument(
        "--categories",
        type=str,
        help="Comma-separated list of categories (ai_company, tech_news, research, community)"
    )
    
    parser.add_argument(
        "--priorities",
        type=str,
        help="Comma-separated list of priorities (high, medium, low)"
    )
    
    parser.add_argument(
        "--no-full-content",
        action="store_true",
        help="Skip fetching full content from URLs (faster, RSS-only)"
    )

    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show database statistics and exit"
    )

    args = parser.parse_args()

    # Show stats and exit if requested
    if args.stats:
        show_stats(use_local=args.local)
        return

    # Parse filter options
    sources = args.sources.split(",") if args.sources else None
    categories = args.categories.split(",") if args.categories else None
    priorities = args.priorities.split(",") if args.priorities else None

    # Full content is ON by default; --no-full-content disables it
    fetch_full = not args.no_full_content

    # Run ingestion
    stats = run_ingestion(
        use_local=args.local,
        use_mock=args.mock,
        source_names=sources,
        categories=categories,
        priorities=priorities,
        fetch_full=fetch_full,
    )
    
    # Return appropriate exit code
    if stats.get("errors"):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
