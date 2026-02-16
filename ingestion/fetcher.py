"""
RSS Feed Fetcher for AI News Intelligence Hub.

This module handles:
- Fetching RSS feeds from configured sources
- Parsing feed entries into a standardized format
- Extracting full article content when possible
- Handling errors and retries gracefully
"""

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

import feedparser
import requests
from bs4 import BeautifulSoup

from config import RSS_FEEDS, INGESTION_CONFIG

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class Article:
    """Standardized article structure."""
    id: str  # Unique hash of URL
    title: str
    url: str
    content: str  # Full text content
    summary: str  # Short summary/description
    published_at: Optional[datetime]
    source_name: str
    source_category: str
    source_priority: str
    authors: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    fetched_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "content": self.content,
            "summary": self.summary,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "source_name": self.source_name,
            "source_category": self.source_category,
            "source_priority": self.source_priority,
            "authors": self.authors,
            "tags": self.tags,
            "fetched_at": self.fetched_at.isoformat(),
        }


def generate_article_id(url: str) -> str:
    """Generate a unique ID for an article based on its URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


# =============================================================================
# CONTENT EXTRACTION
# =============================================================================

def extract_content_from_html(html: str) -> str:
    """
    Extract clean text content from HTML.
    
    Uses BeautifulSoup to:
    - Remove scripts, styles, and navigation
    - Extract main content
    - Clean up whitespace
    """
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove unwanted elements
    for element in soup(['script', 'style', 'nav', 'header', 'footer', 
                         'aside', 'form', 'iframe', 'noscript']):
        element.decompose()
    
    # Try to find main content area
    main_content = (
        soup.find('article') or 
        soup.find('main') or 
        soup.find('div', class_='content') or
        soup.find('div', class_='post') or
        soup.find('div', class_='entry') or
        soup.body or
        soup
    )
    
    # Get text and clean whitespace
    text = main_content.get_text(separator=' ', strip=True)
    
    # Normalize whitespace
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    text = '\n'.join(lines)
    
    return text


def fetch_full_content(url: str, timeout: int = 10) -> Optional[str]:
    """
    Fetch and extract full article content from a URL.
    
    Returns None if fetching fails.
    """
    try:
        headers = {
            'User-Agent': 'AI-News-Hub/1.0 (Educational Project)'
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        return extract_content_from_html(response.text)
        
    except requests.RequestException as e:
        logger.warning(f"Failed to fetch full content from {url}: {e}")
        return None


# =============================================================================
# RSS FEED PARSING  
# =============================================================================

def parse_published_date(entry: dict) -> Optional[datetime]:
    """Parse the published date from a feed entry."""
    # feedparser provides parsed dates in 'published_parsed' or 'updated_parsed'
    date_tuple = entry.get('published_parsed') or entry.get('updated_parsed')
    
    if date_tuple:
        try:
            return datetime(*date_tuple[:6])
        except (TypeError, ValueError):
            pass
    
    return None


def parse_feed_entry(entry: dict, source: dict, fetch_full: bool = False) -> Optional[Article]:
    """
    Parse a single feed entry into an Article.
    
    Args:
        entry: The feedparser entry dict
        source: The source configuration dict
        fetch_full: Whether to fetch full article content from URL
    
    Returns:
        Article object or None if parsing fails
    """
    try:
        url = entry.get('link', '')
        if not url:
            return None
            
        # Get content - try multiple fields
        content = ''
        
        # Try content field (some feeds include full content)
        if 'content' in entry and entry['content']:
            content = entry['content'][0].get('value', '')
            content = extract_content_from_html(content)
        
        # Try summary/description
        summary = entry.get('summary', '') or entry.get('description', '')
        if summary:
            summary = extract_content_from_html(summary)
        
        # If content is empty or too short, use summary
        if len(content) < 200:
            content = summary
            
        # Optionally fetch full content from URL
        if fetch_full and len(content) < 500:
            full_content = fetch_full_content(url)
            if full_content and len(full_content) > len(content):
                content = full_content
        
        # Extract authors
        authors = []
        if 'author' in entry:
            authors = [entry['author']]
        elif 'authors' in entry:
            authors = [a.get('name', '') for a in entry['authors'] if a.get('name')]
        
        # Extract tags/categories
        tags = []
        if 'tags' in entry:
            tags = [t.get('term', '') for t in entry['tags'] if t.get('term')]
        
        return Article(
            id=generate_article_id(url),
            title=entry.get('title', 'Untitled'),
            url=url,
            content=content,
            summary=summary[:500] if summary else content[:500],
            published_at=parse_published_date(entry),
            source_name=source['name'],
            source_category=source['category'],
            source_priority=source['priority'],
            authors=authors,
            tags=tags,
        )
        
    except Exception as e:
        logger.error(f"Failed to parse entry: {e}")
        return None


def fetch_feed(source: dict, max_articles: int = None, fetch_full: bool = False) -> list[Article]:
    """
    Fetch and parse articles from a single RSS feed.
    
    Args:
        source: Source configuration dict with 'name', 'url', 'category', 'priority'
        max_articles: Maximum articles to fetch (default from config)
        fetch_full: Whether to fetch full content from article URLs
    
    Returns:
        List of Article objects
    """
    max_articles = max_articles or INGESTION_CONFIG.max_articles_per_feed
    
    logger.info(f"Fetching feed: {source['name']}")
    
    try:
        feed = feedparser.parse(source['url'])
        
        if feed.bozo and feed.bozo_exception:
            logger.warning(f"Feed parsing warning for {source['name']}: {feed.bozo_exception}")
        
        articles = []
        for entry in feed.entries[:max_articles]:
            article = parse_feed_entry(entry, source, fetch_full=fetch_full)
            if article and article.content:  # Only include articles with content
                articles.append(article)
        
        logger.info(f"Fetched {len(articles)} articles from {source['name']}")
        return articles
        
    except Exception as e:
        logger.error(f"Failed to fetch feed {source['name']}: {e}")
        return []


def fetch_all_feeds(
    feeds: list[dict] = None, 
    fetch_full: bool = False,
    categories: list[str] = None,
    priorities: list[str] = None,
) -> list[Article]:
    """
    Fetch articles from all configured RSS feeds.
    
    Args:
        feeds: List of feed configs (default: RSS_FEEDS from config)
        fetch_full: Whether to fetch full content from article URLs
        categories: Filter to only these categories
        priorities: Filter to only these priorities
    
    Returns:
        List of all Article objects
    """
    feeds = feeds or RSS_FEEDS
    
    # Apply filters
    if categories:
        feeds = [f for f in feeds if f['category'] in categories]
    if priorities:
        feeds = [f for f in feeds if f['priority'] in priorities]
    
    all_articles = []
    
    for source in feeds:
        articles = fetch_feed(source, fetch_full=fetch_full)
        all_articles.extend(articles)
    
    # Sort by published date (newest first)
    all_articles.sort(
        key=lambda a: a.published_at or datetime.min, 
        reverse=True
    )
    
    logger.info(f"Total articles fetched: {len(all_articles)}")
    return all_articles


# =============================================================================
# MAIN EXECUTION (for testing)
# =============================================================================

if __name__ == "__main__":
    # Test fetching a single feed
    print("\n" + "="*60)
    print("Testing RSS Feed Fetcher")
    print("="*60 + "\n")
    
    # Fetch from high-priority AI company feeds only
    articles = fetch_all_feeds(
        priorities=["high"],
        categories=["ai_company", "tech_news"],
    )
    
    print(f"\nFetched {len(articles)} articles total\n")
    
    # Show first 5 articles
    for i, article in enumerate(articles[:5]):
        print(f"{i+1}. [{article.source_name}] {article.title}")
        print(f"   URL: {article.url}")
        print(f"   Published: {article.published_at}")
        print(f"   Content length: {len(article.content)} chars")
        print()
