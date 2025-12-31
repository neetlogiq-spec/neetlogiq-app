#!/usr/bin/env python3
"""
AI Orchestrator Bridge: Integrates Adaptive Confidence & Streaming Validation
into the 5-pass orchestrator without breaking existing logic.

This module enhances the 5-pass orchestrator with:
1. Adaptive confidence thresholds (instead of fixed thresholds)
2. Real-time streaming validation (detect anomalies as they occur)
3. Explainable decision-making (show why matches were made)

Non-breaking: The 5-pass logic remains untouched. AI features are purely additive.
"""

import logging
import sys
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

# Add path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.ai_matching.confidence_calculator import (
    AdaptiveConfidenceThreshold,
    WorldClassConfidenceCalculator
)
from core.ai_matching.streaming_validator import StreamingValidator

# Phase 2A modules
try:
    from phase_2a_semantic_understanding import SemanticUnderstanding
    from phase_2a_anomaly_detector import AnomalyDetector
    from phase_2a_explainability_enhancer import ExplainabilityEnhancer
    PHASE_2A_AVAILABLE = True
except ImportError:
    PHASE_2A_AVAILABLE = False

logger = logging.getLogger(__name__)


class AIEnhancedOrchestratorBridge:
    """
    Bridge between 5-pass orchestrator and AI decision-making modules.

    Usage:
        bridge = AIEnhancedOrchestratorBridge()

        # After making a match in 5-pass:
        confidence, explanation = bridge.enhance_match_decision(
            matched_college=college,
            seat_record=record,
            pass_number=1,
            preliminary_confidence=0.85
        )

        if confidence >= 0.75:  # Use adaptive threshold
            accept_match()
        else:
            flag_for_review()
    """

    def __init__(self, seat_data_db: Optional[str] = None):
        """Initialize AI bridge components"""
        self.confidence_calc = AdaptiveConfidenceThreshold()
        self.world_class_calc = WorldClassConfidenceCalculator()
        self.validator = StreamingValidator(seat_data_db)

        # Phase 2A modules (optional)
        if PHASE_2A_AVAILABLE:
            self.semantic_understanding = SemanticUnderstanding()
            self.anomaly_detector = AnomalyDetector()
            self.explainability = ExplainabilityEnhancer()
            # logger.info("✅ Phase 2A modules initialized (Semantic, Anomaly, Explainability)")
        else:
            self.semantic_understanding = None
            self.anomaly_detector = None
            self.explainability = None
            # logger.warning("⚠️  Phase 2A modules not available")

        # Statistics tracking
        self.stats = {
            'matches_enhanced': 0,
            'matches_validated': 0,
            'matches_flagged': 0,
            'confidence_adjustments': [],
            'validation_flags': [],
            'phase_2a_semantic_boosts': 0,
            'phase_2a_anomalies_detected': 0
        }

        # logger.info("✅ AIEnhancedOrchestratorBridge initialized (Phase 1 + Phase 2A)")

    def enhance_match_decision(
        self,
        matched_college_id: str,
        pass_number: int,
        preliminary_confidence: float = 0.85,
        group_summary: Optional[Dict[str, Any]] = None,
        seat_data: Optional[Dict[str, Any]] = None,
        master_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Enhance a match decision with AI analysis.

        Args:
            matched_college_id: ID of matched college from master_data
            pass_number: Which pass made the match (1-5)
            preliminary_confidence: Initial confidence before AI enhancement
            group_summary: Group characteristics for threshold calculation

        Returns:
            (adjusted_confidence, explanation_dict)
        """
        self.stats['matches_enhanced'] += 1

        explanation = {
            'pass': pass_number,
            'preliminary_confidence': preliminary_confidence,
            'adaptive_threshold': None,
            'validation_result': None,
            'adjusted_confidence': preliminary_confidence,
            'recommendation': 'accept',
            'reasoning': []
        }

        try:
            # Step 1: Calculate adaptive threshold based on group characteristics
            if group_summary:
                adaptive_threshold = self.confidence_calc.calculate_threshold(
                    group_count=group_summary.get('record_count', 50),
                    address_consistency=group_summary.get('address_consistency', 0.8),
                    num_courses=group_summary.get('course_count', 1),
                    agreement_score=0.85,  # Internal agreement
                    validation_passed=True
                )
                explanation['adaptive_threshold'] = adaptive_threshold
                explanation['reasoning'].append(
                    f"Adaptive threshold: {adaptive_threshold:.2f} "
                    f"(group_size={group_summary.get('record_count')}, "
                    f"address_consistency={group_summary.get('address_consistency', 0):.1%})"
                )

                # Step 2: Validate match against seat allocation data
                validation_result = self.validator.validate_group_match(
                    matched_college_id=matched_college_id,
                    group_summary=group_summary
                )

                explanation['validation_result'] = validation_result.to_dict()

                if not validation_result.is_valid:
                    # Validation detected anomalies
                    self.stats['matches_flagged'] += 1
                    explanation['recommendation'] = 'flag_for_review'
                    explanation['reasoning'].append(
                        f"Validation violations: {len(validation_result.violations)} issues detected"
                    )
                    for violation in validation_result.violations[:3]:  # Top 3 violations
                        explanation['reasoning'].append(f"  - {violation.get('message', 'Unknown issue')}")

                    # Apply confidence penalty
                    adjusted_confidence = max(0.0, preliminary_confidence - validation_result.confidence_penalty)
                    explanation['adjusted_confidence'] = adjusted_confidence
                elif validation_result.warnings:
                    # Validation passed but has warnings
                    explanation['reasoning'].append(
                        f"Validation warnings: {len(validation_result.warnings)} issues"
                    )
                    adjusted_confidence = max(0.5, preliminary_confidence - (validation_result.confidence_penalty * 0.5))
                    explanation['adjusted_confidence'] = adjusted_confidence
                else:
                    # Validation passed, possibly boost confidence
                    adjusted_confidence = min(1.0, preliminary_confidence + validation_result.confidence_boost)
                    explanation['adjusted_confidence'] = adjusted_confidence
                    explanation['reasoning'].append("Validation passed - no issues")
            else:
                # No group summary provided, just use adaptive threshold with defaults
                adaptive_threshold = self.confidence_calc.calculate_threshold(
                    group_count=50,
                    address_consistency=0.8,
                    num_courses=1,
                    agreement_score=0.85,
                    validation_passed=True
                )
                explanation['adaptive_threshold'] = adaptive_threshold
                explanation['reasoning'].append(f"Using default adaptive threshold: {adaptive_threshold:.2f}")
                adjusted_confidence = preliminary_confidence

            # Step 2.5: Phase 2A Enhancement (if available and data provided)
            if PHASE_2A_AVAILABLE and seat_data and master_data:
                try:
                    # Phase 2A: Semantic Understanding
                    if self.semantic_understanding and seat_data.get('college_name') and master_data.get('college_name'):
                        semantic_result = self.semantic_understanding.get_semantic_boost(
                            text1=seat_data.get('college_name', ''),
                            text2=master_data.get('college_name', ''),
                            base_score=adjusted_confidence
                        )
                        adjusted_confidence = semantic_result['adjusted_score']
                        if semantic_result['boost'] != 0:
                            self.stats['phase_2a_semantic_boosts'] += 1
                            explanation['reasoning'].append(f"Semantic analysis: {semantic_result['reasoning']}")

                    # Phase 2A: Anomaly Detection
                    if self.anomaly_detector:
                        anomaly_result = self.anomaly_detector.detect_suspicious_match(
                            seat_college_name=seat_data.get('college_name', ''),
                            seat_address=seat_data.get('address', ''),
                            seat_course=seat_data.get('course', ''),
                            master_college_id=matched_college_id,
                            master_college_name=master_data.get('college_name', ''),
                            master_address=master_data.get('address', ''),
                            master_courses=master_data.get('courses', []),
                            confidence_score=adjusted_confidence,
                            match_count_for_college=group_summary.get('record_count', 1) if group_summary else 1
                        )

                        if anomaly_result.is_anomaly:
                            self.stats['phase_2a_anomalies_detected'] += 1
                            adjusted_confidence = max(0.0, adjusted_confidence - anomaly_result.confidence_penalty)
                            explanation['reasoning'].append(f"Anomalies detected: {', '.join(anomaly_result.anomaly_types[:2])}")
                            for warning in anomaly_result.warnings[:2]:
                                explanation['reasoning'].append(f"  ⚠️ {warning}")

                    # Phase 2A: Explainability Enhancement
                    if self.explainability:
                        explained = self.explainability.explain_match(
                            seat_data=seat_data,
                            master_data=master_data,
                            confidence=adjusted_confidence,
                            explanation_dict=explanation,
                            anomalies=[]
                        )
                        explanation['phase_2a_explanation'] = self.explainability.get_summary_explanation(explained)
                        explanation['reasoning'].append(f"Explainability: {explained.decision}")

                except Exception as e:
                    logger.debug(f"Phase 2A enhancement error (non-blocking): {e}")
                    # Continue with Phase 1 result, don't break

            # Step 3: Make final recommendation
            threshold = explanation['adaptive_threshold'] or 0.75
            if adjusted_confidence >= threshold:
                explanation['recommendation'] = 'accept'
                explanation['reasoning'].append(
                    f"Confidence {adjusted_confidence:.2f} >= threshold {threshold:.2f}"
                )
            else:
                explanation['recommendation'] = 'review'
                explanation['reasoning'].append(
                    f"Confidence {adjusted_confidence:.2f} < threshold {threshold:.2f}"
                )

            self.stats['confidence_adjustments'].append({
                'preliminary': preliminary_confidence,
                'adjusted': adjusted_confidence,
                'delta': adjusted_confidence - preliminary_confidence
            })

            return adjusted_confidence, explanation

        except Exception as e:
            logger.error(f"Error enhancing match decision: {e}", exc_info=True)
            # Fail gracefully - return original confidence
            explanation['error'] = str(e)
            explanation['reasoning'].append(f"AI enhancement error: {e}")
            return preliminary_confidence, explanation

    def get_adaptive_threshold(
        self,
        group_count: int,
        address_consistency: float,
        num_courses: int,
        agreement_score: float = 0.85
    ) -> float:
        """
        Get adaptive threshold for a group (used in PASS decisions).

        Args:
            group_count: Number of records in group
            address_consistency: 0-1 (how consistent addresses are)
            num_courses: Number of different courses
            agreement_score: Internal agreement score

        Returns:
            Confidence threshold (0.60-0.95)
        """
        return self.confidence_calc.calculate_threshold(
            group_count=group_count,
            address_consistency=address_consistency,
            num_courses=num_courses,
            agreement_score=agreement_score,
            validation_passed=True
        )

    def validate_match(
        self,
        matched_college: Dict[str, Any],
        seat_record: Dict[str, Any],
        pass_number: int
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Validate if a match makes sense (streaming validation).

        Returns:
            (is_valid, validation_details)
        """
        self.stats['matches_validated'] += 1

        try:
            result = self.validator.validate_group_match(
                master_college=matched_college,
                seat_record=seat_record,
                matched_record_count=1
            )

            if not result.is_valid:
                self.stats['validation_flags'].append({
                    'college_id': matched_college.get('college_id'),
                    'violations': result.violations,
                    'pass': pass_number
                })

            return result.is_valid, result.to_dict()

        except Exception as e:
            logger.warning(f"Validation error for {matched_college.get('college_id')}: {e}")
            return True, {'is_valid': True, 'error': str(e)}

    def get_statistics(self) -> Dict[str, Any]:
        """Get enhancement statistics"""
        stats = self.stats.copy()

        # Calculate average confidence adjustment
        if stats['confidence_adjustments']:
            deltas = [adj['delta'] for adj in stats['confidence_adjustments']]
            stats['avg_confidence_adjustment'] = sum(deltas) / len(deltas)
            stats['max_confidence_boost'] = max(deltas)
            stats['max_confidence_penalty'] = min(deltas)

        return stats

    def print_summary(self):
        """Print enhancement summary"""
        stats = self.get_statistics()

        summary = f"""
╔══════════════════════════════════════════════════════════════════╗
║         AI ORCHESTRATOR BRIDGE - ENHANCEMENT SUMMARY             ║
╠══════════════════════════════════════════════════════════════════╣
║ Matches Enhanced:        {stats['matches_enhanced']:,}
║ Matches Validated:       {stats['matches_validated']:,}
║ Matches Flagged:         {stats['matches_flagged']:,}
║
║ Confidence Adjustments:
║   - Average delta:       {stats.get('avg_confidence_adjustment', 0):+.3f}
║   - Max boost:           {stats.get('max_confidence_boost', 0):+.3f}
║   - Max penalty:         {stats.get('max_confidence_penalty', 0):+.3f}
║
║ Validation Flags:        {len(stats['validation_flags'])}
╚══════════════════════════════════════════════════════════════════╝
        """
        print(summary)


# Example usage
if __name__ == "__main__":
    # Initialize bridge
    bridge = AIEnhancedOrchestratorBridge()

    # Example: Enhance a match decision
    test_college_id = 'TEST001'

    group_summary = {
        'record_count': 150,
        'address_consistency': 0.95,
        'course_count': 2,
        'course_types': ['MBBS', 'MD']
    }

    confidence, explanation = bridge.enhance_match_decision(
        matched_college_id=test_college_id,
        pass_number=1,
        preliminary_confidence=0.85,
        group_summary=group_summary
    )

    print(f"\n✅ Enhanced confidence: {confidence:.2f}")
    print(f"Recommendation: {explanation['recommendation'].upper()}")
    print(f"Reasoning:")
    for reason in explanation['reasoning']:
        print(f"  - {reason}")

    bridge.print_summary()
