"""
Text Processor for AI News Intelligence Hub.

This module handles:
- Cleaning and normalizing text
- Chunking articles into smaller pieces for embedding
- Maintaining context across chunks
"""

import re
import logging
from dataclasses import dataclass
from typing import Optional

from config import CHUNK_CONFIG

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class Chunk:
    """A chunk of text ready for embedding."""
    id: str  # article_id + chunk_index
    article_id: str
    chunk_index: int
    text: str
    char_start: int  # Position in original text
    char_end: int
    
    # Metadata copied from article
    article_title: str
    article_url: str
    source_name: str
    source_category: str
    published_at: Optional[str]
    
    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "id": self.id,
            "article_id": self.article_id,
            "chunk_index": self.chunk_index,
            "text": self.text,
            "char_start": self.char_start,
            "char_end": self.char_end,
            "article_title": self.article_title,
            "article_url": self.article_url,
            "source_name": self.source_name,
            "source_category": self.source_category,
            "published_at": self.published_at,
        }


# =============================================================================
# TEXT CLEANING
# =============================================================================

def clean_text(text: str) -> str:
    """
    Clean and normalize text for processing.
    
    - Remove excessive whitespace
    - Normalize unicode characters
    - Remove control characters
    - Preserve paragraph structure
    """
    if not text:
        return ""
    
    # Normalize unicode
    import unicodedata
    text = unicodedata.normalize('NFKC', text)
    
    # Remove control characters (except newlines and tabs)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    
    # Normalize whitespace within lines
    text = re.sub(r'[^\S\n]+', ' ', text)
    
    # Normalize line breaks (max 2 consecutive)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Strip leading/trailing whitespace from lines
    lines = [line.strip() for line in text.splitlines()]
    text = '\n'.join(lines)
    
    # Strip overall
    text = text.strip()
    
    return text


# =============================================================================
# TEXT CHUNKING
# =============================================================================

def find_split_point(text: str, target_pos: int, search_range: int = 100) -> int:
    """
    Find the best position to split text near target_pos.
    
    Prefers splitting at:
    1. Paragraph breaks
    2. Sentence endings
    3. Clause boundaries (commas, semicolons)
    4. Word boundaries
    """
    # Clamp target to valid range
    target_pos = min(target_pos, len(text))
    
    # Define search window
    start = max(0, target_pos - search_range)
    end = min(len(text), target_pos + search_range)
    
    # Search for paragraph break (double newline)
    for i in range(target_pos, start, -1):
        if i < len(text) - 1 and text[i:i+2] == '\n\n':
            return i + 2
    
    # Search for sentence ending
    for i in range(target_pos, start, -1):
        if i < len(text) and text[i] in '.!?' and (i + 1 >= len(text) or text[i+1] in ' \n'):
            return i + 1
    
    # Search for clause boundary
    for i in range(target_pos, start, -1):
        if i < len(text) and text[i] in ',;:' and (i + 1 >= len(text) or text[i+1] == ' '):
            return i + 1
    
    # Fall back to word boundary
    for i in range(target_pos, start, -1):
        if i < len(text) and text[i] == ' ':
            return i + 1
    
    # Last resort: just split at target
    return target_pos


def chunk_text(
    text: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
    min_chunk_size: int = None,
) -> list[tuple[str, int, int]]:
    """
    Split text into overlapping chunks.
    
    Args:
        text: The text to chunk
        chunk_size: Target size for each chunk (characters)
        chunk_overlap: Overlap between consecutive chunks
        min_chunk_size: Minimum size for a chunk to be kept
    
    Returns:
        List of (chunk_text, start_pos, end_pos) tuples
    """
    chunk_size = chunk_size or CHUNK_CONFIG.chunk_size
    chunk_overlap = chunk_overlap or CHUNK_CONFIG.chunk_overlap
    min_chunk_size = min_chunk_size or CHUNK_CONFIG.min_chunk_size
    
    # Clean the text first
    text = clean_text(text)
    
    if not text:
        return []
    
    # If text is smaller than chunk_size, return as single chunk
    if len(text) <= chunk_size:
        return [(text, 0, len(text))]
    
    chunks = []
    start = 0
    
    while start < len(text):
        # Calculate end position
        end = start + chunk_size
        
        # If we're not at the end, find a good split point
        if end < len(text):
            end = find_split_point(text, end)
        else:
            end = len(text)
        
        # Extract chunk
        chunk_text = text[start:end].strip()
        
        # Only keep chunks above minimum size
        if len(chunk_text) >= min_chunk_size:
            chunks.append((chunk_text, start, end))
        
        # Move start position, accounting for overlap
        # The overlap means we back up a bit from the end
        start = end - chunk_overlap
        
        # Make sure we're making progress
        if start <= chunks[-1][1] if chunks else 0:
            start = end
    
    return chunks


def chunk_article(article) -> list[Chunk]:
    """
    Chunk an Article object into Chunk objects.
    
    Args:
        article: Article object with content and metadata
    
    Returns:
        List of Chunk objects
    """
    # Create enhanced text with title for better context
    enhanced_text = f"# {article.title}\n\n{article.content}"
    
    # Chunk the text
    raw_chunks = chunk_text(enhanced_text)
    
    # Convert to Chunk objects
    chunks = []
    for i, (text, start, end) in enumerate(raw_chunks):
        chunk = Chunk(
            id=f"{article.id}_{i:03d}",
            article_id=article.id,
            chunk_index=i,
            text=text,
            char_start=start,
            char_end=end,
            article_title=article.title,
            article_url=article.url,
            source_name=article.source_name,
            source_category=article.source_category,
            published_at=article.published_at.isoformat() if article.published_at else None,
        )
        chunks.append(chunk)
    
    return chunks


def chunk_articles(articles: list) -> list[Chunk]:
    """
    Chunk multiple articles.
    
    Args:
        articles: List of Article objects
    
    Returns:
        List of all Chunk objects
    """
    all_chunks = []
    
    for article in articles:
        chunks = chunk_article(article)
        all_chunks.extend(chunks)
        logger.debug(f"Chunked article '{article.title[:50]}' into {len(chunks)} chunks")
    
    logger.info(f"Created {len(all_chunks)} chunks from {len(articles)} articles")
    return all_chunks


# =============================================================================
# MAIN EXECUTION (for testing)
# =============================================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("Testing Text Processor")
    print("="*60 + "\n")
    
    # Test with sample text
    sample_text = """
    # Introduction to Large Language Models
    
    Large Language Models (LLMs) have revolutionized the field of artificial intelligence 
    and natural language processing. These models, trained on vast amounts of text data, 
    can generate human-like text, answer questions, and perform a wide variety of tasks.
    
    ## How LLMs Work
    
    At their core, LLMs use a transformer architecture that processes text through 
    attention mechanisms. This allows the model to understand context and relationships 
    between words, even across long distances in the text.
    
    The training process involves predicting the next word in a sequence, which helps 
    the model learn grammar, facts, and reasoning patterns from the training data.
    
    ## Applications
    
    LLMs are now used in many applications:
    - Chatbots and virtual assistants
    - Code generation and debugging
    - Content creation and summarization
    - Translation and language learning
    - Research and analysis
    
    ## Challenges and Considerations
    
    Despite their impressive capabilities, LLMs face several challenges including 
    hallucinations, bias in training data, and the environmental cost of training 
    and running these large models.
    """
    
    print("Original text length:", len(sample_text), "characters")
    print("\nChunking with default settings...")
    
    chunks = chunk_text(sample_text)
    
    print(f"\nCreated {len(chunks)} chunks:\n")
    
    for i, (text, start, end) in enumerate(chunks):
        print(f"Chunk {i+1} (chars {start}-{end}, length {len(text)}):")
        print("-" * 40)
        print(text[:200] + "..." if len(text) > 200 else text)
        print()
