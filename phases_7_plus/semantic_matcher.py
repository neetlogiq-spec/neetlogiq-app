"""
Phase 7: Semantic Matcher using Sentence Transformers
Understands MEANING, not just string similarity
- "GOVT Medical College" ↔ "Government Medical College" = 0.95 match
- "AIIMS ND" ↔ "AIIMS New Delhi" = 0.92 match
"""

import torch
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer, util
from typing import List, Dict, Optional, Tuple
import os
from pathlib import Path

class SemanticMatcher:
    """
    Uses Sentence Transformers to create semantic embeddings
    for college names and find matches based on meaning.
    """

    def __init__(self, model_name: str = 'BAAI/bge-base-en-v1.5',
                 cache_dir: str = 'data'):
        """
        Initialize SemanticMatcher with pre-trained model.

        Args:
            model_name: HuggingFace model name (BAAI/bge-base-en-v1.5 for fast English matching)
            cache_dir: Directory to cache embeddings
        """
        self.model_name = model_name
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Load model (BGE-base-en-v1.5 is faster than BGE-M3)
        print(f"Loading semantic model: {model_name}")
        self.model = SentenceTransformer(model_name)

        self.college_embeddings = None
        self.college_names = None
        self.college_data = None
        self.embedding_cache_path = self.cache_dir / 'college_embeddings.pt'
        self.metadata_cache_path = self.cache_dir / 'college_metadata.pkl'

    def generate_embeddings(self, colleges_data: List[Dict]) -> np.ndarray:
        """
        Generate semantic embeddings for all colleges (one-time operation).

        Args:
            colleges_data: List of dicts with 'name', 'id', 'state' keys

        Returns:
            numpy array of embeddings
        """
        print(f"Generating embeddings for {len(colleges_data)} colleges...")

        # Extract college names
        college_names = [college.get('name', '') for college in colleges_data]

        # Generate embeddings
        embeddings = self.model.encode(
            college_names,
            show_progress_bar=True,
            convert_to_tensor=False,
            batch_size=32
        )

        # Store
        self.college_embeddings = embeddings.astype('float32')
        self.college_names = college_names
        self.college_data = colleges_data

        # Save to disk
        torch.save(torch.from_numpy(self.college_embeddings), self.embedding_cache_path)
        with open(self.metadata_cache_path, 'wb') as f:
            pickle.dump({
                'names': self.college_names,
                'data': self.college_data
            }, f)

        print(f"✅ Generated and cached embeddings for {len(colleges_data)} colleges")
        return self.college_embeddings

    def load_embeddings(self) -> bool:
        """Load cached embeddings from disk.

        Tries multiple locations and formats:
        1. Primary: data/college_embeddings.pt + data/college_metadata.pkl
        2. Fallback: data/embeddings/college_embeddings.json
        """
        import json

        # Try primary format (PT + PKL)
        if self.embedding_cache_path.exists() and self.metadata_cache_path.exists():
            try:
                print(f"Loading cached embeddings from {self.embedding_cache_path}")
                self.college_embeddings = torch.load(self.embedding_cache_path).numpy()

                with open(self.metadata_cache_path, 'rb') as f:
                    data = pickle.load(f)
                    self.college_names = data['names']
                    self.college_data = data['data']

                print(f"✅ Loaded {len(self.college_embeddings)} cached embeddings from PT/PKL format")
                return True
            except Exception as e:
                print(f"⚠️  Failed to load PT/PKL embeddings: {e}")

        # Try fallback format (JSON in data/embeddings/)
        json_embeddings_path = Path('data/embeddings/college_embeddings.json')
        if json_embeddings_path.exists():
            try:
                print(f"Loading cached embeddings from {json_embeddings_path}")
                with open(json_embeddings_path, 'r') as f:
                    data = json.load(f)

                    # Handle list of dicts format: [{'embedding': [...], 'name': '...', ...}, ...]
                    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                        # Extract embeddings, names, and data from list of dicts
                        embeddings_list = []
                        names_list = []
                        data_list = []

                        for item in data:
                            if 'embedding' in item:
                                embeddings_list.append(item['embedding'])
                                names_list.append(item.get('name', ''))
                                data_list.append({
                                    'id': item.get('id', ''),
                                    'name': item.get('name', ''),
                                    'state': item.get('metadata', {}).get('state', '')
                                })

                        if embeddings_list:
                            self.college_embeddings = np.array(embeddings_list, dtype='float32')
                            self.college_names = names_list
                            self.college_data = data_list
                            print(f"✅ Loaded {len(self.college_embeddings)} cached embeddings from JSON format")
                            return True

                    # Handle dict format with 'embeddings' key
                    elif isinstance(data, dict) and 'embeddings' in data:
                        self.college_embeddings = np.array(data['embeddings'], dtype='float32')
                        self.college_names = data.get('names', [])
                        self.college_data = data.get('data', [])
                        print(f"✅ Loaded {len(self.college_embeddings)} cached embeddings from JSON dict format")
                        return True

                    # Handle plain list of embeddings
                    elif isinstance(data, list) and len(data) > 0:
                        self.college_embeddings = np.array(data, dtype='float32')
                        self.college_names = [f"college_{i}" for i in range(len(data))]
                        self.college_data = []
                        print(f"✅ Loaded {len(self.college_embeddings)} cached embeddings from JSON list format")
                        return True

            except Exception as e:
                print(f"⚠️  Failed to load JSON embeddings: {e}")
                import traceback
                traceback.print_exc()

        print(f"⚠️  No cached embeddings found at {self.embedding_cache_path} or {json_embeddings_path}")
        return False

    def find_match(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Find best matching colleges for a query.

        Args:
            query: College name to search for
            top_k: Number of top matches to return

        Returns:
            List of dicts with college_id, name, similarity, method
        """
        if self.college_embeddings is None:
            raise ValueError("Embeddings not loaded. Call generate_embeddings() first.")

        # Encode query
        query_embedding = self.model.encode(query, convert_to_tensor=True)

        # Convert college embeddings to tensor
        college_embeddings_tensor = torch.from_numpy(self.college_embeddings)

        # Compute similarities using cosine similarity
        similarities = util.cos_sim(query_embedding, college_embeddings_tensor)[0]

        # Get top matches
        top_results = torch.topk(similarities, k=min(top_k, len(similarities)))

        results = []
        for score, idx in zip(top_results.values, top_results.indices):
            idx_val = idx.item()
            score_val = score.item()

            results.append({
                'college_id': self.college_data[idx_val].get('id') if self.college_data else None,
                'college_name': self.college_names[idx_val],
                'state': self.college_data[idx_val].get('state') if self.college_data else None,
                'similarity': float(score_val),
                'method': 'semantic_transformer',
                'rank': len(results) + 1
            })

        return results

    def batch_find_matches(self, queries: List[str], top_k: int = 5) -> List[List[Dict]]:
        """
        Find matches for multiple queries efficiently.

        Args:
            queries: List of college names
            top_k: Number of top matches per query

        Returns:
            List of match lists, one per query
        """
        if self.college_embeddings is None:
            raise ValueError("Embeddings not loaded. Call generate_embeddings() first.")

        # Encode all queries at once (more efficient)
        query_embeddings = self.model.encode(
            queries,
            convert_to_tensor=True,
            batch_size=32,
            show_progress_bar=True
        )

        # Convert college embeddings to tensor
        college_embeddings_tensor = torch.from_numpy(self.college_embeddings)

        # Compute all similarities
        all_similarities = util.cos_sim(query_embeddings, college_embeddings_tensor)

        all_results = []
        for similarities in all_similarities:
            top_results = torch.topk(similarities, k=min(top_k, len(similarities)))

            results = []
            for score, idx in zip(top_results.values, top_results.indices):
                idx_val = idx.item()
                score_val = score.item()

                results.append({
                    'college_id': self.college_data[idx_val].get('id') if self.college_data else None,
                    'college_name': self.college_names[idx_val],
                    'state': self.college_data[idx_val].get('state') if self.college_data else None,
                    'similarity': float(score_val),
                    'method': 'semantic_transformer'
                })

            all_results.append(results)

        return all_results

    def encode_college_name(self, college_name: str) -> np.ndarray:
        """
        Get embedding vector for a college name.

        Args:
            college_name: Name to encode

        Returns:
            Embedding vector as numpy array
        """
        return self.model.encode(college_name)

    def similarity_score(self, text1: str, text2: str) -> float:
        """
        Calculate similarity between two texts (0-1).

        Args:
            text1: First text
            text2: Second text

        Returns:
            Similarity score between 0 and 1
        """
        embeddings = self.model.encode([text1, text2], convert_to_tensor=True)
        similarity = util.cos_sim(embeddings[0], embeddings[1])
        return float(similarity.item())

    def get_stats(self) -> Dict:
        """Get statistics about cached embeddings."""
        return {
            'model_name': self.model_name,
            'num_colleges': len(self.college_embeddings) if self.college_embeddings is not None else 0,
            'embedding_dim': self.college_embeddings.shape[1] if self.college_embeddings is not None else 0,
            'cache_dir': str(self.cache_dir),
            'embedding_cache_exists': self.embedding_cache_path.exists(),
            'metadata_cache_exists': self.metadata_cache_path.exists()
        }
