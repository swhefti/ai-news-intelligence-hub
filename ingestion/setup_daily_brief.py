#!/usr/bin/env python3
"""
One-time setup for the Daily Brief feature.

Creates the public Supabase Storage bucket used for brief illustrations and
verifies the daily_briefs table exists (printing the CREATE TABLE SQL to paste
into the Supabase SQL Editor if it does not — DDL cannot be run via the API).

Usage:
    python setup_daily_brief.py

Required database table (run in Supabase SQL Editor if not exists):

    CREATE TABLE IF NOT EXISTS daily_briefs (
      id TEXT PRIMARY KEY,
      brief_date DATE NOT NULL,
      rank INTEGER NOT NULL CHECK (rank IN (1, 2, 3)),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      image_url TEXT,
      image_prompt TEXT,
      source_article_ids JSONB DEFAULT '[]',
      source_titles JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(brief_date, rank)
    );
    CREATE INDEX IF NOT EXISTS daily_briefs_date_idx ON daily_briefs(brief_date DESC);
"""

import logging
import os
import sys

from dotenv import load_dotenv

load_dotenv(override=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BUCKET_NAME = "brief-images"

TABLE_SQL = """\
CREATE TABLE IF NOT EXISTS daily_briefs (
  id TEXT PRIMARY KEY,
  brief_date DATE NOT NULL,
  rank INTEGER NOT NULL CHECK (rank IN (1, 2, 3)),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  image_prompt TEXT,
  source_article_ids JSONB DEFAULT '[]',
  source_titles JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brief_date, rank)
);
CREATE INDEX IF NOT EXISTS daily_briefs_date_idx ON daily_briefs(brief_date DESC);
"""


def ensure_bucket(supabase) -> None:
    """Create the public brief-images bucket, ignoring 'already exists'."""
    try:
        supabase.storage.create_bucket(BUCKET_NAME, options={"public": True})
        logger.info("Created public bucket '%s'", BUCKET_NAME)
    except Exception as e:
        msg = str(e).lower()
        if "already exists" in msg or "duplicate" in msg or "resource already" in msg:
            logger.info("Bucket '%s' already exists — OK", BUCKET_NAME)
        else:
            logger.error("Failed to create bucket '%s': %s", BUCKET_NAME, e)
            raise


def ensure_table(supabase) -> bool:
    """Verify daily_briefs exists; print the CREATE TABLE SQL if missing."""
    try:
        supabase.table("daily_briefs").select("id").limit(1).execute()
        logger.info("Table 'daily_briefs' exists — OK")
        return True
    except Exception as e:
        msg = str(e).lower()
        if "does not exist" in msg or "relation" in msg:
            logger.warning(
                "Table 'daily_briefs' does not exist. Run this SQL in the "
                "Supabase SQL Editor:\n\n%s",
                TABLE_SQL,
            )
            return False
        logger.warning("Could not verify table exists: %s", e)
        return True


def main() -> None:
    from supabase import create_client

    supabase_url = os.environ.get("SUPABASE_URL")
    # Bucket creation requires the service_role key (the anon key is blocked by
    # row-level security). Prefer a service key; fall back to SUPABASE_KEY.
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
    )
    if not supabase_url or not supabase_key:
        logger.error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env vars")
        sys.exit(1)

    supabase = create_client(supabase_url, supabase_key)

    ensure_bucket(supabase)
    table_ok = ensure_table(supabase)

    if table_ok:
        logger.info("Daily Brief setup complete.")
    else:
        logger.info("Bucket ready; create the table (SQL above), then re-run to confirm.")


if __name__ == "__main__":
    main()
