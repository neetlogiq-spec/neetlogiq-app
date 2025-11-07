#!/usr/bin/env python3
"""
Transformer-based Matching Module
Uses sentence transformers for semantic similarity matching
"""

import numpy as np
from sentence_transformers import SentenceTransformer, util
import torch
from typing import List, Tuple, Dict, Optional
from pathlib import Path
import pickle
from tqdm import tqdm
import logging
from functools import lru_cache
from builtins import open as builtin_open

logger = logging.getLogger(__name__)

class TransformerMatcher:
    """Advanced matching using transformer models for semantic similarity"""

    def __init__(self, model_name: str = 'all-MiniLM-L6-v2', cache_dir: str = 'models/transformers'):
        """
        Initialize transformer matcher

        Args:
            model_name: Name of sentence transformer model
                - 'all-MiniLM-L6-v2': Fast, good quality (default)
                - 'all-mpnet-base-v2': Best quality, slower
                - 'paraphrase-multilingual-MiniLM-L12-v2': Multilingual support
            cache_dir: Directory to cache embeddings
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Loading transformer model: {model_name}")
        # Disable progress bars for cleaner output
        import os
        os.environ['TOKENIZERS_PARALLELISM'] = 'false'

        self.model = SentenceTransformer(model_name)
        self.model_name = model_name

        # Cache for embeddings
        self.embedding_cache = {}
        self.cache_file = self.cache_dir / f"{model_name.replace('/', '_')}_embeddings.pkl"
        self._load_cache()

    def _load_cache(self):
        """Load cached embeddings from disk"""
        if self.cache_file.exists():
            try:
                with builtin_open(self.cache_file, 'rb') as f:
                    self.embedding_cache = pickle.load(f)
                logger.info(f"Loaded {len(self.embedding_cache)} cached embeddings")
            except Exception as e:
                logger.warning(f"Failed to load embedding cache: {e}")
                self.embedding_cache = {}

    def _save_cache(self):
        """Save embeddings to disk"""
        try:
            with builtin_open(self.cache_file, 'wb') as f:
                pickle.dump(self.embedding_cache, f)
            logger.info(f"Saved {len(self.embedding_cache)} embeddings to cache")
        except Exception as e:
            logger.error(f"Failed to save embedding cache: {e}")

    @lru_cache(maxsize=10000)
    def get_embedding(self, text: str) -> np.ndarray:
        """
        Get embedding for text (with caching)

        Args:
            text: Input text

        Returns:
            Embedding vector
        """
        if not text or text.strip() == '':
            return np.zeros(self.model.get_sentence_embedding_dimension())

        # Check cache
        cache_key = text.strip().lower()
        if cache_key in self.embedding_cache:
            return self.embedding_cache[cache_key]

        # Generate embedding
        embedding = self.model.encode(text, convert_to_tensor=False)

        # Cache it
        self.embedding_cache[cache_key] = embedding

        return embedding

    def batch_encode(self, texts: List[str], show_progress: bool = False) -> np.ndarray:
        """
        Encode multiple texts in batch (efficient)

        Args:
            texts: List of texts to encode
            show_progress: Show progress bar (default: False for cleaner output)

        Returns:
            Array of embeddings
        """
        embeddings = self.model.encode(
            texts,
            convert_to_tensor=False,
            show_progress_bar=show_progress,
            batch_size=32
        )

        # Cache all embeddings
        for text, embedding in zip(texts, embeddings):
            cache_key = text.strip().lower()
            if cache_key not in self.embedding_cache:
                self.embedding_cache[cache_key] = embedding

        return embeddings

    def semantic_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate semantic similarity between two texts

        Args:
            text1: First text
            text2: Second text

        Returns:
            Similarity score (0-1)
        """
        emb1 = self.get_embedding(text1)
        emb2 = self.get_embedding(text2)

        # Cosine similarity
        similarity = util.cos_sim(emb1, emb2).item()

        return max(0.0, min(1.0, similarity))  # Clamp to [0, 1]

    def find_best_match(
        self,
        query: str,
        candidates: List[str],
        threshold: float = 0.7,
        top_k: int = 5
    ) -> List[Tuple[str, float]]:
        """
        Find best matching candidates for query

        Args:
            query: Query text
            candidates: List of candidate texts
            threshold: Minimum similarity threshold
            top_k: Return top K matches

        Returns:
            List of (candidate, score) tuples
        """
        if not candidates:
            return []

        # Get query embedding
        query_emb = self.get_embedding(query)

        # Get candidate embeddings
        candidate_embs = np.array([self.get_embedding(c) for c in candidates])

        # Calculate similarities
        similarities = util.cos_sim(query_emb, candidate_embs)[0].numpy()

        # Filter by threshold and sort
        matches = [
            (candidates[i], float(sim))
            for i, sim in enumerate(similarities)
            if sim >= threshold
        ]

        # Sort by similarity (descending)
        matches.sort(key=lambda x: x[1], reverse=True)

        return matches[:top_k]

    def match_college_enhanced(
        self,
        college_name: str,
        master_colleges: List[Dict],
        state: str = None,
        threshold: float = 0.75,
        combine_with_fuzzy: bool = True
    ) -> Tuple[Optional[Dict], float, str]:
        """
        Match college using transformer embeddings

        Args:
            college_name: College name to match
            master_colleges: List of master college dictionaries
            state: State for filtering (optional)
            threshold: Minimum similarity threshold
            combine_with_fuzzy: Combine semantic + fuzzy scores

        Returns:
            (matched_college, score, method)
        """
        if not college_name or not master_colleges:
            return None, 0.0, "no_input"

        # Filter by state if provided
        if state:
            state_normalized = state.strip().upper()
            candidates = [
                c for c in master_colleges
                if c.get('state', '').strip().upper() == state_normalized
            ]
            if not candidates:
                candidates = master_colleges  # Fallback to all
        else:
            candidates = master_colleges

        # Get candidate names
        candidate_names = [c.get('name', '') for c in candidates]

        # Find matches
        matches = self.find_best_match(college_name, candidate_names, threshold=threshold, top_k=5)

        if not matches:
            return None, 0.0, "no_semantic_match"

        # Get best match
        best_name, semantic_score = matches[0]

        # Find the college dict
        best_college = None
        for c in candidates:
            if c.get('name') == best_name:
                best_college = c
                break

        if not best_college:
            return None, 0.0, "college_not_found"

        # Optionally combine with fuzzy matching for better accuracy
        final_score = semantic_score
        method = "transformer_semantic"

        if combine_with_fuzzy:
            from rapidfuzz import fuzz
            fuzzy_score = fuzz.ratio(
                college_name.upper().strip(),
                best_name.upper().strip()
            ) / 100

            # Weighted combination: 60% semantic + 40% fuzzy
            final_score = (semantic_score * 0.6) + (fuzzy_score * 0.4)
            method = "transformer_hybrid"

        return best_college, final_score, method

    def build_college_index(self, colleges: List[Dict], force_rebuild: bool = False):
        """
        Pre-build embeddings for all colleges (for faster matching)

        Args:
            colleges: List of college dictionaries
            force_rebuild: Force rebuild even if cached
        """
        college_names = [c.get('name', '') for c in colleges]

        # Check if already cached
        uncached = []
        for name in college_names:
            cache_key = name.strip().lower()
            if cache_key not in self.embedding_cache or force_rebuild:
                uncached.append(name)

        if uncached:
            logger.info(f"Building embeddings for {len(uncached)} colleges...")
            self.batch_encode(uncached, show_progress=True)
            self._save_cache()
        else:
            logger.info("All college embeddings already cached")

    def cross_encoder_rerank(
        self,
        query: str,
        candidates: List[Tuple[str, float]],
        top_k: int = 3
    ) -> List[Tuple[str, float]]:
        """
        Re-rank candidates using cross-encoder for higher accuracy

        Args:
            query: Query text
            candidates: List of (candidate, score) tuples
            top_k: Return top K after re-ranking

        Returns:
            Re-ranked list of (candidate, score) tuples
        """
        try:
            from sentence_transformers import CrossEncoder

            # Use a cross-encoder model for re-ranking
            cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

            # Prepare pairs
            pairs = [(query, cand[0]) for cand in candidates]

            # Get scores
            scores = cross_encoder.predict(pairs)

            # Combine with original scores
            reranked = [
                (candidates[i][0], float(scores[i]))
                for i in range(len(candidates))
            ]

            # Sort by new scores
            reranked.sort(key=lambda x: x[1], reverse=True)

            return reranked[:top_k]

        except Exception as e:
            logger.warning(f"Cross-encoder re-ranking failed: {e}")
            return candidates[:top_k]

    def multi_field_match(
        self,
        college_name: str,
        address: str,
        master_colleges: List[Dict],
        weights: Dict[str, float] = None
    ) -> Tuple[Optional[Dict], float, str]:
        """
        Match using multiple fields with weighted scoring

        Args:
            college_name: College name
            address: Address
            master_colleges: List of master colleges
            weights: Field weights {'name': 0.7, 'address': 0.3}

        Returns:
            (matched_college, score, method)
        """
        if weights is None:
            weights = {'name': 0.7, 'address': 0.3}

        best_match = None
        best_score = 0.0

        # Get embeddings
        name_emb = self.get_embedding(college_name)
        address_emb = self.get_embedding(address) if address else None

        for college in master_colleges:
            # Calculate name similarity
            college_name_emb = self.get_embedding(college.get('name', ''))
            name_sim = util.cos_sim(name_emb, college_name_emb).item()

            # Calculate address similarity
            if address_emb is not None and college.get('address'):
                college_addr_emb = self.get_embedding(college.get('address', ''))
                addr_sim = util.cos_sim(address_emb, college_addr_emb).item()
            else:
                addr_sim = 0.0

            # Weighted score
            score = (name_sim * weights['name']) + (addr_sim * weights['address'])

            if score > best_score:
                best_score = score
                best_match = college

        return best_match, best_score, "transformer_multi_field"

    def __del__(self):
        """Save cache on deletion"""
        try:
            self._save_cache()
        except:
            pass


# Standalone usage example
if __name__ == "__main__":
    # Initialize matcher
    matcher = TransformerMatcher(model_name='all-MiniLM-L6-v2')

    # Example colleges
    master_colleges = [
        {'id': 1, 'name': 'Armed Forces Medical College', 'state': 'MAHARASHTRA'},
        {'id': 2, 'name': 'All India Institute of Medical Sciences Delhi', 'state': 'DELHI'},
        {'id': 3, 'name': 'Christian Medical College Vellore', 'state': 'TAMIL NADU'},
    ]

    # Test queries
    queries = [
        'AFMC Pune',
        'AIIMS New Delhi',
        'CMC Vellore'
    ]

    for query in queries:
        match, score, method = matcher.match_college_enhanced(
            query,
            master_colleges,
            threshold=0.5
        )

        if match:
            print(f"\nQuery: {query}")
            print(f"Match: {match['name']}")
            print(f"Score: {score:.2%}")
            print(f"Method: {method}")
