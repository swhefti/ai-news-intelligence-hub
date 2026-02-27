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
from taxonomy import TAXONOMY

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Minimum content length to consider an article "complete" from RSS alone
MIN_RSS_CONTENT_LENGTH = 500

# Build a flat set of all taxonomy terms (lowercase) for relevance scoring
_RELEVANCE_TERMS: set[str] = set()
for _synonyms in TAXONOMY.values():
    for _term in _synonyms:
        _RELEVANCE_TERMS.add(_term.lower())

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
    keywords: list[str] = field(default_factory=list)
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
            "keywords": self.keywords,
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


def fetch_full_content(url: str, timeout: int = 15) -> Optional[str]:
    """
    Fetch and extract full article content from a URL.

    Uses site-specific selectors for known sources, then falls back
    to generic article/main content extraction.

    Returns None if fetching fails.
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                          'AppleWebKit/537.36 (KHTML, like Gecko) '
                          'Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer',
                             'aside', 'form', 'iframe', 'noscript',
                             'figure', 'figcaption']):
            element.decompose()

        # Remove common non-content elements by class/id patterns
        for element in soup.find_all(class_=lambda c: c and any(
            x in str(c).lower() for x in [
                'sidebar', 'comment', 'social', 'share', 'related',
                'newsletter', 'subscribe', 'advertisement', 'promo',
                'cookie', 'popup', 'modal', 'menu', 'breadcrumb',
            ]
        )):
            element.decompose()

        # Try site-specific selectors first
        domain = urlparse(url).netloc.lower()
        article = None

        # TechCrunch
        if 'techcrunch.com' in domain:
            article = soup.find('div', class_='article-content') or soup.find('article')
        # The Verge
        elif 'theverge.com' in domain:
            article = soup.find('div', class_='duet--article--article-body-component') or soup.find('article')
        # MIT Technology Review
        elif 'technologyreview.com' in domain:
            article = soup.find('div', class_='body--content') or soup.find('article')
        # OpenAI Blog
        elif 'openai.com' in domain:
            article = soup.find('div', class_='ui-rich-text') or soup.find('article') or soup.find('main')
        # Simon Willison
        elif 'simonwillison.net' in domain:
            article = soup.find('div', class_='entry-content') or soup.find('article')
        # VentureBeat
        elif 'venturebeat.com' in domain:
            article = soup.find('div', class_='article-content') or soup.find('article')
        # MarkTechPost
        elif 'marktechpost.com' in domain:
            article = soup.find('div', class_='entry-content') or soup.find('article')
        # Nvidia
        elif 'nvidia.com' in domain:
            article = soup.find('div', class_='entry-content') or soup.find('article')
        # Microsoft
        elif 'microsoft.com' in domain or 'blogs.microsoft.com' in domain:
            article = soup.find('div', class_='entry-content') or soup.find('article')
        # Hacker News links
        elif 'ycombinator.com' in domain:
            article = soup.find('article') or soup.find('main')
        # Substack (Import AI, AI Snake Oil, etc.)
        elif 'substack.com' in domain:
            article = soup.find('div', class_='body') or soup.find('div', class_='post-content') or soup.find('article')
        # Wired
        elif 'wired.com' in domain:
            article = soup.find('div', class_='body__inner-container') or soup.find('article')
        # The Gradient
        elif 'thegradient.pub' in domain:
            article = soup.find('div', class_='post-content') or soup.find('article')
        # Reuters
        elif 'reuters.com' in domain:
            article = soup.find('div', class_='article-body__content') or soup.find('article')

        # Generic fallback selectors
        if not article:
            article = (
                soup.find('article') or
                soup.find('div', class_='article-content') or
                soup.find('div', class_='article-body') or
                soup.find('div', class_='post-content') or
                soup.find('div', class_='entry-content') or
                soup.find('div', class_='content-body') or
                soup.find('div', {'role': 'article'}) or
                soup.find('main') or
                soup.find('div', class_='content')
            )

        if article:
            text = article.get_text(separator='\n', strip=True)
        else:
            # Last resort: get body text
            body = soup.find('body')
            if body:
                text = body.get_text(separator='\n', strip=True)
            else:
                return None

        # Clean up extracted text
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        text = '\n'.join(lines)

        # Limit to reasonable length (some pages have tons of boilerplate)
        if len(text) > 15000:
            text = text[:15000]

        return text if len(text) > 100 else None

    except requests.RequestException as e:
        logger.warning(f"Failed to fetch full content from {url}: {e}")
        return None
    except Exception as e:
        logger.warning(f"Error extracting content from {url}: {e}")
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


def parse_feed_entry(entry: dict, source: dict, fetch_full: bool = True) -> Optional[Article]:
    """
    Parse a single feed entry into an Article.

    Args:
        entry: The feedparser entry dict
        source: The source configuration dict
        fetch_full: Whether to fetch full article content from URL
                    (defaults to True — most RSS feeds only provide summaries)

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

        # Fetch full content from URL if RSS content is too short
        if fetch_full and len(content) < MIN_RSS_CONTENT_LENGTH:
            logger.info(f"  Content too short ({len(content)} chars), fetching from URL: {url[:80]}...")
            full_content = fetch_full_content(url)
            if full_content and len(full_content) > len(content):
                logger.info(f"  → Got {len(full_content)} chars from URL (was {len(content)})")
                content = full_content
            else:
                logger.info(f"  → URL fetch returned {'nothing' if not full_content else f'{len(full_content)} chars (not better)'}")

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


def _score_entry_relevance(entry: dict) -> int:
    """
    Score an RSS entry by relevance to our keyword taxonomy.

    Checks title and summary against all taxonomy terms.
    Higher score = more relevant to our tracked topics.
    Returns count of matching terms (0 = no known-topic matches).
    """
    text = (
        (entry.get("title", "") or "")
        + " "
        + (entry.get("summary", "") or "")
    ).lower()

    score = 0
    for term in _RELEVANCE_TERMS:
        if term in text:
            score += 1
    return score


def fetch_feed(source: dict, max_articles: int = None, fetch_full: bool = True) -> list[Article]:
    """
    Fetch and parse articles from a single RSS feed.

    When the feed has more entries than max_articles, entries are ranked
    by relevance to our keyword taxonomy so we keep the most topical ones.

    Args:
        source: Source configuration dict with 'name', 'url', 'category', 'priority'
        max_articles: Maximum articles to fetch (default from config)
        fetch_full: Whether to fetch full content from article URLs (default True)

    Returns:
        List of Article objects
    """
    max_articles = max_articles or INGESTION_CONFIG.max_articles_per_feed

    logger.info(f"Fetching feed: {source['name']}")

    try:
        feed = feedparser.parse(source['url'])

        if feed.bozo and feed.bozo_exception:
            logger.warning(f"Feed parsing warning for {source['name']}: {feed.bozo_exception}")

        entries = feed.entries

        # If more entries than our cap, rank by relevance and keep the best
        if len(entries) > max_articles:
            logger.info(f"  {source['name']} has {len(entries)} entries, selecting top {max_articles} by relevance")
            scored = [(e, _score_entry_relevance(e)) for e in entries]
            scored.sort(key=lambda x: x[1], reverse=True)
            entries = [e for e, _ in scored[:max_articles]]

        articles = []
        skipped_empty = 0
        for entry in entries:
            article = parse_feed_entry(entry, source, fetch_full=fetch_full)
            if article and article.content:  # Only include articles with content
                articles.append(article)
            else:
                skipped_empty += 1

        if skipped_empty > 0:
            logger.warning(f"  ⚠ Skipped {skipped_empty} entries with no content from {source['name']}")

        logger.info(f"Fetched {len(articles)} articles from {source['name']}")
        return articles

    except Exception as e:
        logger.error(f"Failed to fetch feed {source['name']}: {e}")
        return []


def fetch_all_feeds(
    feeds: list[dict] = None,
    fetch_full: bool = True,
    categories: list[str] = None,
    priorities: list[str] = None,
) -> list[Article]:
    """
    Fetch articles from all configured RSS feeds.

    Args:
        feeds: List of feed configs (default: RSS_FEEDS from config)
        fetch_full: Whether to fetch full content from article URLs (default True)
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
