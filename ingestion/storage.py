"""
Storage for AI News Intelligence Hub.

This module handles:
- Supabase connection and setup
- Storing articles and embedded chunks
- Vector similarity search using pgvector
"""

import logging
import json
from typing import Optional
from datetime import datetime

from config import DATABASE_CONFIG, EMBEDDING_CONFIG

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# DATABASE SCHEMA (for reference and setup)
# =============================================================================

SCHEMA_SQL = """
-- Enable pgvector extension (run this first in Supabase SQL editor)
CREATE EXTENSION IF NOT EXISTS vector;

-- Articles table (stores original article metadata)
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

-- Chunks table with embeddings (for RAG)
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    article_id TEXT REFERENCES articles(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small dimensions
    article_title TEXT,
    article_url TEXT,
    source_name TEXT,
    source_category TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx 
ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS chunks_source_idx ON chunks(source_name);
CREATE INDEX IF NOT EXISTS chunks_category_idx ON chunks(source_category);
CREATE INDEX IF NOT EXISTS chunks_published_idx ON chunks(published_at DESC);

-- Index for articles
CREATE INDEX IF NOT EXISTS articles_source_idx ON articles(source_name);
CREATE INDEX IF NOT EXISTS articles_published_idx ON articles(published_at DESC);

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    filter_source text DEFAULT NULL,
    filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id text,
    article_id text,
    chunk_index int,
    text text,
    article_title text,
    article_url text,
    source_name text,
    source_category text,
    published_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.article_id,
        c.chunk_index,
        c.text,
        c.article_title,
        c.article_url,
        c.source_name,
        c.source_category,
        c.published_at,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    WHERE 
        1 - (c.embedding <=> query_embedding) > match_threshold
        AND (filter_source IS NULL OR c.source_name = filter_source)
        AND (filter_category IS NULL OR c.source_category = filter_category)
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
"""


# =============================================================================
# SUPABASE STORAGE CLASS
# =============================================================================

class SupabaseStorage:
    """
    Handles all database operations with Supabase.
    
    Usage:
        storage = SupabaseStorage()
        storage.store_articles(articles)
        storage.store_embedded_chunks(chunks)
        results = storage.search_similar(query_embedding)
    """
    
    def __init__(self, url: str = None, key: str = None):
        """
        Initialize Supabase connection.
        
        Args:
            url: Supabase project URL
            key: Supabase API key (anon or service role)
        """
        self.url = url or DATABASE_CONFIG.url
        self.key = key or DATABASE_CONFIG.key
        self.client = None
        
        if not self.url or not self.key:
            logger.warning(
                "Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY environment variables."
            )
    
    def _get_client(self):
        """Lazy initialization of Supabase client."""
        if self.client is None:
            try:
                from supabase import create_client
                self.client = create_client(self.url, self.key)
            except ImportError:
                raise ImportError("Please install supabase: pip install supabase")
        return self.client
    
    @property
    def is_configured(self) -> bool:
        """Check if Supabase is properly configured."""
        return bool(self.url and self.key)
    
    def get_schema_sql(self) -> str:
        """Return the SQL schema for setting up the database."""
        return SCHEMA_SQL
    
    # -------------------------------------------------------------------------
    # Article Operations
    # -------------------------------------------------------------------------
    
    def store_article(self, article) -> bool:
        """
        Store a single article.
        
        Args:
            article: Article object
        
        Returns:
            True if successful
        """
        client = self._get_client()
        
        data = {
            "id": article.id,
            "title": article.title,
            "url": article.url,
            "content": article.content,
            "summary": article.summary,
            "published_at": article.published_at.isoformat() if article.published_at else None,
            "source_name": article.source_name,
            "source_category": article.source_category,
            "source_priority": article.source_priority,
            "authors": json.dumps(article.authors),
            "tags": json.dumps(article.tags),
            "fetched_at": article.fetched_at.isoformat(),
        }
        
        try:
            # Upsert (insert or update)
            result = client.table("articles").upsert(data).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to store article {article.id}: {e}")
            return False
    
    def store_articles(self, articles: list) -> int:
        """
        Store multiple articles.
        
        Args:
            articles: List of Article objects
        
        Returns:
            Number of successfully stored articles
        """
        success_count = 0
        
        for article in articles:
            if self.store_article(article):
                success_count += 1
        
        logger.info(f"Stored {success_count}/{len(articles)} articles")
        return success_count
    
    def get_existing_article_ids(self) -> set[str]:
        """Get set of article IDs already in database."""
        client = self._get_client()
        
        try:
            result = client.table("articles").select("id").execute()
            return {row["id"] for row in result.data}
        except Exception as e:
            logger.error(f"Failed to get existing article IDs: {e}")
            return set()
    
    # -------------------------------------------------------------------------
    # Chunk Operations
    # -------------------------------------------------------------------------
    
    def store_embedded_chunk(self, chunk) -> bool:
        """
        Store a single embedded chunk.
        
        Args:
            chunk: EmbeddedChunk object
        
        Returns:
            True if successful
        """
        client = self._get_client()
        
        data = {
            "id": chunk.chunk_id,
            "article_id": chunk.article_id,
            "chunk_index": chunk.chunk_index,
            "text": chunk.text,
            "embedding": chunk.embedding,  # Supabase handles vector conversion
            "article_title": chunk.article_title,
            "article_url": chunk.article_url,
            "source_name": chunk.source_name,
            "source_category": chunk.source_category,
            "published_at": chunk.published_at,
        }
        
        try:
            result = client.table("chunks").upsert(data).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to store chunk {chunk.chunk_id}: {e}")
            return False
    
    def store_embedded_chunks(self, chunks: list) -> int:
        """
        Store multiple embedded chunks.
        
        Args:
            chunks: List of EmbeddedChunk objects
        
        Returns:
            Number of successfully stored chunks
        """
        success_count = 0
        
        for chunk in chunks:
            if self.store_embedded_chunk(chunk):
                success_count += 1
        
        logger.info(f"Stored {success_count}/{len(chunks)} chunks")
        return success_count
    
    # -------------------------------------------------------------------------
    # Search Operations
    # -------------------------------------------------------------------------
    
    def search_similar(
        self,
        query_embedding: list[float],
        match_count: int = 10,
        match_threshold: float = 0.7,
        source_name: str = None,
        source_category: str = None,
    ) -> list[dict]:
        """
        Search for chunks similar to a query embedding.
        
        Args:
            query_embedding: The query vector
            match_count: Maximum number of results
            match_threshold: Minimum similarity score (0-1)
            source_name: Filter by source name
            source_category: Filter by source category
        
        Returns:
            List of matching chunks with similarity scores
        """
        client = self._get_client()
        
        try:
            # Call the match_chunks function
            result = client.rpc(
                "match_chunks",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": match_threshold,
                    "match_count": match_count,
                    "filter_source": source_name,
                    "filter_category": source_category,
                }
            ).execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    # -------------------------------------------------------------------------
    # Analytics / Stats
    # -------------------------------------------------------------------------
    
    def get_stats(self) -> dict:
        """Get database statistics."""
        client = self._get_client()
        
        try:
            # Count articles
            articles_result = client.table("articles").select("id", count="exact").execute()
            article_count = articles_result.count
            
            # Count chunks
            chunks_result = client.table("chunks").select("id", count="exact").execute()
            chunk_count = chunks_result.count
            
            # Get source breakdown
            source_result = client.table("articles").select("source_name").execute()
            source_counts = {}
            for row in source_result.data:
                source = row["source_name"]
                source_counts[source] = source_counts.get(source, 0) + 1
            
            return {
                "total_articles": article_count,
                "total_chunks": chunk_count,
                "sources": source_counts,
            }
            
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {}


# =============================================================================
# LOCAL STORAGE (for testing without Supabase)
# =============================================================================

class LocalStorage:
    """
    Local JSON-based storage for testing.
    Stores data in local files instead of Supabase.
    """
    
    def __init__(self, data_dir: str = "./data"):
        import os
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        
        self.articles_file = f"{data_dir}/articles.json"
        self.chunks_file = f"{data_dir}/chunks.json"
        
        # Initialize files if they don't exist
        for file in [self.articles_file, self.chunks_file]:
            if not os.path.exists(file):
                with open(file, 'w') as f:
                    json.dump([], f)
    
    def _load_json(self, filepath: str) -> list:
        with open(filepath, 'r') as f:
            return json.load(f)
    
    def _save_json(self, filepath: str, data: list):
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
    
    def store_articles(self, articles: list) -> int:
        """Store articles to local JSON."""
        existing = self._load_json(self.articles_file)
        existing_ids = {a["id"] for a in existing}
        
        new_articles = []
        for article in articles:
            article_dict = article.to_dict()
            if article_dict["id"] not in existing_ids:
                new_articles.append(article_dict)
        
        existing.extend(new_articles)
        self._save_json(self.articles_file, existing)
        
        logger.info(f"Stored {len(new_articles)} new articles locally")
        return len(new_articles)
    
    def store_embedded_chunks(self, chunks: list) -> int:
        """Store chunks to local JSON."""
        existing = self._load_json(self.chunks_file)
        existing_ids = {c["chunk_id"] for c in existing}
        
        new_chunks = []
        for chunk in chunks:
            chunk_dict = chunk.to_dict()
            if chunk_dict["chunk_id"] not in existing_ids:
                new_chunks.append(chunk_dict)
        
        existing.extend(new_chunks)
        self._save_json(self.chunks_file, existing)
        
        logger.info(f"Stored {len(new_chunks)} new chunks locally")
        return len(new_chunks)
    
    def search_similar(
        self,
        query_embedding: list[float],
        match_count: int = 10,
        match_threshold: float = 0.7,
        **kwargs
    ) -> list[dict]:
        """Search using cosine similarity."""
        import math
        
        def cosine_similarity(a, b):
            dot_product = sum(x * y for x, y in zip(a, b))
            magnitude_a = math.sqrt(sum(x * x for x in a))
            magnitude_b = math.sqrt(sum(y * y for y in b))
            if magnitude_a == 0 or magnitude_b == 0:
                return 0
            return dot_product / (magnitude_a * magnitude_b)
        
        chunks = self._load_json(self.chunks_file)
        
        # Calculate similarities
        results = []
        for chunk in chunks:
            if "embedding" in chunk and chunk["embedding"]:
                similarity = cosine_similarity(query_embedding, chunk["embedding"])
                if similarity >= match_threshold:
                    results.append({
                        **chunk,
                        "similarity": similarity
                    })
        
        # Sort by similarity and limit
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:match_count]
    
    def get_stats(self) -> dict:
        """Get local storage statistics."""
        articles = self._load_json(self.articles_file)
        chunks = self._load_json(self.chunks_file)
        
        source_counts = {}
        for article in articles:
            source = article.get("source_name", "unknown")
            source_counts[source] = source_counts.get(source, 0) + 1
        
        return {
            "total_articles": len(articles),
            "total_chunks": len(chunks),
            "sources": source_counts,
        }


# =============================================================================
# FACTORY FUNCTION
# =============================================================================

def get_storage(use_local: bool = False) -> SupabaseStorage | LocalStorage:
    """
    Get a storage instance.
    
    Args:
        use_local: If True, use local JSON storage instead of Supabase
    
    Returns:
        Storage instance
    """
    if use_local or not DATABASE_CONFIG.is_configured:
        logger.info("Using local storage")
        return LocalStorage()
    else:
        logger.info("Using Supabase storage")
        return SupabaseStorage()


# =============================================================================
# MAIN EXECUTION (for testing / setup)
# =============================================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("Database Setup Instructions")
    print("="*60 + "\n")
    
    print("To set up your Supabase database, run the following SQL")
    print("in your Supabase SQL Editor:\n")
    print("-"*60)
    print(SCHEMA_SQL)
    print("-"*60)
    
    print("\nAfter running the SQL, set these environment variables:")
    print("  SUPABASE_URL=your-project-url")
    print("  SUPABASE_KEY=your-anon-or-service-key")
    
    # Test local storage
    print("\n" + "="*60)
    print("Testing Local Storage")
    print("="*60 + "\n")
    
    storage = LocalStorage(data_dir="./test_data")
    
    stats = storage.get_stats()
    print(f"Current stats: {stats}")
