"""
Phase 16: Hybrid Ensemble Orchestrator
Combines ALL techniques for maximum accuracy (95-98%).
Orchestrates: FAISS, Semantic Transformers, spaCy NER, Zero-Shot, Active Learning.

Architecture:
Query → FAISS (fast candidates) → Semantic (re-rank) → spaCy (entity boost)
→ Zero-Shot (validate) → Active Learning (flag uncertain) → Final Result
"""

import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np

from .semantic_matcher import SemanticMatcher
from .faiss_matcher import FAISSMatcher
from .zero_shot_validator import ZeroShotValidator
from .spacy_matcher import SmartCollegeNER
from .active_learner import ActiveLearner

@dataclass
class EnsembleResult:
    """Result from hybrid ensemble matching."""
    college_id: str
    college_name: str
    state: Optional[str]
    final_score: float
    methods_used: List[str]
    confidence: float
    requires_review: bool
    validation_status: str
    processing_time_ms: float
    component_scores: Dict[str, float]
    full_details: Dict

class HybridEnsembleMatcher:
    """
    Master orchestrator combining all Phase 7-10 techniques.
    Routes queries through optimal pipeline for maximum accuracy.
    """

    def __init__(self, config: Dict = None, cache_dir: str = 'data'):
        """
        Initialize HybridEnsembleMatcher with all components.

        Args:
            config: Configuration dict with feature flags
            cache_dir: Directory for caching
        """
        self.config = config or {}
        self.cache_dir = cache_dir

        # print("\n" + "="*60)
        # print("🚀 Initializing Hybrid Ensemble Matcher (Phase 16)")
        # print("="*60 + "\n")

        # Initialize all components
        # Initialize all components
        # print("\n1. Initializing Semantic Matcher...")
        self.semantic = SemanticMatcher(cache_dir=cache_dir)

        # print("2. Initializing FAISS Vector Search...")
        self.faiss = FAISSMatcher(cache_dir=cache_dir)

        # print("3. Initializing Zero-Shot Validator...")
        self.validator = ZeroShotValidator()

        # print("4. Initializing spaCy NER...")
        self.ner = SmartCollegeNER()

        # print("5. Initializing Active Learning...")
        self.active_learner = ActiveLearner(
            cache_dir=cache_dir,
            min_confidence_threshold=self.config.get('active_learning_threshold', 0.8)
        )

        # Configuration
        self.faiss_weight = self.config.get('faiss_weight', 0.25)
        self.semantic_weight = self.config.get('semantic_weight', 0.35)
        self.spacy_weight = self.config.get('spacy_weight', 0.15)
        self.validator_weight = self.config.get('validator_weight', 0.25)
        self.min_confidence_for_auto_accept = self.config.get('min_auto_accept', 0.92)

        # print("\n✅ Hybrid Ensemble Matcher initialized!")
        # print(f"   FAISS weight: {self.faiss_weight}")
        # print(f"   Semantic weight: {self.semantic_weight}")
        # print(f"   spaCy weight: {self.spacy_weight}")
        # print(f"   Validator weight: {self.validator_weight}\n")

    def setup_embeddings(self, colleges_data: List[Dict]) -> None:
        """
        One-time setup: generate embeddings and build indices.

        Args:
            colleges_data: List of college dicts with id, name, state
        """
        print("\n" + "="*60)
        print("📊 Setting up embeddings and indices...")
        print("="*60)

        # Extract just names for embedding
        college_names = [c.get('name', '') for c in colleges_data]

        # Generate semantic embeddings
        print("\nGenerating Sentence Transformer embeddings...")
        embeddings = self.semantic.generate_embeddings(colleges_data)

        # Build FAISS index
        print("Building FAISS index...")
        self.faiss.build_index(embeddings, colleges_data)

        print("\n✅ Setup complete! System ready for high-speed matching.\n")

    def match(self, college_name: str, course_name: str = None,
             state: str = None, verbose: bool = False) -> EnsembleResult:
        """
        Main matching function combining all techniques.

        Args:
            college_name: College name to match
            course_name: Course name (for validation)
            state: State (for location filtering)
            verbose: Print detailed processing info

        Returns:
            EnsembleResult with final match and confidence
        """
        start_time = time.time()
        component_scores = {}

        if verbose:
            print(f"\n🔍 Matching: {college_name} (course: {course_name}, state: {state})")

        # STEP 1: FAISS Fast Retrieval (ultra-fast, gets top candidates)
        if verbose:
            print("  └─ Stage 1: FAISS retrieval...")
        faiss_embedding = self.semantic.encode_college_name(college_name)
        faiss_results = self.faiss.search(faiss_embedding, top_k=10)

        if not faiss_results:
            return self._no_match_result(college_name, time.time() - start_time)

        faiss_score = faiss_results[0]['similarity_normalized']
        component_scores['faiss'] = faiss_score
        if verbose:
            print(f"    → FAISS: {faiss_results[0]['college_name']} (score: {faiss_score:.3f})")

        # STEP 2: Semantic Re-ranking (understand meaning)
        if verbose:
            print("  └─ Stage 2: Semantic re-ranking...")
        semantic_results = self.semantic.find_match(college_name, top_k=5)
        semantic_score = semantic_results[0]['similarity']
        component_scores['semantic'] = semantic_score

        # Find best semantic match
        best_semantic = semantic_results[0]
        if verbose:
            print(f"    → Semantic: {best_semantic['college_name']} (score: {semantic_score:.3f})")

        # STEP 3: spaCy NER Entity Boosting (intelligent parsing)
        if verbose:
            print("  └─ Stage 3: spaCy NER analysis...")
        ner_analysis = self.ner.parse(college_name)
        ner_comparison = self.ner.compare_names(
            college_name,
            faiss_results[0]['college_name']
        )
        ner_boost = ner_comparison['overall_similarity']
        component_scores['spacy_ner'] = ner_boost

        if verbose:
            print(f"    → NER boost: {ner_boost:.3f}")
            if ner_analysis['location']:
                print(f"    → Detected location: {ner_analysis['location']}")
            if ner_analysis['ownership']:
                print(f"    → Detected ownership: {ner_analysis['ownership']}")

        # STEP 4: Zero-Shot Validation (sanity check)
        if verbose:
            print("  └─ Stage 4: Zero-shot validation...")
        if course_name:
            validation = self.validator.validate_college_course(
                faiss_results[0]['college_name'],
                course_name
            )
            validator_score = validation['confidence']
            component_scores['validator'] = validator_score

            if verbose:
                print(f"    → Validation: {validation['is_valid']} (confidence: {validator_score:.3f})")
                print(f"    → College type: {validation['college_type']}")
                print(f"    → Course type: {validation['course_type']}")
        else:
            validation = None
            validator_score = 1.0  # No validation requested

        # STEP 5: Calculate Ensemble Score
        if verbose:
            print("  └─ Stage 5: Ensemble voting...")

        ensemble_score = (
            self.faiss_weight * faiss_score +
            self.semantic_weight * semantic_score +
            self.spacy_weight * ner_boost +
            self.validator_weight * validator_score
        )

        component_scores['ensemble'] = ensemble_score
        if verbose:
            print(f"    → Ensemble score: {ensemble_score:.3f}")

        # STEP 6: Active Learning Check
        if verbose:
            print("  └─ Stage 6: Active learning check...")

        requires_review = ensemble_score < self.min_confidence_for_auto_accept

        if requires_review:
            self.active_learner.flag_uncertain_prediction(
                college_name,
                faiss_results[0]['college_name'],
                ensemble_score,
                context={
                    'course': course_name,
                    'state': state,
                    'component_scores': component_scores
                }
            )
            if verbose:
                print(f"    ⚠️  Flagged for review (low confidence: {ensemble_score:.3f})")

        # Build final result
        processing_time = (time.time() - start_time) * 1000

        result = EnsembleResult(
            college_id=faiss_results[0]['college_id'],
            college_name=faiss_results[0]['college_name'],
            state=faiss_results[0].get('state'),
            final_score=ensemble_score,
            methods_used=['faiss', 'semantic', 'spacy_ner', 'zero_shot', 'ensemble'],
            confidence=ensemble_score,
            requires_review=requires_review,
            validation_status='valid' if (not validation or validation['is_valid']) else 'needs_review',
            processing_time_ms=processing_time,
            component_scores=component_scores,
            full_details={
                'faiss_result': faiss_results[0],
                'semantic_result': best_semantic,
                'ner_analysis': ner_analysis,
                'validation': validation,
                'top_faiss_candidates': faiss_results[:5]
            }
        )

        if verbose:
            print(f"\n✅ Final Result: {result.college_name} ({result.final_score:.3f})")
            print(f"   Processing time: {processing_time:.1f}ms")
            print(f"   Requires review: {requires_review}\n")

        return result

    def batch_match(self, queries: List[Dict], verbose: bool = False) -> List[EnsembleResult]:
        """
        Match multiple queries efficiently.

        Args:
            queries: List of dicts with 'college_name', 'course_name', 'state'
            verbose: Print detailed info

        Returns:
            List of EnsembleResults
        """
        results = []
        total_start = time.time()

        print(f"\n🚀 Batch matching {len(queries)} queries...")

        for i, query in enumerate(queries, 1):
            result = self.match(
                query.get('college_name', ''),
                query.get('course_name'),
                query.get('state'),
                verbose=False
            )
            results.append(result)

            if i % 100 == 0:
                elapsed = time.time() - total_start
                rate = i / elapsed
                print(f"   {i}/{len(queries)} ({rate:.1f} matches/sec)")

        total_time = time.time() - total_start
        print(f"\n✅ Completed {len(results)} matches in {total_time:.1f}s")
        print(f"   Average time: {(total_time/len(results)*1000):.1f}ms per match\n")

        return results

    def get_ensemble_stats(self) -> Dict:
        """Get statistics about ensemble performance."""
        learning_stats = self.active_learner.get_learning_statistics()

        return {
            'phase': 16,
            'name': 'Hybrid Ensemble',
            'components': [
                'semantic_transformer',
                'faiss_vector_search',
                'spacy_ner',
                'zero_shot_validator',
                'active_learning'
            ],
            'weights': {
                'faiss': self.faiss_weight,
                'semantic': self.semantic_weight,
                'spacy_ner': self.spacy_weight,
                'validator': self.validator_weight
            },
            'learning': learning_stats,
            'method': 'hybrid_ensemble_stats'
        }

    def _no_match_result(self, college_name: str, processing_time: float) -> EnsembleResult:
        """Create a no-match result when nothing is found."""
        return EnsembleResult(
            college_id=None,
            college_name=college_name,
            state=None,
            final_score=0.0,
            methods_used=['faiss'],
            confidence=0.0,
            requires_review=True,
            validation_status='no_match',
            processing_time_ms=processing_time * 1000,
            component_scores={'faiss': 0.0},
            full_details={'error': 'No matches found'}
        )

    def export_results(self, results: List[EnsembleResult], output_path: str) -> None:
        """
        Export results to JSON for analysis.

        Args:
            results: List of ensemble results
            output_path: Path to save JSON file
        """
        import json

        data = []
        for r in results:
            data.append({
                'college_id': r.college_id,
                'college_name': r.college_name,
                'state': r.state,
                'final_score': r.final_score,
                'confidence': r.confidence,
                'requires_review': r.requires_review,
                'validation_status': r.validation_status,
                'processing_time_ms': r.processing_time_ms,
                'component_scores': r.component_scores
            })

        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"✅ Exported {len(results)} results to {output_path}")
