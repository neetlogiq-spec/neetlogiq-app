#!/usr/bin/env python3
"""
Advanced Vector Search System
FAISS-based fuzzy embedding search with hybrid scoring
(With Numpy Fallback for macOS stability)
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import pickle
from pathlib import Path
import logging
from rapidfuzz import fuzz
import warnings

# Suppress verbose tokenizer warnings
warnings.filterwarnings("ignore", message=".*fast tokenizer.*")
warnings.filterwarnings("ignore", message=".*XLMRobertaTokenizerFast.*")
import json
import os

logger = logging.getLogger(__name__)

class NumpyIndex:
    """Simple Numpy-based Index for exact search (Crash-proof fallback)"""
    def __init__(self, dim: int):
        self.dim = dim
        self.vectors = None
        self.ntotal = 0

    def add(self, vectors: np.ndarray):
        if self.vectors is None:
            self.vectors = vectors
        else:
            self.vectors = np.vstack((self.vectors, vectors))
        self.ntotal = len(self.vectors)

    def search(self, query_vectors: np.ndarray, k: int) -> Tuple[np.ndarray, np.ndarray]:
        # L2 distance: ||u - v||^2 = ||u||^2 + ||v||^2 - 2 <u, v>
        # But for normalized vectors (cosine similarity), we can just use dot product
        # Here we implement L2 to match FAISS behavior
        
        dists = []
        indices = []
        
        for q in query_vectors:
            # Calculate L2 distance to all vectors
            # dist = np.linalg.norm(self.vectors - q, axis=1)
            # Optimization: (a-b)^2 = a^2 + b^2 - 2ab
            # Since we want nearest neighbors (min distance)
            
            # Simple Euclidean distance
            diff = self.vectors - q
            dist_sq = np.sum(diff**2, axis=1)
            
            # Get top k
            idx = np.argsort(dist_sq)[:k]
            dst = dist_sq[idx]
            
            dists.append(dst)
            indices.append(idx)
            
        return np.array(dists), np.array(indices)

    def reset(self):
        self.vectors = None
        self.ntotal = 0
        
    @property
    def is_trained(self):
        return True

class VectorSearchEngine:
    """High-performance vector search with FAISS (or Numpy fallback)"""

    def __init__(
        self,
        embedding_dim: int = 768,  # BGE-base-en-v1.5 uses 768 dims
        index_type: str = 'flat',
        model_name: str = 'BAAI/bge-base-en-v1.5',  # Faster model (3-5x vs BGE-M3)
        cache_dir: str = 'models/vector_search'
    ):
        self.embedding_dim = embedding_dim
        self.index_type = index_type
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.use_bge_m3 = 'bge-m3' in model_name.lower()

        # Load transformer model - prioritize FlagEmbedding for BGE-M3
        logger.info(f"Loading embedding model: {model_name}")
        self.model = None
        if self.use_bge_m3:
            try:
                from FlagEmbedding import BGEM3FlagModel
                self.model = BGEM3FlagModel(model_name, use_fp16=True)
                logger.info("  ✓ Loaded via FlagEmbedding (optimal for BGE-M3)")
            except Exception as e:
                logger.warning(f"  FlagEmbedding failed: {e}, falling back to SentenceTransformer")
        
        # Fallback to SentenceTransformer
        if self.model is None:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(model_name)
            self.use_bge_m3 = False
            logger.info("  ✓ Loaded via SentenceTransformer")

        # Initialize Index
        self.use_faiss = False
        try:
            import faiss
            self.index = self._create_index(index_type, embedding_dim)
            self.use_faiss = True
            logger.info(f"✅ Using FAISS for vector search ({index_type})")
        except (ImportError, Exception) as e:
            logger.warning(f"⚠️  FAISS not available or failed ({e}). Using Numpy fallback.")
            self.index = NumpyIndex(embedding_dim)

        # Metadata storage (maps index ID to college data)
        self.id_to_data = {}
        self.data_to_id = {}
        self.next_id = 0

    def _create_index(self, index_type: str, dim: int):
        """Create FAISS index based on type"""
        import faiss
        if index_type == 'flat':
            index = faiss.IndexFlatL2(dim)
        elif index_type == 'ivf':
            nlist = 100
            quantizer = faiss.IndexFlatL2(dim)
            index = faiss.IndexIVFFlat(quantizer, dim, nlist)
        elif index_type == 'hnsw':
            M = 32
            index = faiss.IndexHNSWFlat(dim, M)
        else:
            raise ValueError(f"Unknown index type: {index_type}")
        return index

    def add_colleges(self, colleges: List[Dict], force_rebuild: bool = False):
        """Add colleges to the index"""
        index_file = self.cache_dir / f"faiss_{self.index_type}.index"
        metadata_file = self.cache_dir / f"metadata_{self.index_type}.pkl"

        # Load cached index if exists
        if not force_rebuild and index_file.exists() and metadata_file.exists():
            logger.info("Loading cached index...")
            try:
                if self.use_faiss:
                    import faiss
                    self.index = faiss.read_index(str(index_file))
                else:
                    # For numpy, we just rebuild (it's fast) or load if we implemented save
                    # For now, just rebuild to be safe
                    pass 
                
                with open(metadata_file, 'rb') as f:
                    cache_data = pickle.load(f)
                    self.id_to_data = cache_data['id_to_data']
                    self.data_to_id = cache_data['data_to_id']
                    self.next_id = cache_data['next_id']
                
                # If we loaded metadata but not index (Numpy case), we need to rebuild vectors.
                # But we don't have the raw vectors cached separately. 
                # So for Numpy, we might just want to rebuild always or cache vectors.
                # Simpler: If Numpy, just rebuild.
                if self.use_faiss:
                    logger.info(f"Loaded {self.next_id} colleges from cache")
                    return
            except Exception as e:
                logger.warning(f"Failed to load cache: {e}. Rebuilding...")

        logger.info(f"Building index for {len(colleges)} colleges...")

        # Generate embeddings - handle both FlagEmbedding and SentenceTransformer
        college_names = [c.get('name', '') for c in colleges]
        
        if self.use_bge_m3:
            # FlagEmbedding API (BGE-M3)
            result = self.model.encode(college_names, batch_size=32, max_length=128)
            if isinstance(result, dict) and 'dense_vecs' in result:
                embeddings = result['dense_vecs']
            else:
                embeddings = result
            embeddings = np.array(embeddings)
        else:
            # SentenceTransformer API
            embeddings = self.model.encode(
                college_names,
                convert_to_tensor=False,
                show_progress_bar=True,
                batch_size=32
            )

        # Convert to float32
        embeddings = embeddings.astype('float32')

        # Train index if needed
        if self.use_faiss and self.index_type == 'ivf' and not self.index.is_trained:
            self.index.train(embeddings)

        # Add vectors to index
        self.index.add(embeddings)

        # Store metadata
        for i, college in enumerate(colleges):
            self.id_to_data[i] = college
            key = f"{college.get('name', '').lower()}_{college.get('state', '').lower()}"
            self.data_to_id[key] = i

        self.next_id = len(colleges)

        # Save index and metadata (Only for FAISS for now)
        if self.use_faiss:
            import faiss
            logger.info("Saving index to cache...")
            faiss.write_index(self.index, str(index_file))
            with open(metadata_file, 'wb') as f:
                pickle.dump({
                    'id_to_data': self.id_to_data,
                    'data_to_id': self.data_to_id,
                    'next_id': self.next_id
                }, f)

        logger.info(f"Index built successfully with {self.next_id} colleges")

    def search(
        self,
        query: str,
        k: int = 10,
        state_filter: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[Tuple[Dict, float]]:
        """Search for colleges using vector similarity"""
        if self.index.ntotal == 0:
            return []

        # Generate query embedding - handle both FlagEmbedding and SentenceTransformer
        if self.use_bge_m3:
            result = self.model.encode([query], batch_size=1, max_length=128)
            if isinstance(result, dict) and 'dense_vecs' in result:
                query_emb = result['dense_vecs']
            else:
                query_emb = result
            query_emb = np.array(query_emb)
        else:
            query_emb = self.model.encode([query], convert_to_tensor=False)
        query_emb = query_emb.astype('float32')

        # Search
        search_k = k * 5 if state_filter else k
        if self.use_faiss and self.index_type == 'ivf':
            self.index.nprobe = 10

        distances, indices = self.index.search(query_emb, search_k)

        # Convert distances to similarity scores (1 / (1 + L2))
        # For normalized vectors, L2 = 2(1-cos). So cos = 1 - L2/2.
        # But here we stick to 1/(1+L2) for consistency
        similarities = 1 / (1 + distances[0])

        results = []
        for idx, sim in zip(indices[0], similarities):
            if idx == -1: break

            college = self.id_to_data.get(idx)
            if not college: continue

            if state_filter:
                college_state = college.get('state', '').strip().upper()
                if college_state != state_filter.strip().upper():
                    continue

            if sim < min_score: continue

            results.append((college, float(sim)))
            if len(results) >= k: break

        return results

    def hybrid_search(
        self,
        query: str,
        k: int = 10,
        state_filter: Optional[str] = None,
        weights: Dict[str, float] = None
    ) -> List[Tuple[Dict, float, str]]:
        """Hybrid search combining vector similarity + fuzzy matching"""
        if weights is None:
            weights = {'vector': 0.6, 'fuzzy': 0.4}

        vector_results = self.search(query, k=k*3, state_filter=state_filter)

        if not vector_results:
            return []

        hybrid_results = []
        for college, vector_score in vector_results:
            college_name = college.get('name', '')
            fuzzy_score = fuzz.ratio(query.upper(), college_name.upper()) / 100

            hybrid_score = (
                vector_score * weights['vector'] +
                fuzzy_score * weights['fuzzy']
            )

            hybrid_results.append((
                college,
                hybrid_score,
                f"hybrid(v:{vector_score:.2f},f:{fuzzy_score:.2f})"
            ))

        hybrid_results.sort(key=lambda x: x[1], reverse=True)
        return hybrid_results[:k]

    def multi_field_search(self, college_name: str, address: str = '', state: str = '', k: int = 5):
        query_parts = []
        if college_name: query_parts.append(college_name)
        if address: query_parts.append(address)
        query = ' '.join(query_parts)
        return self.hybrid_search(query, k=k, state_filter=state if state else None)

    def get_statistics(self) -> Dict:
        return {
            'total_vectors': self.index.ntotal,
            'index_type': self.index_type,
            'embedding_dim': self.embedding_dim,
            'backend': 'faiss' if self.use_faiss else 'numpy'
        }

    def clear_index(self):
        self.index.reset()
        self.id_to_data = {}
        self.data_to_id = {}
        self.next_id = 0
        logger.info("Index cleared")


class HybridMatcher:
    """Combines vector search with traditional fuzzy matching"""

    def __init__(self, vector_engine: VectorSearchEngine):
        """
        Initialize hybrid matcher

        Args:
            vector_engine: Configured vector search engine
        """
        self.vector_engine = vector_engine

    def match_college(
        self,
        college_name: str,
        state: str,
        address: str = '',
        threshold: float = 0.7
    ) -> Tuple[Optional[Dict], float, str]:
        """
        Match college using hybrid approach

        Args:
            college_name: College name to match
            state: State
            address: Address (optional)
            threshold: Minimum score threshold

        Returns:
            (college, score, method)
        """
        # Try hybrid search
        results = self.vector_engine.hybrid_search(
            college_name,
            k=5,
            state_filter=state
        )

        if not results:
            return None, 0.0, "no_match"

        # Get best match
        best_college, best_score, method = results[0]

        if best_score >= threshold:
            return best_college, best_score, f"hybrid_{method}"
        else:
            return None, best_score, "below_threshold"

    def batch_match(
        self,
        records: List[Dict],
        threshold: float = 0.7
    ) -> List[Dict]:
        """
        Match multiple records in batch

        Args:
            records: List of records to match
            threshold: Minimum score threshold

        Returns:
            List of records with match results
        """
        results = []

        for record in records:
            college_name = record.get('college_name', '')
            state = record.get('state', '')
            address = record.get('address', '')

            match, score, method = self.match_college(
                college_name,
                state,
                address,
                threshold
            )

            result = record.copy()
            result['matched_college'] = match
            result['match_score'] = score
            result['match_method'] = method

            results.append(result)

        return results


# Standalone usage
if __name__ == "__main__":
    # Initialize vector search
    engine = VectorSearchEngine(
        embedding_dim=384,
        index_type='hnsw',  # Best quality
        model_name='BAAI/bge-base-en-v1.5'
    )

    # Example colleges
    colleges = [
        {'id': 1, 'name': 'Armed Forces Medical College', 'state': 'MAHARASHTRA', 'address': 'Pune'},
        {'id': 2, 'name': 'All India Institute of Medical Sciences Delhi', 'state': 'DELHI', 'address': 'New Delhi'},
        {'id': 3, 'name': 'Christian Medical College Vellore', 'state': 'TAMIL NADU', 'address': 'Vellore'},
        {'id': 4, 'name': 'Government Medical College Thiruvananthapuram', 'state': 'KERALA', 'address': 'Trivandrum'},
    ]

    # Build index
    engine.add_colleges(colleges, force_rebuild=True)

    # Test queries
    queries = [
        ('AFMC Pune', 'MAHARASHTRA'),
        ('AIIMS Delhi', 'DELHI'),
        ('CMC Vellore', 'TAMIL NADU'),
        ('Medical College Trivandrum', 'KERALA'),
    ]

    print(f"\n{'='*80}")
    print("Vector Search Results")
    print(f"{'='*80}\n")

    for query, state in queries:
        print(f"\nQuery: {query} ({state})")
        print("-" * 60)

        # Hybrid search
        results = engine.hybrid_search(query, k=3, state_filter=state)

        for i, (college, score, method) in enumerate(results, 1):
            print(f"{i}. {college['name']}")
            print(f"   Score: {score:.2%} | Method: {method}")
