#!/usr/bin/env python3
"""
Daily Brief Generator for AI News Intelligence Hub.

Builds the top 3 stories of the day from recently ingested articles:
  1. Cluster articles into "stories" by embedding similarity, score by
     frequency + source priority, and pick the top 3 clusters.
  2. For each cluster, ask Claude for an editorial headline, blurb, and an
     image prompt (returned as JSON).
  3. Generate a flat-design illustration with OpenAI gpt-image-1-mini and
     upload it to the public Supabase Storage bucket "brief-images".
  4. Upsert the 3 ranked briefs into the daily_briefs table.

Idempotent — safe to re-run for the same date (deterministic ids + filenames,
upsert on (brief_date, rank)).

Usage:
    python generate_daily_brief.py [--hours 24] [--date YYYY-MM-DD] [--dry-run]

Required database table (run in Supabase SQL Editor if not exists) — see
setup_daily_brief.py, and run `python setup_daily_brief.py` to create the
"brief-images" storage bucket.
"""

import argparse
import json
import logging
import math
import os
import sys
import traceback
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv(override=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BUCKET_NAME = "brief-images"
CLAUDE_MODEL = "claude-sonnet-4-5"
IMAGE_MODEL = "gpt-image-1-mini"
SIMILARITY_THRESHOLD = 0.8  # cosine similarity > 0.8  ==  distance < 0.2
PRIORITY_WEIGHTS = {"high": 3, "medium": 2, "low": 1}
IMAGE_STYLE = (
    "flat design editorial illustration, muted color palette, no text, "
    "geometric shapes, minimal"
)


# =============================================================================
# Embedding helpers
# =============================================================================

def parse_embedding(value):
    """pgvector columns may come back as a list or a stringified '[...]'."""
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return None
    return None


def mean_vector(vectors):
    """Element-wise mean of a list of equal-length vectors."""
    if not vectors:
        return None
    dims = len(vectors[0])
    acc = [0.0] * dims
    for v in vectors:
        for i in range(dims):
            acc[i] += v[i]
    n = len(vectors)
    return [x / n for x in acc]


def cosine_similarity(a, b):
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(y * y for y in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# =============================================================================
# Step 1 — cluster recent articles into ranked stories
# =============================================================================

def fetch_recent_articles(supabase, hours, target_date):
    """Return articles ingested in the window (24h, or a specific date)."""
    cols = "id, title, url, summary, source_name, source_priority, published_at, fetched_at"
    if target_date:
        day = datetime.strptime(target_date, "%Y-%m-%d").date()
        start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        resp = (
            supabase.table("articles")
            .select(cols)
            .gte("fetched_at", start.isoformat())
            .lt("fetched_at", end.isoformat())
            .execute()
        )
    else:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        resp = supabase.table("articles").select(cols).gte("fetched_at", cutoff).execute()
    return resp.data or []


def fetch_article_embeddings(supabase, article_ids, batch_size=25):
    """
    Return {article_id: representative_embedding} for the given articles.

    Uses each article's first chunk (chunk_index = 0) as its representative
    embedding. Fetching every chunk's 1536-dim vector for a day's worth of
    articles is far too much data and trips Supabase's statement timeout, so we
    pull one vector per article in small batches and skip any batch that fails.
    """
    if not article_ids:
        return {}

    by_article = {}
    for i in range(0, len(article_ids), batch_size):
        batch = article_ids[i:i + batch_size]
        try:
            resp = (
                supabase.table("chunks")
                .select("article_id, embedding")
                .eq("chunk_index", 0)
                .in_("article_id", batch)
                .execute()
            )
        except Exception as e:
            logger.warning("Embedding batch %d failed (skipping): %s", i // batch_size, e)
            continue

        for c in (resp.data or []):
            emb = parse_embedding(c.get("embedding"))
            if emb and c["article_id"] not in by_article:
                by_article[c["article_id"]] = emb

    return by_article


def cluster_articles(articles, embeddings):
    """
    Greedy clustering by embedding similarity. Articles whose mean embedding is
    within cosine distance < 0.2 (similarity > 0.8) of a cluster centroid join
    that cluster; otherwise they start a new one. Articles without embeddings
    each form their own singleton cluster.
    """
    clusters = []  # each: {"centroid": vec, "articles": [...]}
    for article in articles:
        emb = embeddings.get(article["id"])
        if emb is None:
            clusters.append({"centroid": None, "articles": [article]})
            continue

        best = None
        best_sim = SIMILARITY_THRESHOLD
        for cluster in clusters:
            if cluster["centroid"] is None:
                continue
            sim = cosine_similarity(emb, cluster["centroid"])
            if sim > best_sim:
                best_sim = sim
                best = cluster

        if best is None:
            clusters.append({"centroid": emb, "articles": [article]})
        else:
            best["articles"].append(article)
            # Recompute centroid as mean of member embeddings.
            member_embs = [embeddings[a["id"]] for a in best["articles"] if embeddings.get(a["id"])]
            best["centroid"] = mean_vector(member_embs)

    return clusters


def score_cluster(cluster):
    """Score = frequency (cluster size) + summed source-priority weight."""
    frequency = len(cluster["articles"])
    priority = sum(
        PRIORITY_WEIGHTS.get((a.get("source_priority") or "low").lower(), 1)
        for a in cluster["articles"]
    )
    return frequency + priority


def top_clusters(clusters, n=3):
    ranked = sorted(clusters, key=score_cluster, reverse=True)
    return ranked[:n]


# =============================================================================
# Step 2 — Claude editorial brief per cluster
# =============================================================================

def extract_json(text):
    """Pull a JSON object out of Claude's response (handles code fences)."""
    text = text.strip()
    if text.startswith("```"):
        # Strip ```json ... ``` fences.
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip().rstrip("`").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


def generate_brief_text(anthropic, cluster):
    """Ask Claude for {title, body, image_prompt} for one story cluster."""
    article_lines = "\n".join(
        f"- {a['title']} ({a.get('source_name', 'Unknown')}): "
        f"{(a.get('summary') or '').strip()[:400]}"
        for a in cluster["articles"][:8]
    )

    prompt = f"""You are an editor for an AI news brief. Below are articles that all cover the same story.

ARTICLES:
{article_lines}

Write a brief for this story and return ONLY a JSON object (no prose, no code fences) with exactly these keys:
{{
  "title": "compelling editorial headline, max 10 words",
  "body": "2-3 sentence summary in a neutral, journalistic tone",
  "image_prompt": "a detailed illustration prompt, ending with the exact style: {IMAGE_STYLE}"
}}"""

    response = anthropic.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    data = extract_json(text)

    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    image_prompt = (data.get("image_prompt") or "").strip()
    if not image_prompt:
        image_prompt = f"An abstract illustration of an AI news story. {IMAGE_STYLE}"
    elif IMAGE_STYLE not in image_prompt:
        image_prompt = f"{image_prompt}. {IMAGE_STYLE}"

    return {"title": title, "body": body, "image_prompt": image_prompt}


# =============================================================================
# Step 3 — illustration via OpenAI, uploaded to Supabase Storage
# =============================================================================

def generate_and_upload_image(openai_client, supabase, image_prompt, brief_date, rank):
    """Generate an illustration and upload it; return the public URL or None."""
    import base64

    try:
        result = openai_client.images.generate(
            model=IMAGE_MODEL,
            prompt=image_prompt,
            size="1024x1024",
            quality="low",
        )
        image_bytes = base64.b64decode(result.data[0].b64_json)
    except Exception as e:
        logger.error("Image generation failed for rank %d: %s", rank, e)
        return None

    filename = f"{brief_date}-rank{rank}.png"
    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            filename,
            image_bytes,
            {"content-type": "image/png", "upsert": "true"},
        )
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(filename)
        return public_url
    except Exception as e:
        logger.error("Image upload failed for rank %d: %s", rank, e)
        return None


# =============================================================================
# Orchestration
# =============================================================================

def generate_daily_brief(hours=24, dry_run=False, target_date=None):
    from supabase import create_client
    from anthropic import Anthropic
    from openai import OpenAI

    supabase_url = os.environ.get("SUPABASE_URL")
    # Uploading brief images to Storage requires the service_role key (the anon
    # key is blocked by row-level security). Prefer a service key; fall back to
    # SUPABASE_KEY (reads/DB writes still work, but image upload will be skipped).
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
    )
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    missing = [
        name for name, val in [
            ("SUPABASE_URL", supabase_url),
            ("SUPABASE_KEY/SUPABASE_SERVICE_KEY", supabase_key),
            ("OPENAI_API_KEY", openai_key),
            ("ANTHROPIC_API_KEY", anthropic_key),
        ] if not val
    ]
    if missing:
        logger.error("Missing required env vars: %s", ", ".join(missing))
        sys.exit(1)

    supabase = create_client(supabase_url, supabase_key)
    anthropic = Anthropic(api_key=anthropic_key)
    openai_client = OpenAI(api_key=openai_key)

    brief_date = (
        datetime.strptime(target_date, "%Y-%m-%d").date()
        if target_date else datetime.now(timezone.utc).date()
    )
    brief_date_str = brief_date.isoformat()

    # ── Step 1: cluster ──────────────────────────────────────────────
    logger.info("Fetching recent articles for %s...", brief_date_str)
    articles = fetch_recent_articles(supabase, hours, target_date)
    if not articles:
        logger.info("No articles ingested for %s — skipping brief.", brief_date_str)
        return

    logger.info("Found %d articles; fetching embeddings...", len(articles))
    embeddings = fetch_article_embeddings(supabase, [a["id"] for a in articles])
    clusters = cluster_articles(articles, embeddings)
    selected = top_clusters(clusters, n=3)
    logger.info("Formed %d clusters; using top %d.", len(clusters), len(selected))

    # ── Steps 2-4 per cluster ────────────────────────────────────────
    for rank, cluster in enumerate(selected, start=1):
        logger.info(
            "Rank %d: %d article(s), score %d", rank, len(cluster["articles"]), score_cluster(cluster)
        )
        brief = generate_brief_text(anthropic, cluster)
        source_article_ids = [a["id"] for a in cluster["articles"]]
        source_titles = [a["title"] for a in cluster["articles"]]
        source_names = [a.get("source_name") for a in cluster["articles"]]
        source_urls = [a.get("url") for a in cluster["articles"]]

        if dry_run:
            print(f"\n--- RANK {rank} ---")
            print(f"Title: {brief['title']}")
            print(f"Body:  {brief['body']}")
            print(f"Image prompt: {brief['image_prompt']}")
            print(f"Sources: {', '.join(source_titles)}")
            continue

        image_url = generate_and_upload_image(
            openai_client, supabase, brief["image_prompt"], brief_date_str, rank
        )

        row = {
            "id": f"{brief_date_str}-rank{rank}",
            "brief_date": brief_date_str,
            "rank": rank,
            "title": brief["title"],
            "body": brief["body"],
            "image_url": image_url,
            "image_prompt": brief["image_prompt"],
            "source_article_ids": source_article_ids,
            "source_titles": source_titles,
            "source_names": source_names,
            "source_urls": source_urls,
        }
        supabase.table("daily_briefs").upsert(row, on_conflict="brief_date,rank").execute()
        logger.info("Saved rank %d brief (image_url=%s)", rank, "yes" if image_url else "none")

    if not dry_run:
        logger.info("Daily brief complete for %s (%d stories).", brief_date_str, len(selected))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate the daily AI news brief")
    parser.add_argument("--hours", type=int, default=24, help="Hours to look back (default: 24)")
    parser.add_argument("--date", help="Backfill: generate for a specific date (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing")
    args = parser.parse_args()

    try:
        generate_daily_brief(hours=args.hours, dry_run=args.dry_run, target_date=args.date)
    except Exception as e:
        logger.error("Fatal error generating daily brief: %s", e)
        traceback.print_exc()
        sys.exit(1)
