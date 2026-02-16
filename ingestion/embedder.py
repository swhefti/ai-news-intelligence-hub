"""
Embedder for AI News Intelligence Hub.

This module handles:
- Generating embeddings using OpenAI's API
- Batch processing for efficiency
- Caching to avoid re-embedding
"""

import logging
import time
from typing import Optional
from dataclasses import dataclass

from config import EMBEDDING_CONFIG, API_CONFIG

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class EmbeddedChunk:
    """A chunk with its embedding vector."""
    chunk_id: str
    article_id: str
    chunk_index: int
    text: str
    embedding: list[float]
    
    # Metadata
    article_title: str
    article_url: str
    source_name: str
    source_category: str
    published_at: Optional[str]
    
    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "chunk_id": self.chunk_id,
            "article_id": self.article_id,
            "chunk_index": self.chunk_index,
            "text": self.text,
            "embedding": self.embedding,
            "article_title": self.article_title,
            "article_url": self.article_url,
            "source_name": self.source_name,
            "source_category": self.source_category,
            "published_at": self.published_at,
        }


# =============================================================================
# EMBEDDING GENERATION
# =============================================================================

class Embedder:
    """
    Handles embedding generation using OpenAI's API.
    
    Usage:
        embedder = Embedder()
        embedded_chunks = embedder.embed_chunks(chunks)
    """
    
    def __init__(self, api_key: str = None, model: str = None):
        """
        Initialize the embedder.
        
        Args:
            api_key: OpenAI API key (default from config)
            model: Embedding model to use (default from config)
        """
        self.api_key = api_key or API_CONFIG.openai_key
        self.model = model or EMBEDDING_CONFIG.model
        self.client = None
        
        if not self.api_key:
            logger.warning("No OpenAI API key configured. Set OPENAI_API_KEY environment variable.")
    
    def _get_client(self):
        """Lazy initialization of OpenAI client."""
        if self.client is None:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=self.api_key)
            except ImportError:
                raise ImportError("Please install openai: pip install openai")
        return self.client
    
    def embed_text(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
        
        Returns:
            Embedding vector as list of floats
        """
        client = self._get_client()
        
        response = client.embeddings.create(
            model=self.model,
            input=text,
        )
        
        return response.data[0].embedding
    
    def embed_texts_batch(
        self, 
        texts: list[str], 
        batch_size: int = None,
        show_progress: bool = True,
    ) -> list[list[float]]:
        """
        Generate embeddings for multiple texts in batches.
        
        Args:
            texts: List of texts to embed
            batch_size: Number of texts per API call (default from config)
            show_progress: Whether to log progress
        
        Returns:
            List of embedding vectors
        """
        batch_size = batch_size or EMBEDDING_CONFIG.batch_size
        client = self._get_client()
        
        all_embeddings = []
        total_batches = (len(texts) + batch_size - 1) // batch_size
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_num = i // batch_size + 1
            
            if show_progress:
                logger.info(f"Embedding batch {batch_num}/{total_batches} ({len(batch)} texts)")
            
            try:
                response = client.embeddings.create(
                    model=self.model,
                    input=batch,
                )
                
                # Extract embeddings in order
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
                
            except Exception as e:
                logger.error(f"Error embedding batch {batch_num}: {e}")
                # Return None embeddings for failed batch
                all_embeddings.extend([None] * len(batch))
            
            # Small delay to respect rate limits
            if i + batch_size < len(texts):
                time.sleep(0.1)
        
        return all_embeddings
    
    def embed_chunks(self, chunks: list) -> list[EmbeddedChunk]:
        """
        Generate embeddings for a list of Chunk objects.
        
        Args:
            chunks: List of Chunk objects
        
        Returns:
            List of EmbeddedChunk objects
        """
        if not chunks:
            return []
        
        # Extract texts
        texts = [chunk.text for chunk in chunks]
        
        # Generate embeddings
        logger.info(f"Generating embeddings for {len(chunks)} chunks...")
        embeddings = self.embed_texts_batch(texts)
        
        # Combine chunks with embeddings
        embedded_chunks = []
        for chunk, embedding in zip(chunks, embeddings):
            if embedding is not None:
                embedded_chunk = EmbeddedChunk(
                    chunk_id=chunk.id,
                    article_id=chunk.article_id,
                    chunk_index=chunk.chunk_index,
                    text=chunk.text,
                    embedding=embedding,
                    article_title=chunk.article_title,
                    article_url=chunk.article_url,
                    source_name=chunk.source_name,
                    source_category=chunk.source_category,
                    published_at=chunk.published_at,
                )
                embedded_chunks.append(embedded_chunk)
            else:
                logger.warning(f"Failed to embed chunk {chunk.id}")
        
        logger.info(f"Successfully embedded {len(embedded_chunks)}/{len(chunks)} chunks")
        return embedded_chunks


# =============================================================================
# MOCK EMBEDDER (for testing without API)
# =============================================================================

class MockEmbedder:
    """
    Mock embedder that generates random embeddings.
    Useful for testing without API calls.
    """
    
    def __init__(self, dimensions: int = None):
        self.dimensions = dimensions or EMBEDDING_CONFIG.dimensions
    
    def embed_text(self, text: str) -> list[float]:
        """Generate a mock embedding based on text hash."""
        import hashlib
        import struct
        
        # Use hash of text to generate deterministic "embedding"
        hash_bytes = hashlib.sha256(text.encode()).digest()
        
        # Expand hash to fill embedding dimensions
        embedding = []
        for i in range(self.dimensions):
            # Use different parts of hash with index
            idx = i % 32
            value = hash_bytes[idx] / 255.0 - 0.5
            embedding.append(value)
        
        # Normalize
        magnitude = sum(x**2 for x in embedding) ** 0.5
        embedding = [x / magnitude for x in embedding]
        
        return embedding
    
    def embed_texts_batch(self, texts: list[str], **kwargs) -> list[list[float]]:
        """Generate mock embeddings for multiple texts."""
        return [self.embed_text(text) for text in texts]
    
    def embed_chunks(self, chunks: list) -> list[EmbeddedChunk]:
        """Generate mock embeddings for chunks."""
        embedded_chunks = []
        
        for chunk in chunks:
            embedding = self.embed_text(chunk.text)
            embedded_chunk = EmbeddedChunk(
                chunk_id=chunk.id,
                article_id=chunk.article_id,
                chunk_index=chunk.chunk_index,
                text=chunk.text,
                embedding=embedding,
                article_title=chunk.article_title,
                article_url=chunk.article_url,
                source_name=chunk.source_name,
                source_category=chunk.source_category,
                published_at=chunk.published_at,
            )
            embedded_chunks.append(embedded_chunk)
        
        logger.info(f"Generated {len(embedded_chunks)} mock embeddings")
        return embedded_chunks


# =============================================================================
# FACTORY FUNCTION
# =============================================================================

def get_embedder(use_mock: bool = False) -> Embedder | MockEmbedder:
    """
    Get an embedder instance.
    
    Args:
        use_mock: If True, return MockEmbedder instead of real one
    
    Returns:
        Embedder or MockEmbedder instance
    """
    if use_mock or not API_CONFIG.openai_key:
        logger.info("Using mock embedder (no API calls)")
        return MockEmbedder()
    else:
        logger.info("Using OpenAI embedder")
        return Embedder()


# =============================================================================
# MAIN EXECUTION (for testing)
# =============================================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("Testing Embedder")
    print("="*60 + "\n")
    
    # Use mock embedder for testing
    embedder = MockEmbedder()
    
    # Test single text
    test_text = "Large language models are transforming how we interact with computers."
    embedding = embedder.embed_text(test_text)
    
    print(f"Text: {test_text}")
    print(f"Embedding dimensions: {len(embedding)}")
    print(f"First 5 values: {embedding[:5]}")
    print(f"Magnitude: {sum(x**2 for x in embedding) ** 0.5:.4f}")
    
    # Test batch
    print("\n" + "-"*40)
    print("Testing batch embedding...\n")
    
    test_texts = [
        "Anthropic released Claude 3 with improved reasoning.",
        "OpenAI announced GPT-4 Turbo with longer context.",
        "Google DeepMind published research on AI safety.",
    ]
    
    embeddings = embedder.embed_texts_batch(test_texts)
    
    for text, emb in zip(test_texts, embeddings):
        print(f"Text: {text[:50]}...")
        print(f"  Dimensions: {len(emb)}, First 3: {emb[:3]}")
    
    print("\n✓ Embedder tests passed!")
