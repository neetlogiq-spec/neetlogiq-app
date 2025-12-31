#!/usr/bin/env python3
"""
Pass 5D: The Single Campus Council
A specialized council for matching address-less, single-campus colleges.

2 Absolute Conditions:
1. Single-campus college (count == 1 in master DB)
2. Unique name (distinctive words only appear in this college)
"""

import logging
import re
import sqlite3
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any
import jellyfish
from rapidfuzz import fuzz

logger = logging.getLogger(__name__)


# ============================================================================
# SHARED CONSTANTS
# ============================================================================

NEGATIVE_WORDS = {
    # Generic institutional words
    'MEDICAL', 'DENTAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'UNIVERSITY',
    'GOVERNMENT', 'GOVT', 'PRIVATE', 'PVT', 'STATE', 'NATIONAL', 'CENTRAL',
    # Common suffixes
    'AND', 'OF', 'THE', 'FOR', 'IN', 'AT',
    # Common descriptors
    'SUPER', 'SPECIALTY', 'SPECIALITY', 'MULTISPECIALTY', 'GENERAL',
    'DISTRICT', 'TEACHING', 'RESEARCH', 'TRAINING', 'HEALTH', 'CARE',
    'FOUNDATION', 'TRUST', 'SOCIETY', 'CHARITABLE', 'MEMORIAL',
    # Common types
    'SCIENCES', 'SCIENCE', 'STUDIES', 'EDUCATION', 'ACADEMY',
    # Size/status words
    'PREMIER', 'ADVANCED', 'MULTI', 'MODERN', 'NEW'
}


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class Vote:
    member_name: str
    decision: str  # 'MATCH', 'REJECT', 'ABSTAIN'
    confidence: float  # 0.0 to 1.0
    reason: str
    is_veto: bool = False


@dataclass
class Candidate:
    id: str
    name: str
    normalized_name: str
    address: str
    state: str
    college_type: str


# ============================================================================
# COUNCIL MEMBER BASE CLASS
# ============================================================================

class CouncilMember(ABC):
    """Abstract base class for all Council Members."""
    
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def vote(self, input_name: str, input_state: str, candidate: Candidate, 
             all_candidates: List[Candidate], context: Dict) -> Vote:
        """Cast a vote on whether the input matches the candidate."""
        pass


# ============================================================================
# COUNCIL MEMBERS (7 MEMBERS)
# ============================================================================

class TheStrictFuzzyMatcher(CouncilMember):
    """
    Member 1: The Strict Fuzzy Matcher
    Requires >= 98% similarity using token_sort_ratio.
    """
    def __init__(self):
        super().__init__("The Strict Fuzzy Matcher")
        self.threshold = 98

    def vote(self, input_name: str, input_state: str, candidate: Candidate,
             all_candidates: List[Candidate], context: Dict) -> Vote:
        compare_name = candidate.normalized_name or candidate.name
        score = fuzz.token_sort_ratio(input_name.upper(), compare_name.upper())
        
        if score >= self.threshold:
            return Vote(self.name, 'MATCH', score / 100.0, 
                       f"High similarity ({score:.1f}%)")
        elif score >= 90:
            return Vote(self.name, 'ABSTAIN', 0.0, 
                       f"Moderate similarity ({score:.1f}%) - below threshold")
        else:
            return Vote(self.name, 'REJECT', 0.8, 
                       f"Low similarity ({score:.1f}%)")


class TheUniqueWordValidator(CouncilMember):
    """
    Member 2: The Unique Word Validator
    Ensures the college name contains unique words that don't appear in any
    other college in the same state.
    """
    def __init__(self):
        super().__init__("The Unique Word Validator")

    def _extract_unique_words(self, name: str) -> set:
        """Extract unique identifying words (>= 3 chars for acronyms, > 3 for regular words)."""
        # Split on hyphens and spaces
        normalized = re.sub(r'[-]', ' ', name.upper())
        words = set(normalized.split())
        # Filter: allow 3-char uppercase acronyms, or words > 3 chars
        unique = set()
        for w in words:
            if w in NEGATIVE_WORDS or w.isdigit():
                continue
            # Allow 3-char acronyms (all uppercase) or words > 3 chars
            if len(w) >= 3 and (w.isupper() or len(w) > 3):
                unique.add(w)
        return unique

    def vote(self, input_name: str, input_state: str, candidate: Candidate,
             all_candidates: List[Candidate], context: Dict) -> Vote:
        input_unique = self._extract_unique_words(input_name)
        
        if not input_unique:
            # No unique words found - this is a generic name like "Govt Medical College"
            return Vote(self.name, 'REJECT', 0.95, 
                       "No unique identifying words found (generic name)", is_veto=True)
        
        candidate_unique = self._extract_unique_words(candidate.normalized_name or candidate.name)
        
        # Check if input unique words appear in any OTHER candidate
        for other in all_candidates:
            if other.id == candidate.id:
                continue
            
            other_unique = self._extract_unique_words(other.normalized_name or other.name)
            
            # If ANY of our unique words appear in another college, it's risky
            overlap = input_unique & other_unique
            if overlap:
                return Vote(self.name, 'REJECT', 0.9, 
                           f"Unique words '{', '.join(overlap)}' also appear in '{other.name[:50]}'",
                           is_veto=True)
        
        # Check overlap with candidate
        common = input_unique & candidate_unique
        if common:
            return Vote(self.name, 'MATCH', 0.99, 
                       f"Unique words match: {', '.join(common)}")
        else:
            return Vote(self.name, 'ABSTAIN', 0.0, 
                       f"No unique word overlap (Input: {input_unique}, Candidate: {candidate_unique})")


class TheSingleCampusVerifier(CouncilMember):
    """
    Member 3: The Single Campus Verifier
    Ensures the matched college appears exactly ONCE in the master database
    for the given state. Vetoes multi-campus chains.
    """
    def __init__(self):
        super().__init__("The Single Campus Verifier")

    def vote(self, input_name: str, input_state: str, candidate: Candidate,
             all_candidates: List[Candidate], context: Dict) -> Vote:
        # Count how many colleges have the SAME normalized name in this state
        candidate_name = (candidate.normalized_name or candidate.name).upper()
        
        count = 0
        for c in all_candidates:
            c_name = (c.normalized_name or c.name).upper()
            if c_name == candidate_name:
                count += 1
        
        if count == 1:
            return Vote(self.name, 'MATCH', 0.99, 
                       "Single campus verified (count=1)")
        else:
            return Vote(self.name, 'REJECT', 1.0, 
                       f"Multi-campus detected (count={count})", is_veto=True)


class TheSafetyMarginChecker(CouncilMember):
    """
    Member 4: The Safety Margin Checker
    Ensures there's a clear gap between the best match and second-best match.
    Vetoes if the decision is ambiguous.
    """
    def __init__(self):
        super().__init__("The Safety Margin Checker")
        self.min_gap = 10  # Percentage points

    def vote(self, input_name: str, input_state: str, candidate: Candidate,
             all_candidates: List[Candidate], context: Dict) -> Vote:
        # Calculate scores for all candidates
        scores = []
        for c in all_candidates:
            c_name = c.normalized_name or c.name
            score = fuzz.token_sort_ratio(input_name.upper(), c_name.upper())
            scores.append((c.id, c.name, score))
        
        # Sort descending
        scores.sort(key=lambda x: x[2], reverse=True)
        
        if len(scores) < 2:
            return Vote(self.name, 'MATCH', 0.99, "Only one candidate")
        
        best_score = scores[0][2]
        second_score = scores[1][2]
        gap = best_score - second_score
        
        # Verify the candidate IS the best match
        if scores[0][0] != candidate.id:
            return Vote(self.name, 'REJECT', 0.95, 
                       f"Not the best match ({scores[0][1][:30]} scored {best_score})", is_veto=True)
        
        if gap >= self.min_gap:
            return Vote(self.name, 'MATCH', 0.99, 
                       f"Clear margin ({gap:.1f}% gap from second best)")
        elif second_score < 85:
            return Vote(self.name, 'MATCH', 0.90, 
                       f"Second best is weak ({second_score:.1f}%)")
        else:
            return Vote(self.name, 'REJECT', 0.85, 
                       f"Ambiguous: gap too small ({gap:.1f}%), second best at {second_score:.1f}%")


class ThePhoneticListener(CouncilMember):
    """
    Member 5: The Phonetic Listener (Reused from Pass 5)
    Catches spelling variations using Metaphone.
    """
    def __init__(self):
        super().__init__("The Phonetic Listener")

    def vote(self, input_name: str, input_state: str, candidate: Candidate,
             all_candidates: List[Candidate], context: Dict) -> Vote:
        c_name = candidate.normalized_name or candidate.name
        
        u_meta = jellyfish.metaphone(input_name)
        c_meta = jellyfish.metaphone(c_name)
        
        if u_meta == c_meta:
            return Vote(self.name, 'MATCH', 0.95, "Phonetic match (Metaphone)")
        
        dist = jellyfish.levenshtein_distance(u_meta, c_meta)
        if dist <= 2:
            return Vote(self.name, 'MATCH', 0.80, f"Close phonetic match (dist={dist})")
        
        return Vote(self.name, 'ABSTAIN', 0.0, f"Phonetic mismatch (dist={dist})")


class TheLibrarian(CouncilMember):
    """
    Member 6: The Librarian (Reused from Pass 5)
    Checks for fundamental type conflicts (Dental vs Medical).
    """
    def __init__(self):
        super().__init__("The Librarian")

    def _detect_type(self, name: str) -> Optional[str]:
        name_upper = name.upper()
        if 'DENTAL' in name_upper:
            return 'DENTAL'
        if 'MEDICAL' in name_upper or 'MBBS' in name_upper:
            return 'MEDICAL'
        if 'AYURVED' in name_upper:
            return 'AYURVEDA'
        if 'HOMOEOPATHIC' in name_upper or 'HOMEOPATHIC' in name_upper:
            return 'HOMOEOPATHY'
        return None

    def vote(self, input_name: str, input_state: str, candidate: Candidate,
             all_candidates: List[Candidate], context: Dict) -> Vote:
        u_type = self._detect_type(input_name)
        c_type = self._detect_type(candidate.name)
        
        if u_type and c_type and u_type != c_type:
            return Vote(self.name, 'REJECT', 1.0, 
                       f"Type mismatch: {u_type} vs {c_type}", is_veto=True)
        
        # Exact name match?
        if input_name.upper().strip() == (candidate.normalized_name or candidate.name).upper().strip():
            return Vote(self.name, 'MATCH', 1.0, "Exact name match")
        
        return Vote(self.name, 'ABSTAIN', 0.0, "No conflict or exact match")


class TheDevilsAdvocate(CouncilMember):
    """
    Member 7: The Devil's Advocate (Reused from Pass 5)
    Final sanity check on generic names. Vetoes dangerous matches.
    """
    def __init__(self):
        super().__init__("The Devil's Advocate")
        self.generic_terms = {
            'GOVERNMENT', 'GOVT', 'CIVIL', 'DISTRICT', 'GENERAL', 'CITY',
            'TRUST', 'MISSION', 'MEMORIAL', 'SOCIETY', 'FOUNDATION'
        }

    def vote(self, input_name: str, input_state: str, candidate: Candidate,
             all_candidates: List[Candidate], context: Dict) -> Vote:
        u_name_upper = input_name.upper()
        words = set(u_name_upper.split())
        
        # Check if purely generic (all words are generic/common)
        non_generic = words - NEGATIVE_WORDS - self.generic_terms
        # Allow 3-char uppercase acronyms as non-generic identifiers
        non_generic = {w for w in non_generic if len(w) >= 3 and (w.isupper() or len(w) > 3)}
        
        if not non_generic:
            # Purely generic name - very dangerous
            return Vote(self.name, 'REJECT', 1.0, 
                       "Purely generic name with no unique identifiers", is_veto=True)
        
        # Check if marked as "risky" by other members
        if context.get('has_weak_consensus'):
            return Vote(self.name, 'REJECT', 0.7, 
                       "Weak consensus from other members")
        
        return Vote(self.name, 'MATCH', 0.8, 
                   f"Non-generic words found: {', '.join(list(non_generic)[:3])}")


# ============================================================================
# THE SINGLE CAMPUS COUNCIL (CHAIRMAN)
# ============================================================================

class SingleCampusCouncil:
    """
    The Single Campus Council Chairman.
    Coordinates 7 specialized members for matching address-less, single-campus colleges.
    
    2 Absolute Conditions:
    1. Single-campus college (count == 1)
    2. Unique name (distinctive words)
    
    Requires UNANIMOUS YES from all members.
    """
    
    def __init__(self, master_db_path: str = 'data/sqlite/master_data.db'):
        self.master_db_path = master_db_path
        
        # Initialize the 7 council members
        self.members = [
            TheStrictFuzzyMatcher(),      # 1. >= 98% similarity
            TheUniqueWordValidator(),     # 2. Unique words check
            TheSingleCampusVerifier(),    # 3. count == 1
            TheSafetyMarginChecker(),     # 4. Gap to second best
            ThePhoneticListener(),        # 5. Phonetic match
            TheLibrarian(),               # 6. Type conflict check
            TheDevilsAdvocate(),          # 7. Generic name check
        ]
        
        self._cache = {}  # Cache for candidates by state
    
    def _get_candidates_for_state(self, state: str, course_type: str = None) -> List[Candidate]:
        """Fetch all candidates from master DB for a given state."""
        cache_key = f"{state}:{course_type or 'all'}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        candidates = []
        tables = ['medical_colleges', 'dental_colleges', 'dnb_colleges']
        
        # Filter by course type if provided
        if course_type:
            if 'dental' in course_type.lower():
                tables = ['dental_colleges']
            elif 'dnb' in course_type.lower():
                tables = ['dnb_colleges']
            elif 'medical' in course_type.lower() or 'mbbs' in course_type.lower():
                tables = ['medical_colleges']
        
        try:
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()
            
            for table in tables:
                cursor.execute(f"""
                    SELECT id, name, normalized_name, address, state, normalized_state
                    FROM {table}
                    WHERE UPPER(normalized_state) = UPPER(?)
                """, (state,))
                
                for row in cursor.fetchall():
                    candidates.append(Candidate(
                        id=row[0],
                        name=row[1] or '',
                        normalized_name=row[2] or '',
                        address=row[3] or '',
                        state=row[4] or state,
                        college_type=table.replace('_colleges', '')
                    ))
            
            conn.close()
        except Exception as e:
            logger.error(f"Error fetching candidates for state {state}: {e}")
        
        self._cache[cache_key] = candidates
        return candidates
    
    def evaluate(self, college_name: str, state: str, 
                 course_type: str = None) -> Tuple[Optional[Dict], float, str, List[Vote]]:
        """
        Evaluate a college name against all candidates in the state.
        
        Returns:
            (match_dict, confidence, method, votes)
            - match_dict: The matched college info or None
            - confidence: 0.0 to 1.0
            - method: String describing the match method
            - votes: List of Vote objects from all members
        """
        candidates = self._get_candidates_for_state(state, course_type)
        
        if not candidates:
            return (None, 0.0, 'pass5d_no_candidates', [])
        
        # Find the best candidate by fuzzy score
        best_candidate = None
        best_score = 0
        
        for c in candidates:
            c_name = c.normalized_name or c.name
            score = fuzz.token_sort_ratio(college_name.upper(), c_name.upper())
            if score > best_score:
                best_score = score
                best_candidate = c
        
        if not best_candidate or best_score < 90:
            return (None, 0.0, 'pass5d_no_viable_candidate', [])
        
        # Conduct the council vote
        votes = []
        all_yes = True
        veto_triggered = False
        veto_reason = ""
        
        context = {'best_score': best_score}
        
        for member in self.members:
            try:
                vote = member.vote(college_name, state, best_candidate, candidates, context)
                votes.append(vote)
                
                if vote.is_veto and vote.decision == 'REJECT':
                    veto_triggered = True
                    veto_reason = f"{member.name} VETO: {vote.reason}"
                    all_yes = False
                elif vote.decision != 'MATCH':
                    all_yes = False
                    
            except Exception as e:
                logger.error(f"Council member {member.name} error: {e}")
                votes.append(Vote(member.name, 'ABSTAIN', 0.0, f"Error: {e}"))
                all_yes = False
        
        # Log the council session
        logger.debug(f"SingleCampusCouncil for '{college_name}':")
        for v in votes:
            logger.debug(f"  {v.member_name}: {v.decision} ({v.confidence:.2f}) - {v.reason}")
        
        # Decision: Unanimous YES required
        if veto_triggered:
            logger.debug(f"  DECISION: REJECT (Veto: {veto_reason})")
            return (None, 0.0, f'pass5d_veto_{veto_reason[:30]}', votes)
        
        if all_yes:
            match_dict = {
                'id': best_candidate.id,
                'name': best_candidate.name,
                'state': best_candidate.state,
                'address': best_candidate.address,
                'type': best_candidate.college_type
            }
            logger.debug(f"  DECISION: MATCH ({best_candidate.id})")
            return (match_dict, 0.99, 'pass5d_single_campus_council', votes)
        else:
            # Count votes
            matches = sum(1 for v in votes if v.decision == 'MATCH')
            rejects = sum(1 for v in votes if v.decision == 'REJECT')
            logger.debug(f"  DECISION: REJECT (Votes: {matches} MATCH, {rejects} REJECT)")
            return (None, 0.0, f'pass5d_no_consensus_{matches}_{rejects}', votes)


# ============================================================================
# TEST
# ============================================================================

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    
    council = SingleCampusCouncil()
    
    # Test cases
    test_cases = [
        ("KOKRAJHAR MEDICAL COLLEGE", "ASSAM"),
        ("PURULIA GOVERNMENT MEDICAL COLLEGE AND HOSPITAL", "WEST BENGAL"),
        ("PKG MEDICAL COLLEGE", "WEST BENGAL"),
        ("GOVERNMENT MEDICAL COLLEGE", "ODISHA"),  # Should fail (generic)
    ]
    
    for name, state in test_cases:
        print(f"\n{'='*60}")
        print(f"Testing: {name} ({state})")
        print('='*60)
        
        match, conf, method, votes = council.evaluate(name, state)
        
        print(f"Result: {method}")
        if match:
            print(f"  Matched: {match['id']} - {match['name']}")
        print(f"  Votes:")
        for v in votes:
            emoji = "✅" if v.decision == 'MATCH' else ("❌" if v.decision == 'REJECT' else "⏸️")
            print(f"    {emoji} {v.member_name}: {v.decision} ({v.confidence:.2f}) - {v.reason}")
