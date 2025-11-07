#!/usr/bin/env python3
"""
Advanced Vector Search System
FAISS-based fuzzy embedding search with hybrid scoring
"""

import numpy as np
import faiss
from typing import List, Dict, Tuple, Optional
import pickle
from pathlib import Path
import logging
from sentence_transformers import SentenceTransformer
from rapidfuzz import fuzz
import json

logger = logging.getLogger(__name__)

class VectorSearchEngine:
    """High-performance vector search with FAISS"""

    def __init__(
        self,
        embedding_dim: int = 384,
        index_type: str = 'flat',
        model_name: str = 'all-MiniLM-L6-v2',
        cache_dir: str = 'models/vector_search'
    ):
        """
        Initialize vector search engine

        Args:
            embedding_dim: Dimension of embeddings (384 for MiniLM, 768 for BERT)
            index_type: 'flat' (exact), 'ivf' (fast approximate), 'hnsw' (best quality)
            model_name: Sentence transformer model
            cache_dir: Directory for caching
        """
        self.embedding_dim = embedding_dim
        self.index_type = index_type
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Load transformer model
        logger.info(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)

        # Initialize FAISS index
        self.index = self._create_index(index_type, embedding_dim)

        # Metadata storage (maps index ID to college data)
        self.id_to_data = {}
        self.data_to_id = {}
        self.next_id = 0

    def _create_index(self, index_type: str, dim: int) -> faiss.Index:
        """Create FAISS index based on type"""

        if index_type == 'flat':
            # Exact search (slower but accurate)
            index = faiss.IndexFlatL2(dim)
            logger.info("Created FLAT index (exact search)")

        elif index_type == 'ivf':
            # IVF index (fast approximate search)
            nlist = 100  # number of clusters
            quantizer = faiss.IndexFlatL2(dim)
            index = faiss.IndexIVFFlat(quantizer, dim, nlist)
            logger.info("Created IVF index (approximate search)")

        elif index_type == 'hnsw':
            # HNSW index (hierarchical navigable small world - best quality)
            M = 32  # number of connections
            index = faiss.IndexHNSWFlat(dim, M)
            logger.info("Created HNSW index (high quality approximate search)")

        else:
            raise ValueError(f"Unknown index type: {index_type}")

        return index

    def add_colleges(self, colleges: List[Dict], force_rebuild: bool = False):
        """
        Add colleges to the index

        Args:
            colleges: List of college dictionaries
            force_rebuild: Force rebuild even if index exists
        """
        index_file = self.cache_dir / f"faiss_{self.index_type}.index"
        metadata_file = self.cache_dir / f"metadata_{self.index_type}.pkl"

        # Load cached index if exists
        if not force_rebuild and index_file.exists() and metadata_file.exists():
            logger.info("Loading cached index...")
            self.index = faiss.read_index(str(index_file))
            with open(metadata_file, 'rb') as f:
                cache_data = pickle.load(f)
                self.id_to_data = cache_data['id_to_data']
                self.data_to_id = cache_data['data_to_id']
                self.next_id = cache_data['next_id']
            logger.info(f"Loaded {self.next_id} colleges from cache")
            return

        logger.info(f"Building index for {len(colleges)} colleges...")

        # Generate embeddings
        college_names = [c.get('name', '') for c in colleges]
        embeddings = self.model.encode(
            college_names,
            convert_to_tensor=False,
            show_progress_bar=True,
            batch_size=32
        )

        # Convert to float32 (FAISS requirement)
        embeddings = embeddings.astype('float32')

        # Train index if needed (for IVF)
        if self.index_type == 'ivf' and not self.index.is_trained:
            logger.info("Training IVF index...")
            self.index.train(embeddings)

        # Add vectors to index
        self.index.add(embeddings)

        # Store metadata
        for i, college in enumerate(colleges):
            self.id_to_data[i] = college
            # Create reverse mapping using normalized name
            key = f"{college.get('name', '').lower()}_{college.get('state', '').lower()}"
            self.data_to_id[key] = i

        self.next_id = len(colleges)

        # Save index and metadata
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
        """
        Search for colleges using vector similarity

        Args:
            query: Query text
            k: Number of results to return
            state_filter: Filter by state (optional)
            min_score: Minimum similarity score

        Returns:
            List of (college, score) tuples
        """
        if self.index.ntotal == 0:
            logger.warning("Index is empty. Add colleges first.")
            return []

        # Generate query embedding
        query_emb = self.model.encode([query], convert_to_tensor=False)
        query_emb = query_emb.astype('float32')

        # Search in FAISS index
        # Get more results for filtering
        search_k = k * 5 if state_filter else k

        # Set nprobe for IVF index (number of clusters to search)
        if self.index_type == 'ivf':
            self.index.nprobe = 10

        distances, indices = self.index.search(query_emb, search_k)

        # Convert distances to similarity scores
        # FAISS returns L2 distances, convert to similarity (0-1)
        # similarity = 1 / (1 + distance)
        similarities = 1 / (1 + distances[0])

        results = []
        for idx, sim in zip(indices[0], similarities):
            if idx == -1:  # No more results
                break

            college = self.id_to_data.get(idx)
            if not college:
                continue

            # Apply state filter
            if state_filter:
                college_state = college.get('state', '').strip().upper()
                if college_state != state_filter.strip().upper():
                    continue

            # Apply minimum score filter
            if sim < min_score:
                continue

            results.append((college, float(sim)))

            # Stop if we have enough results
            if len(results) >= k:
                break

        return results

    def hybrid_search(
        self,
        query: str,
        k: int = 10,
        state_filter: Optional[str] = None,
        weights: Dict[str, float] = None
    ) -> List[Tuple[Dict, float, str]]:
        """
        Hybrid search combining vector similarity + fuzzy matching

        Args:
            query: Query text
            k: Number of results
            state_filter: Filter by state
            weights: Scoring weights {'vector': 0.6, 'fuzzy': 0.4}

        Returns:
            List of (college, score, method) tuples
        """
        if weights is None:
            weights = {'vector': 0.6, 'fuzzy': 0.4}

        # Get vector search results (more candidates for fuzzy reranking)
        vector_results = self.search(query, k=k*3, state_filter=state_filter)

        if not vector_results:
            return []

        # Rerank with fuzzy matching
        hybrid_results = []
        for college, vector_score in vector_results:
            # Calculate fuzzy score
            college_name = college.get('name', '')
            fuzzy_score = fuzz.ratio(query.upper(), college_name.upper()) / 100

            # Combined score
            hybrid_score = (
                vector_score * weights['vector'] +
                fuzzy_score * weights['fuzzy']
            )

            hybrid_results.append((
                college,
                hybrid_score,
                f"hybrid(v:{vector_score:.2f},f:{fuzzy_score:.2f})"
            ))

        # Sort by hybrid score
        hybrid_results.sort(key=lambda x: x[1], reverse=True)

        return hybrid_results[:k]

    def multi_field_search(
        self,
        college_name: str,
        address: str = '',
        state: str = '',
        k: int = 5
    ) -> List[Tuple[Dict, float, str]]:
        """
        Search using multiple fields with intelligent weighting

        Args:
            college_name: College name
            address: Address text
            state: State
            k: Number of results

        Returns:
            List of (college, score, details) tuples
        """
        # Build composite query
        query_parts = []
        if college_name:
            query_parts.append(college_name)
        if address:
            query_parts.append(address)

        query = ' '.join(query_parts)

        # Search with state filter
        results = self.hybrid_search(
            query,
            k=k,
            state_filter=state if state else None
        )

        return results

    def approximate_nearest_neighbors(
        self,
        query: str,
        radius: float = 0.5,
        state_filter: Optional[str] = None
    ) -> List[Tuple[Dict, float]]:
        """
        Range search: find all colleges within similarity radius

        Args:
            query: Query text
            radius: Maximum distance (0-1, lower is closer)
            state_filter: Filter by state

        Returns:
            List of colleges within radius
        """
        # Generate query embedding
        query_emb = self.model.encode([query], convert_to_tensor=False)
        query_emb = query_emb.astype('float32')

        # Range search (FAISS)
        lims, distances, indices = self.index.range_search(query_emb, radius)

        results = []
        for idx, dist in zip(indices, distances):
            college = self.id_to_data.get(idx)
            if not college:
                continue

            # Apply state filter
            if state_filter:
                college_state = college.get('state', '').strip().upper()
                if college_state != state_filter.strip().upper():
                    continue

            similarity = 1 / (1 + dist)
            results.append((college, float(similarity)))

        # Sort by similarity
        results.sort(key=lambda x: x[1], reverse=True)

        return results

    def get_statistics(self) -> Dict:
        """Get index statistics"""
        return {
            'total_vectors': self.index.ntotal,
            'index_type': self.index_type,
            'embedding_dim': self.embedding_dim,
            'is_trained': self.index.is_trained if hasattr(self.index, 'is_trained') else True
        }

    def clear_index(self):
        """Clear the index"""
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
        model_name='all-MiniLM-L6-v2'
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
