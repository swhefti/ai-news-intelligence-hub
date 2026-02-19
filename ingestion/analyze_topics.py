#!/usr/bin/env python3
"""
Topic Analysis Script for AI News Intelligence Hub.

Analyzes existing articles in the database to discover common topics and themes.
Uses Claude to extract and categorize topics from article titles and summaries.

Usage:
    python analyze_topics.py

Output:
    - topic_analysis.json (full results)
    - Printed summary of top topics
"""

import json
import logging
import os
import sys
from collections import defaultdict

from dotenv import load_dotenv

# Load ingestion .env, then fill in missing keys from frontend .env.local
from dotenv import dotenv_values

_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_script_dir, ".env"))

# Fallback: load ANTHROPIC_API_KEY from frontend env if not already set
_frontend_env = dotenv_values(os.path.join(_script_dir, "..", "frontend", ".env.local"))
for key, value in _frontend_env.items():
    if not os.getenv(key) and value:
        os.environ[key] = value

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 25  # Articles per Claude call


def fetch_all_articles():
    """Fetch all articles from Supabase."""
    from supabase import create_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL and SUPABASE_KEY must be set")
        sys.exit(1)

    client = create_client(url, key)

    # Supabase returns max 1000 rows per request — paginate
    all_articles = []
    offset = 0
    page_size = 500

    while True:
        result = (
            client.table("articles")
            .select("title, summary, content, source_name")
            .order("published_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        all_articles.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    logger.info(f"Fetched {len(all_articles)} articles from Supabase")
    return all_articles


def analyze_batch(articles, batch_num, total_batches):
    """Send a batch of articles to Claude for topic extraction."""
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY must be set")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # Build article text for the prompt
    article_lines = []
    for i, article in enumerate(articles, 1):
        title = article.get("title", "Untitled")
        summary = article.get("summary") or article.get("content") or ""
        # Truncate summary to keep prompt reasonable
        if len(summary) > 300:
            summary = summary[:300] + "..."
        source = article.get("source_name", "Unknown")
        article_lines.append(f"{i}. [{source}] {title}\n   {summary}")

    articles_text = "\n\n".join(article_lines)

    prompt = f"""Analyze these article titles and summaries. Extract the main topics and themes.

For each distinct topic you identify, provide:
- Topic name (short, 2-3 words max)
- Count of how many articles mention it
- Example article titles (2-3 max)

Group similar concepts together (e.g., "GenAI" and "Generative AI" = same topic).

Focus on:
- AI companies and models mentioned (e.g., GPT-4, Claude, Llama)
- Technical concepts (e.g., fine-tuning, RAG, agents)
- Applications and use cases (e.g., code generation, healthcare AI)
- Industry/societal themes (e.g., AI regulation, job displacement)
- Research areas (e.g., reinforcement learning, multimodal AI)

Return ONLY valid JSON, no other text:
{{
  "topics": [
    {{"name": "Topic Name", "count": 5, "examples": ["Article title 1", "Article title 2"]}},
    ...
  ]
}}

Articles:

{articles_text}"""

    logger.info(f"Analyzing batch {batch_num}/{total_batches} ({len(articles)} articles)...")

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = message.content[0].text.strip()

    # Try to extract JSON from the response
    try:
        # Handle case where Claude wraps in markdown code block
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse JSON from batch {batch_num}, attempting repair...")
        # Try to find JSON object in the text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
        logger.error(f"Could not parse response for batch {batch_num}")
        return {"topics": []}


def merge_topics(all_batch_results):
    """Merge and deduplicate topics across batches."""
    # Collect all topics
    topic_map = defaultdict(lambda: {"count": 0, "examples": set()})

    for batch_result in all_batch_results:
        for topic in batch_result.get("topics", []):
            name = topic["name"].strip().lower()
            topic_map[name]["count"] += topic.get("count", 1)
            for ex in topic.get("examples", []):
                topic_map[name]["examples"].add(ex)

    # Now merge similar topics using simple heuristics
    # Build a list of canonical names
    canonical = {}
    for name in sorted(topic_map.keys()):
        merged = False
        for canon in list(canonical.keys()):
            # Check if one is a substring of the other, or very similar
            if name in canon or canon in name:
                canonical[canon]["count"] += topic_map[name]["count"]
                canonical[canon]["examples"].update(topic_map[name]["examples"])
                merged = True
                break
            # Check for word overlap (e.g., "AI safety" and "AI safety research")
            name_words = set(name.split())
            canon_words = set(canon.split())
            if len(name_words) >= 2 and len(canon_words) >= 2:
                overlap = name_words & canon_words
                if len(overlap) >= min(len(name_words), len(canon_words)):
                    # Keep the shorter name as canonical
                    if len(name) < len(canon):
                        canonical[name] = canonical.pop(canon)
                        canonical[name]["count"] += topic_map[name]["count"]
                        canonical[name]["examples"].update(topic_map[name]["examples"])
                    else:
                        canonical[canon]["count"] += topic_map[name]["count"]
                        canonical[canon]["examples"].update(topic_map[name]["examples"])
                    merged = True
                    break
        if not merged:
            canonical[name] = topic_map[name]

    # Convert to sorted list
    topics = []
    for name, data in canonical.items():
        # Title case the name
        display_name = name.title()
        examples = sorted(data["examples"])[:5]  # Limit examples
        topics.append({
            "name": display_name,
            "count": data["count"],
            "examples": examples,
        })

    topics.sort(key=lambda t: t["count"], reverse=True)
    return topics


def main():
    print("\n" + "=" * 60)
    print("AI News Intelligence Hub - Topic Analysis")
    print("=" * 60)

    # Step 1: Fetch articles
    print("\n📡 Fetching articles from Supabase...")
    articles = fetch_all_articles()

    if not articles:
        print("No articles found. Run the ingestion pipeline first.")
        sys.exit(1)

    print(f"   Found {len(articles)} articles")

    # Step 2: Split into batches and analyze
    batches = [articles[i : i + BATCH_SIZE] for i in range(0, len(articles), BATCH_SIZE)]
    total_batches = len(batches)
    print(f"\n🧠 Analyzing {total_batches} batches with Claude...")

    all_results = []
    for i, batch in enumerate(batches, 1):
        result = analyze_batch(batch, i, total_batches)
        all_results.append(result)
        topic_count = len(result.get("topics", []))
        print(f"   Batch {i}/{total_batches}: found {topic_count} topics")

    # Step 3: Merge topics across batches
    print("\n🔄 Merging and deduplicating topics...")
    merged_topics = merge_topics(all_results)
    print(f"   Found {len(merged_topics)} unique topics")

    # Step 4: Save to JSON
    output = {
        "total_articles_analyzed": len(articles),
        "total_batches": total_batches,
        "total_unique_topics": len(merged_topics),
        "topics": merged_topics,
    }

    output_path = os.path.join(os.path.dirname(__file__), "topic_analysis.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n💾 Full results saved to: {output_path}")

    # Step 5: Print summary
    print("\n" + "=" * 60)
    print("📊 TOP 30 TOPICS BY FREQUENCY")
    print("=" * 60)
    for i, topic in enumerate(merged_topics[:30], 1):
        print(f"\n  {i:2d}. {topic['name']} ({topic['count']} mentions)")
        for ex in topic["examples"][:2]:
            print(f"      → {ex[:80]}")

    # Topics with 3+ articles
    frequent = [t for t in merged_topics if t["count"] >= 3]
    print(f"\n" + "=" * 60)
    print(f"📌 TOPICS WITH 3+ MENTIONS ({len(frequent)} topics)")
    print("   These should definitely be in the keyword taxonomy:")
    print("=" * 60)
    for topic in frequent:
        print(f"   • {topic['name']} ({topic['count']})")

    # Long tail / surprising topics
    rare_interesting = [t for t in merged_topics if 1 <= t["count"] <= 2]
    if rare_interesting:
        print(f"\n" + "=" * 60)
        print(f"🔍 LESS COMMON TOPICS ({len(rare_interesting)} topics, 1-2 mentions)")
        print("   Some of these might be worth including:")
        print("=" * 60)
        for topic in rare_interesting[:20]:
            print(f"   • {topic['name']} ({topic['count']})")

    print(f"\n✅ Analysis complete! {len(merged_topics)} topics discovered from {len(articles)} articles.")


if __name__ == "__main__":
    main()
