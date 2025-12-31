#!/usr/bin/env python3
"""
Vector Index Module for Fast Ensemble Validation

Provides a singleton VectorSearchEngine pre-configured with:
- BGE-base-en-v1.5 model (768 dims, 3-5x faster than BGE-M3)
- FAISS flat index with caching
- Automatic index building and loading

Usage:
    from vector_index import get_vector_index, get_similarity
    
    # Get similarity between two college names
    score = get_similarity("AIIMS Delhi", "All India Institute of Medical Sciences")
"""

import numpy as np
from typing import Dict, Optional, Tuple
from pathlib import Path
import logging
from rich.console import Console

logger = logging.getLogger(__name__)
console = Console()

# Singleton instance
_vector_index: Optional['VectorIndexWrapper'] = None


class VectorIndexWrapper:
    """Wrapper around VectorSearchEngine for fast similarity lookups."""
    
    def __init__(
        self,
        master_db_path: str = 'data/sqlite/master_data.db',
        cache_dir: str = 'models/vector_search',
        model_name: str = 'BAAI/bge-base-en-v1.5',
        embedding_dim: int = 768,
    ):
        self.master_db_path = master_db_path
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.model_name = model_name
        self.embedding_dim = embedding_dim
        
        # Embedding cache for query names (not in index)
        self._embedding_cache: Dict[str, np.ndarray] = {}
        
        # Initialize vector engine
        self._engine = None
        self._model = None
        self._initialized = False
        
    def _ensure_initialized(self):
        """Lazy initialization of vector engine and model."""
        if self._initialized:
            return
            
        try:
            from advanced_vector_search import VectorSearchEngine
            
            console.print("[dim]Initializing vector index (BGE-base-en-v1.5)...[/dim]")
            
            self._engine = VectorSearchEngine(
                embedding_dim=self.embedding_dim,
                index_type='flat',
                model_name=self.model_name,
                cache_dir=str(self.cache_dir),
            )
            
            # Build index with master colleges if not cached
            self._build_index_if_needed()
            
            self._initialized = True
            console.print(f"[dim]Vector index ready: {self._engine.index.ntotal:,} colleges[/dim]")
            
        except Exception as e:
            logger.warning(f"Failed to initialize vector index: {e}")
            self._initialized = False
            
    def _build_index_if_needed(self):
        """Build vector index from master colleges if not cached."""
        import sqlite3
        
        # Load all colleges from master database
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        colleges = []
        for table in ['medical_colleges', 'dental_colleges', 'dnb_colleges']:
            try:
                cursor.execute(f"SELECT id, name, normalized_name, state FROM {table}")
                for row in cursor.fetchall():
                    colleges.append({
                        'id': row[0],
                        'name': row[1] or row[2] or '',  # Use name or normalized_name
                        'state': row[3] or '',
                    })
            except Exception as e:
                logger.debug(f"Skipping {table}: {e}")
        
        conn.close()
        
        if colleges:
            self._engine.add_colleges(colleges, force_rebuild=False)
        else:
            logger.warning("No colleges found in master database!")
            
    def get_embedding(self, text: str) -> Optional[np.ndarray]:
        """Get embedding for text with caching."""
        if not text:
            return None
            
        self._ensure_initialized()
        if not self._engine:
            return None
            
        text_key = text.upper().strip()
        
        # Check cache first
        if text_key in self._embedding_cache:
            return self._embedding_cache[text_key]
        
        try:
            # Use the engine's model to embed
            if self._engine.use_bge_m3:
                result = self._engine.model.encode([text_key], batch_size=1, max_length=128)
                if isinstance(result, dict) and 'dense_vecs' in result:
                    vec = result['dense_vecs'][0]
                else:
                    vec = result[0]
            else:
                vec = self._engine.model.encode([text_key], convert_to_tensor=False)[0]
                
            vec = np.array(vec).astype('float32')
            self._embedding_cache[text_key] = vec
            return vec
            
        except Exception as e:
            logger.warning(f"Embedding failed for '{text[:30]}...': {e}")
            return None
            
    def get_similarity(self, name1: str, name2: str) -> float:
        """
        Calculate cosine similarity between two names.
        
        Uses cached embeddings when available.
        Returns 0.0 if either embedding fails.
        """
        vec1 = self.get_embedding(name1)
        vec2 = self.get_embedding(name2)
        
        if vec1 is None or vec2 is None:
            return 0.0
            
        # Cosine similarity
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        cosine = dot_product / (norm1 * norm2)
        # Convert to 0-100 scale
        return max(0.0, min(100.0, cosine * 100))
        
    def search(self, query: str, state: str = None, k: int = 5):
        """Search for similar colleges in the index."""
        self._ensure_initialized()
        if not self._engine:
            return []
        return self._engine.hybrid_search(query, k=k, state_filter=state)
        
    def get_statistics(self) -> Dict:
        """Get index statistics."""
        self._ensure_initialized()
        if not self._engine:
            return {'status': 'not_initialized'}
        return self._engine.get_statistics()


def get_vector_index() -> Optional[VectorIndexWrapper]:
    """Get the singleton vector index instance."""
    global _vector_index
    if _vector_index is None:
        _vector_index = VectorIndexWrapper()
    return _vector_index


def get_similarity(name1: str, name2: str) -> float:
    """
    Get cosine similarity between two college names.
    
    This is the main entry point for ensemble validation.
    Uses BGE-base-en-v1.5 embeddings with caching.
    
    Returns:
        Similarity score from 0.0 to 100.0
    """
    index = get_vector_index()
    if index is None:
        return 0.0
    return index.get_similarity(name1, name2)


# Module self-test
if __name__ == "__main__":
    console.print("\n[bold cyan]Vector Index Module Test[/bold cyan]\n")
    
    # Test similarity
    test_pairs = [
        ("AIIMS Delhi", "All India Institute of Medical Sciences Delhi"),
        ("CMC Vellore", "Christian Medical College Vellore"),
        ("AFMC Pune", "Armed Forces Medical College Pune"),
        ("Random Hospital", "Some Other College"),  # Should be low
    ]
    
    for name1, name2 in test_pairs:
        score = get_similarity(name1, name2)
        console.print(f"  {name1[:30]:<30} ↔ {name2[:40]:<40} = {score:.1f}%")
