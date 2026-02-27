"""
Configuration for AI News Intelligence Hub ingestion pipeline.

This file contains:
- RSS feed sources
- Chunking parameters
- Database settings
"""

import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# =============================================================================
# RSS FEED SOURCES
# =============================================================================
# Each source has a name, URL, and category for filtering/analytics

RSS_FEEDS = [
    # Major AI Companies
    {
        "name": "Anthropic Blog",
        "url": "https://www.anthropic.com/rss.xml",
        "category": "ai_company",
        "priority": "high"
    },
    {
        "name": "OpenAI Blog", 
        "url": "https://openai.com/blog/rss.xml",
        "category": "ai_company",
        "priority": "high"
    },
    {
        "name": "Google AI Blog",
        "url": "https://blog.google/technology/ai/rss/",
        "category": "ai_company",
        "priority": "high"
    },
    {
        "name": "Meta AI Blog",
        "url": "https://ai.meta.com/blog/rss/",
        "category": "ai_company",
        "priority": "high"
    },
    {
        "name": "Microsoft AI Blog",
        "url": "https://techcommunity.microsoft.com/t5/s/gxcuf89792/rss/board?board.id=AIPlatformBlog",
        "category": "ai_company",
        "priority": "medium"
    },
    
    # Tech News
    {
        "name": "TechCrunch AI",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "category": "tech_news",
        "priority": "high"
    },
    {
        "name": "The Verge AI",
        "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "category": "tech_news",
        "priority": "medium"
    },
    {
        "name": "Ars Technica AI",
        "url": "https://feeds.arstechnica.com/arstechnica/technology-lab",
        "category": "tech_news",
        "priority": "medium"
    },
    {
        "name": "MIT Technology Review AI",
        "url": "https://www.technologyreview.com/feed/",
        "category": "tech_news",
        "priority": "high"
    },
    
    # Research & Academic
    {
        "name": "arXiv cs.AI",
        "url": "https://rss.arxiv.org/rss/cs.AI",
        "category": "research",
        "priority": "medium"
    },
    {
        "name": "arXiv cs.LG",
        "url": "https://rss.arxiv.org/rss/cs.LG",
        "category": "research", 
        "priority": "medium"
    },
    
    # Additional Tech News & Analysis
    {
        "name": "VentureBeat AI",
        "url": "https://venturebeat.com/category/ai/feed/",
        "category": "tech_news",
        "priority": "high"
    },
    {
        "name": "MarkTechPost",
        "url": "https://marktechpost.com/feed",
        "category": "tech_news",
        "priority": "medium"
    },
    {
        "name": "Unite.AI",
        "url": "https://www.unite.ai/feed/",
        "category": "tech_news",
        "priority": "medium"
    },
    {
        "name": "MIT News AI",
        "url": "https://news.mit.edu/rss/topic/artificial-intelligence",
        "category": "research",
        "priority": "high"
    },
    {
        "name": "Hugging Face Blog",
        "url": "https://huggingface.co/blog/feed.xml",
        "category": "ai_company",
        "priority": "high"
    },

    # Independent Analysis & Newsletters
    {
        "name": "Simon Willison's Blog",
        "url": "https://simonwillison.net/atom/everything",
        "category": "community",
        "priority": "high"
    },
    {
        "name": "The Batch",
        "url": "https://www.deeplearning.ai/the-batch/feed/",
        "category": "tech_news",
        "priority": "high"
    },
    {
        "name": "Google DeepMind Blog",
        "url": "https://deepmind.google/blog/rss.xml",
        "category": "research",
        "priority": "high"
    },
    {
        "name": "Nvidia AI Blog",
        "url": "https://blogs.nvidia.com/feed/",
        "category": "ai_company",
        "priority": "high"
    },

    # Community & Analysis
    {
        "name": "Hacker News",
        "url": "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+Claude+OR+machine+learning",
        "category": "community",
        "priority": "low"
    },

    # Newsletters & Independent Analysis
    {
        "name": "Import AI",
        "url": "https://importai.substack.com/feed",
        "category": "community",
        "priority": "high"
    },
    {
        "name": "The Gradient",
        "url": "https://thegradient.pub/rss/",
        "category": "research",
        "priority": "high"
    },
    {
        "name": "AI Snake Oil",
        "url": "https://aisnakeoil.substack.com/feed",
        "category": "community",
        "priority": "high"
    },
    {
        "name": "Wired AI",
        "url": "https://www.wired.com/feed/tag/ai/latest/rss",
        "category": "tech_news",
        "priority": "high"
    },
]

# =============================================================================
# CHUNKING CONFIGURATION
# =============================================================================
# Settings for how articles are split into chunks for embedding

@dataclass
class ChunkConfig:
    """Configuration for text chunking."""
    chunk_size: int = 1000  # Target characters per chunk
    chunk_overlap: int = 200  # Overlap between chunks for context
    min_chunk_size: int = 100  # Minimum chunk size to keep
    
CHUNK_CONFIG = ChunkConfig()

# =============================================================================
# EMBEDDING CONFIGURATION
# =============================================================================

@dataclass
class EmbeddingConfig:
    """Configuration for embedding generation."""
    model: str = "text-embedding-3-small"  # OpenAI embedding model
    dimensions: int = 1536  # Embedding dimensions
    batch_size: int = 100  # Articles to embed at once
    
EMBEDDING_CONFIG = EmbeddingConfig()

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================

@dataclass
class DatabaseConfig:
    """Configuration for Supabase connection."""
    url: Optional[str] = None
    key: Optional[str] = None
    
    def __post_init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        
    @property
    def is_configured(self) -> bool:
        return bool(self.url and self.key)

DATABASE_CONFIG = DatabaseConfig()

# =============================================================================
# API KEYS
# =============================================================================

@dataclass  
class APIConfig:
    """Configuration for external APIs."""
    openai_key: Optional[str] = None
    anthropic_key: Optional[str] = None
    
    def __post_init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")

API_CONFIG = APIConfig()

# =============================================================================
# INGESTION SETTINGS
# =============================================================================

@dataclass
class IngestionConfig:
    """Configuration for the ingestion process."""
    max_articles_per_feed: int = 25  # Limit per feed per run (cap to balance sources)
    days_to_keep: int = 90  # How long to retain articles
    update_interval_hours: int = 6  # How often to check for new articles
    
INGESTION_CONFIG = IngestionConfig()
