#!/usr/bin/env python3
"""
Pass 6: The Council of Matchers (CoM)
An adaptive, multi-agent voting system for high-stakes entity matching.

Architecture:
1. Triage Officer: Routes requests to relevant experts.
2. Council Members: Specialized matchers (Strict, Fuzzy, Geo, Phonetic, AI).
3. Chairman: Synthesizes votes and applies vetoes.
"""

import logging
import re
import sqlite3
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from difflib import SequenceMatcher
import jellyfish  # For phonetic matching (metaphone)
from council_utils import TheCleaner

# Configure logging
logger = logging.getLogger(__name__)

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
    address: str
    state: str
    type: str  # 'MEDICAL', 'DENTAL', 'DNB'

class CouncilMember(ABC):
    """Abstract base class for all Council Members."""
    
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        """Cast a vote on whether the unmatched record matches the candidate."""
        pass

class TheLibrarian(CouncilMember):
    """
    The Strict Librarian: Enforces rigid rules.
    Matches only on exact name/alias. Vetoes if names are fundamentally different.
    """
    def __init__(self):
        super().__init__("The Librarian")

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        u_name = unmatched_record['college_name'].upper().strip()
        c_name = candidate.name.upper().strip()
        
        # Rule 1: Exact Match
        if u_name == c_name:
            return Vote(self.name, 'MATCH', 1.0, "Exact name match")
            
        # Rule 2: Fundamental Conflict (Veto)
        # e.g. Dental vs Medical
        u_type = self._detect_type(u_name)
        c_type = self._detect_type(c_name)
        
        if u_type and c_type and u_type != c_type:
             return Vote(self.name, 'REJECT', 1.0, f"Type mismatch: {u_type} vs {c_type}", is_veto=True)

        return Vote(self.name, 'ABSTAIN', 0.0, "No exact match or conflict")

    def _detect_type(self, name: str) -> Optional[str]:
        if 'DENTAL' in name: return 'DENTAL'
        if 'MEDICAL' in name or 'MBBS' in name: return 'MEDICAL'
        if 'AYURVED' in name: return 'AYURVEDA'
        if 'HOMOEOPATHIC' in name: return 'HOMOEOPATHY'
        return None

class TheFuzzyGuesser(CouncilMember):
    """
    The Fuzzy Guesser: Handles typos and minor variations.
    Uses string similarity (Levenshtein/Jaccard).
    """
    def __init__(self):
        super().__init__("The Fuzzy Guesser")

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        u_name = unmatched_record['college_name'].upper()
        c_name = candidate.name.upper()
        
        # Simple SequenceMatcher ratio
        ratio = SequenceMatcher(None, u_name, c_name).ratio()
        
        if ratio >= 0.90:
            return Vote(self.name, 'MATCH', ratio, f"High similarity ({ratio:.2f})")
        elif ratio >= 0.80:
            return Vote(self.name, 'MATCH', ratio * 0.9, f"Moderate similarity ({ratio:.2f})")
        elif ratio < 0.40:
             return Vote(self.name, 'REJECT', 0.8, f"Very low similarity ({ratio:.2f})")
             
        return Vote(self.name, 'ABSTAIN', 0.0, f"Indeterminate similarity ({ratio:.2f})")

class TheGeographer(CouncilMember):
    """
    The Geographer: Validates physical location.
    VETO POWER: If address/state mismatches, it casts a 'Strong Reject'.
    """
    def __init__(self):
        super().__init__("The Geographer")

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        u_state = (unmatched_record.get('state') or '').upper()
        c_state = (candidate.state or '').upper()
        
        # Rule 1: State Mismatch (Hard Veto)
        state_match = u_state and c_state and u_state == c_state
        if u_state and c_state and u_state != c_state:
            return Vote(self.name, 'REJECT', 1.0, f"State mismatch: {u_state} vs {c_state}", is_veto=True)
            
        u_address = (unmatched_record.get('address') or '').upper()
        c_address = (candidate.address or '').upper()
        
        # Check for empty or placeholder addresses
        if not u_address or not c_address or u_address == 'UNKNOWN' or c_address == 'UNKNOWN':
             return Vote(self.name, 'ABSTAIN', 0.0, "Insufficient address info")
        
        # Rule 2: City/District Check
        # Extract city (simple heuristic for now)
        u_city = self._extract_city(u_address)
        c_city = self._extract_city(c_address)
        
        # If Query has no City, we cannot enforce location strictly unless State mismatches
        # (State mismatch is already handled above)
        if not u_city:
             return Vote(self.name, 'ABSTAIN', 0.5, "State matches, but Query has no City")
        
        if u_city and c_city and u_city != c_city:
             # Check if one is contained in the other's FULL address
             # e.g. u_city="PUNE", c_address="... PUNE ..." -> Match
             if u_city not in c_address and c_city not in u_address:
                 return Vote(self.name, 'REJECT', 0.9, f"City mismatch: {u_city} vs {c_city}", is_veto=True)
        
        # Rule 3: Multi-Campus Chain Detection
        # If the college is a known chain (Apollo, Manipal, etc.), address match must be STRICT.
        CHAIN_KEYWORDS = {'APOLLO', 'MANIPAL', 'FORTIS', 'CARE', 'NARAYANA', 'KIMS', 'ASTER', 'MAX', 'MEDICOVER', 'SAHYADRI', 'SKIMS', 'AMRI', 'GLOBAL', 'SHER-I-KASHMIR', 'FERNANDEZ', 'KRISHNA'}
        
        is_chain = any(k in unmatched_record.get('college_name', '').upper() for k in CHAIN_KEYWORDS)
        
        # Rule 4: Address Overlap
        overlap = self._calculate_overlap(u_address, c_address)
        
        if is_chain:
            # For chains, we need to be careful.
            
            # 1. Extract tokens
            u_tokens = set(re.findall(r'\b[A-Za-z]+\b', u_address))
            c_tokens = set(re.findall(r'\b[A-Za-z]+\b', c_address))
            
            # 2. Check Negative Matchers (Conflict Pairs) - HIGHEST PRIORITY
            CONFLICT_PAIRS = [
                {'ITPL', 'HAL'},
                {'WHITEFIELD', 'HAL'},
                {'BANJARA', 'JUBILEE'},
                {'BANJARA', 'NAMPALLY'},
                {'BANJARA', 'BOGULKUNTA'},
                {'JUBILEE', 'HYDERGUDA'},
                {'YERAWADA', 'HADAPSAR'},
                {'MOUNT', 'VANAGARAM'},
                {'BEMINA', 'SOURA'},
                {'KODI', 'ITPL'}
            ]
            
            for pair in CONFLICT_PAIRS:
                t1, t2 = list(pair)
                has_t1_u = t1 in u_tokens
                has_t2_u = t2 in u_tokens
                has_t1_c = t1 in c_tokens
                has_t2_c = t2 in c_tokens
                
                if (has_t1_u and has_t2_c and not has_t2_u and not has_t1_c) or \
                   (has_t2_u and has_t1_c and not has_t1_u and not has_t2_c):
                    return Vote(self.name, 'REJECT', 1.0, f"Explicit locality conflict ({t1} vs {t2})", is_veto=True)

            # 3. Check Positive Matchers (Strong Localities)
            STRONG_LOCALITIES = {
                'ITPL', 'HAL', 'VARTHUR', 'KODI', 'BANJARA', 'JUBILEE', 'NAMPALLY', 
                'BOGULKUNTA', 'HYDERGUDA', 'YERAWADA', 'HADAPSAR', 'MOUNT', 'VANAGARAM', 
                'BEMINA', 'SOURA', 'RAMAGONDANAHALLI', 'PADMA', 'COMPLEX'
            }
            
            # Filter tokens for meaningful check
            IGNORED = {'ROAD', 'RD', 'ST', 'NO', 'OPP', 'NEAR', 'HOSPITAL', 'COLLEGE', 'DIST', 'DISTRICT', 'STATE', 'INDIA', 'MAIN', 'CROSS', 'EXT', 'EXTENSION', 'COM', 'NET', 'ORG', 'INFO', 'CONTACT', 'EMAIL'}
            if u_city: IGNORED.add(u_city)
            if c_city: IGNORED.add(c_city)
            if u_state: IGNORED.add(u_state)
            
            common = u_tokens & c_tokens
            meaningful_common = {t for t in common if t not in IGNORED and len(t) > 3}
            
            strong_matches = meaningful_common & STRONG_LOCALITIES
            
            # 4. Check Overlap
            if overlap >= 0.6:
                conf = overlap
                if strong_matches:
                    conf = max(conf, 0.95)
                    return Vote(self.name, 'MATCH', conf, f"Strong chain address match ({overlap:.2f}) + Strong Locality ({', '.join(strong_matches)})")
                return Vote(self.name, 'MATCH', conf, f"Strong chain address match ({overlap:.2f})")
            
            # 5. Low Overlap - Check Locality Tokens
            AMBIGUOUS_LOCALITIES = {'WHITEFIELD'}
            
            if len(meaningful_common) >= 1:
                # Check if we ONLY matched on an ambiguous locality
                if meaningful_common.issubset(AMBIGUOUS_LOCALITIES):
                     return Vote(self.name, 'REJECT', 0.9, f"Ambiguous locality match ({', '.join(meaningful_common)}) - insufficient for chain", is_veto=True)

                # Scale confidence
                base_conf = 0.6
                if len(meaningful_common) >= 2: base_conf = 0.75
                if len(meaningful_common) >= 3: base_conf = 0.9
                
                if strong_matches:
                    base_conf = max(base_conf, 0.95)
                    return Vote(self.name, 'MATCH', base_conf, f"Strong chain locality match ({', '.join(strong_matches)})")
                
                return Vote(self.name, 'MATCH', base_conf, f"Chain locality match ({', '.join(meaningful_common)})")
            else:
                return Vote(self.name, 'REJECT', 0.95, f"Multi-campus chain address mismatch ({overlap:.2f})", is_veto=True)

        else:
            # Standard logic for non-chains
            if overlap > 0.6:
                return Vote(self.name, 'MATCH', overlap, f"Strong address overlap ({overlap:.2f})")
            elif overlap < 0.2:
                 # If addresses are completely different even in same city, lean towards reject
                 return Vote(self.name, 'REJECT', 0.6, f"Low address overlap ({overlap:.2f})")
            
        return Vote(self.name, 'ABSTAIN', 0.0, "State matches, insufficient address evidence")

    def _extract_city(self, address: str) -> Optional[str]:
        # Improved heuristic: Scan from end, ignore pincodes and common stopwords
        if not address: return None
        
        # Normalize
        tokens = re.findall(r'\b[A-Za-z]+\b', address.upper())
        if not tokens: return None
        
        STOP_WORDS = {
            'ROAD', 'RD', 'ST', 'STREET', 'MARG', 'LANE', 'PATH', 'HIGHWAY', 'EXPRESSWAY',
            'NAGAR', 'COLONY', 'ENCLAVE', 'SOCIETY', 'APARTMENT', 'FLAT', 'HOUSE',
            'HOSPITAL', 'COLLEGE', 'INSTITUTE', 'CENTRE', 'CENTER', 'CLINIC', 'TRUST', 'FOUNDATION',
            'OPP', 'NEAR', 'BEHIND', 'BESIDE', 'NEXT', 'TO',
            'SECTOR', 'PHASE', 'BLOCK', 'PLOT', 'NO',
            'DIST', 'DISTRICT', 'TALUKA', 'TEHSIL', 'PO', 'PS',
            'AT', 'POST', 'VIA', 'OFF',
            'EMAIL', 'WEBSITE', 'WEB', 'MAIL', 'CONTACT', 'PH', 'PHONE', 'TEL', 'FAX', 'COM', 'NET', 'ORG', 'INFO',
            # States (Common false positives)
            'ANDHRA', 'PRADESH', 'ARUNACHAL', 'ASSAM', 'BIHAR', 'CHHATTISGARH', 'GOA', 'GUJARAT',
            'HARYANA', 'HIMACHAL', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'MADHYA', 'MAHARASHTRA',
            'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUNJAB', 'RAJASTHAN',
            'SIKKIM', 'TAMIL', 'NADU', 'TELANGANA', 'TRIPURA', 'UTTAR', 'UTTARAKHAND', 'WEST', 'BENGAL',
            'DELHI', 'JAMMU', 'KASHMIR', 'LADAKH', 'PUDUCHERRY'
        }
        
        # Look at the last 3 tokens (excluding very short ones)
        candidates = [t for t in reversed(tokens) if len(t) > 2]
        
        for token in candidates:
            if token not in STOP_WORDS:
                return token
                
        return None

    def _calculate_overlap(self, a1: str, a2: str) -> float:
        w1 = set(a1.split())
        w2 = set(a2.split())
        if not w1 or not w2: return 0.0
        return len(w1 & w2) / len(w1 | w2)

class ThePhoneticListener(CouncilMember):
    """
    The Phonetic Listener: Handles spelling variations.
    Uses Metaphone/Soundex.
    """
    def __init__(self):
        super().__init__("The Phonetic Listener")

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        u_name = unmatched_record['college_name']
        c_name = candidate.name
        
        # Use jellyfish for metaphone
        u_meta = jellyfish.metaphone(u_name)
        c_meta = jellyfish.metaphone(c_name)
        
        if u_meta == c_meta:
            return Vote(self.name, 'MATCH', 0.85, "Phonetic match (Metaphone)")
            
        # Levenshtein on metaphone codes
        dist = jellyfish.levenshtein_distance(u_meta, c_meta)
        if dist <= 1:
             return Vote(self.name, 'MATCH', 0.70, "Close phonetic match")
             
        return Vote(self.name, 'ABSTAIN', 0.0, "No phonetic match")

class WiseJudge(CouncilMember):
    """
    The Wise Judge: High-intelligence tie-breaker using GLM-4.
    Invoked only when the Council is split.
    """
    def __init__(self, api_key: Optional[str] = None):
        super().__init__("The Wise Judge")
        self.api_key = api_key
        self.client = None
        if self.api_key:
            try:
                from zhipuai import ZhipuAI
                self.client = ZhipuAI(api_key=self.api_key)
            except ImportError:
                logger.warning("zhipuai library not installed. Wise Judge disabled.")
            except Exception as e:
                logger.warning(f"Failed to initialize Wise Judge: {e}")

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        if not self.client:
            return Vote(self.name, 'ABSTAIN', 0.0, "GLM-4 not available")

        try:
            prompt = self._construct_prompt(unmatched_record, candidate)
            response = self.client.chat.completions.create(
                model="glm-4",  # Use glm-4 model
                messages=[
                    {"role": "system", "content": "You are an expert entity resolution judge. You decide if two college records refer to the SAME entity. Answer strictly in JSON format: {'match': bool, 'confidence': float, 'reason': str}."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )
            
            content = response.choices[0].message.content
            # Parse JSON response (robustly)
            import json
            # Extract JSON block if wrapped in markdown
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                
            result = json.loads(content)
            
            decision = 'MATCH' if result.get('match', False) else 'REJECT'
            confidence = float(result.get('confidence', 0.5))
            reason = result.get('reason', 'AI decision')
            
            return Vote(self.name, decision, confidence, reason)

        except Exception as e:
            logger.error(f"Wise Judge error: {e}")
            return Vote(self.name, 'ABSTAIN', 0.0, f"Error: {e}")

    def _construct_prompt(self, unmatched: Dict, candidate: Candidate) -> str:
        return f"""
        Compare these two entities:
        
        Entity A (Unmatched Record):
        Name: {unmatched['college_name']}
        Address: {unmatched.get('address', 'N/A')}
        State: {unmatched.get('state', 'N/A')}
        
        Entity B (Candidate Record):
        Name: {candidate.name}
        Address: {candidate.address}
        State: {candidate.state}
        Type: {candidate.type}
        
        Task:
        1. Are they the SAME physical institution?
        2. Ignore minor spelling differences.
        3. Pay attention to location (City/District).
        4. Watch out for "Dental" vs "Medical" conflicts.
        
        Return JSON: {{ "match": true/false, "confidence": 0.0-1.0, "reason": "short explanation" }}
        """

class TheDevilsAdvocate(CouncilMember):
    """
    The Devil's Advocate (The Critic):
    The final adversarial check. Tries to disprove the Chairman's 'MATCH' decision.
    """
    def __init__(self):
        super().__init__("The Devil's Advocate")
        self.generic_terms = {
            'GOVERNMENT', 'GOVT', 'CIVIL', 'DISTRICT', 'GENERAL', 'CITY', 
            'TRUST', 'MISSION', 'MEMORIAL', 'SOCIETY', 'FOUNDATION'
        }

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        # The Critic normally abstains unless called upon for a specific critique
        return Vote(self.name, 'ABSTAIN', 0.0, "Waiting for Chairman's proposal")

    def critique(self, unmatched_record: Dict, candidate: Candidate, prior_votes: List[Vote]) -> Vote:
        """
        Critique a proposed MATCH. Look for reasons to DISSENT.
        """
        u_name = unmatched_record['college_name'].upper()
        
        # Risk 1: Generic Name + Weak Location
        is_generic = any(term in u_name.split() for term in self.generic_terms)
        
        # Check if Geographer confirmed the location
        geographer_confirmed = any(
            v.member_name == "The Geographer" and v.decision == 'MATCH' 
            for v in prior_votes
        )
        
        if is_generic and not geographer_confirmed:
            return Vote(self.name, 'REJECT', 0.9, "Generic name without location confirmation (High Risk)", is_veto=True)
            
        # Risk 2: Weak Consensus (No strong matches)
        strong_matches = sum(1 for v in prior_votes if v.decision == 'MATCH' and v.confidence > 0.8)
        if strong_matches == 0:
             return Vote(self.name, 'REJECT', 0.7, "Weak consensus: No member is strongly confident", is_veto=False)

        return Vote(self.name, 'MATCH', 0.5, "No significant risks found")


class TheSemanticScout(CouncilMember):
    """
    The Semantic Scout: Understands meaning beyond keywords.
    Uses Vector Embeddings (SentenceTransformers) to find conceptual matches.
    e.g. "Kidney Institute" == "Renal Care Center"
    """
    def __init__(self, vector_engine=None):
        super().__init__("The Semantic Scout")
        self.vector_engine = vector_engine

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        if not self.vector_engine:
            return Vote(self.name, 'ABSTAIN', 0.0, "Vector engine not available")

        u_name = unmatched_record['college_name']
        c_name = candidate.name
        
        # Calculate semantic similarity
        # We use the vector engine's model directly to encode and compare
        try:
            # Encode both names
            embeddings = self.vector_engine.model.encode([u_name, c_name])
            
            # Calculate cosine similarity
            from sklearn.metrics.pairwise import cosine_similarity
            sim = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
            
            if sim >= 0.85:
                return Vote(self.name, 'MATCH', float(sim), f"High semantic similarity ({sim:.2f})")
            elif sim >= 0.75:
                return Vote(self.name, 'MATCH', float(sim) * 0.9, f"Moderate semantic similarity ({sim:.2f})")
            elif sim < 0.40:
                return Vote(self.name, 'REJECT', 0.8, f"Semantic mismatch ({sim:.2f})")
                
            return Vote(self.name, 'ABSTAIN', 0.0, f"Indeterminate semantic similarity ({sim:.2f})")
            
        except Exception as e:
            return Vote(self.name, 'ABSTAIN', 0.0, f"Error calculating similarity: {e}")


class TheKeywordGuardian(CouncilMember):
    """
    The Keyword Guardian: Focuses on statistical keyword importance (TF-IDF).
    Rare words (e.g., "Ophthalmology", "Dental") carry more weight than common words ("College", "Hospital").
    """
    def __init__(self, vectorizer=None, tfidf_matrix=None, master_indices=None):
        super().__init__("The Keyword Guardian")
        self.vectorizer = vectorizer
        self.tfidf_matrix = tfidf_matrix
        self.master_indices = master_indices or {} # Maps college_id to matrix index

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        if not self.vectorizer or self.tfidf_matrix is None:
            return Vote(self.name, 'ABSTAIN', 0.0, "TF-IDF engine not available")

        try:
            # 1. Vectorize the unmatched query
            query_vec = self.vectorizer.transform([unmatched_record['college_name']])
            
            # 2. Get the candidate's vector from the pre-computed matrix
            idx = self.master_indices.get(candidate.id)
            if idx is None:
                return Vote(self.name, 'ABSTAIN', 0.0, "Candidate not in TF-IDF index")
                
            candidate_vec = self.tfidf_matrix[idx]
            
            # 3. Calculate Cosine Similarity
            from sklearn.metrics.pairwise import cosine_similarity
            sim = cosine_similarity(query_vec, candidate_vec)[0][0]
            
            # 4. Voting Logic
            if sim >= 0.80:
                return Vote(self.name, 'MATCH', float(sim), f"Strong keyword match ({sim:.2f})")
            elif sim >= 0.60:
                return Vote(self.name, 'MATCH', float(sim) * 0.8, f"Moderate keyword match ({sim:.2f})")
            elif sim < 0.30:
                return Vote(self.name, 'REJECT', 0.7, f"Keyword mismatch ({sim:.2f})")
                
            return Vote(self.name, 'ABSTAIN', 0.0, f"Indeterminate keyword match ({sim:.2f})")
            
        except Exception as e:
            return Vote(self.name, 'ABSTAIN', 0.0, f"Error: {e}")

class TheLocalHero(CouncilMember):
    """
    The Local Hero: City-First Matcher.
    Matches based on City/Pincode + Core Name.
    Solves "District Hospital", "Govt HQ Hospital" cases.
    """
    def __init__(self):
        super().__init__("The Local Hero")
        self.cleaner = TheCleaner()
        self.city_index = {} # Map: City -> List[Candidate]
        self.pincode_index = {} # Map: Pincode -> List[Candidate]
        self.is_ready = False

    def load_data(self, master_colleges: List[Any]):
        """Builds the City and Pincode indices from Master Data."""
        if self.is_ready: return
        
        self.city_index = {}
        self.pincode_index = {}
        
        for col in master_colleges:
            # Handle both dict and object access
            addr = getattr(col, 'address', None) or col.get('address', '')
            if not addr: continue
            
            # Extract City and Pincode
            cleaned = self.cleaner.clean_record({'address': addr})
            city = self.cleaner.extract_city(cleaned['cleaned_address'])
            pincodes = cleaned['signals']['pincodes']
            
            # Index by City
            if city:
                if city not in self.city_index: self.city_index[city] = []
                self.city_index[city].append(col)
                
            # Index by Pincode
            for pin in pincodes:
                if pin not in self.pincode_index: self.pincode_index[pin] = []
                self.pincode_index[pin].append(col)
                
        self.is_ready = True
        logger.info(f"TheLocalHero indexed {len(self.city_index)} cities and {len(self.pincode_index)} pincodes.")

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        if not self.is_ready:
            return Vote(self.name, 'ABSTAIN', 0.0, "Index not loaded")

        # 1. Extract Location from Query
        # Use raw_address to ensure we get Pincodes (which are stripped from 'address' by Chairman)
        u_addr = unmatched_record.get('raw_address') or unmatched_record.get('address', '')
        u_cleaned = self.cleaner.clean_record({'address': u_addr})
        u_city = self.cleaner.extract_city(u_cleaned['cleaned_address'])
        u_pincodes = u_cleaned['signals']['pincodes']
        
        # 2. Check if Candidate matches the Location
        # We need to check if the CANDIDATE provided is in the same location as Query
        # But wait, 'candidate' passed to vote() is a specific candidate chosen by someone else?
        # NO! The Council votes on a SPECIFIC candidate.
        # So TheLocalHero checks: "Is this candidate in the same City/Pincode as Query?"
        # AND "Does the Core Name match?"
        
        c_addr = candidate.address
        c_cleaned = self.cleaner.clean_record({'address': c_addr})
        c_city = self.cleaner.extract_city(c_cleaned['cleaned_address'])
        c_pincodes = c_cleaned['signals']['pincodes']
        
        # Location Match?
        loc_match = False
        if u_pincodes and c_pincodes:
            if set(u_pincodes) & set(c_pincodes):
                loc_match = True
        elif u_city and c_city and u_city == c_city:
            loc_match = True
            
        if not loc_match:
            # If locations are definitely different, maybe REJECT?
            # But TheGeographer handles that.
            # TheLocalHero is for finding matches in generic names.
            return Vote(self.name, 'ABSTAIN', 0.0, "Location mismatch or unknown")
            
        # 3. Core Name Match
        u_name = unmatched_record.get('college_name', '').upper()
        c_name = candidate.name.upper()
        
        u_core = self.cleaner.clean_record({'college_name': u_name})['core_name']
        c_core = self.cleaner.clean_record({'college_name': c_name})['core_name']
        
        # Debug
        logger.info(f"LocalHero: U_City={u_city} C_City={c_city} U_Core={u_core} C_Core={c_core}")
        
        # If Core Names are very similar
        if u_core and c_core:
            # Simple containment or equality
            if u_core == c_core:
                return Vote(self.name, 'MATCH', 0.95, f"Same City/Pin + Exact Core Name ({u_core})")
            if u_core in c_core or c_core in u_core:
                return Vote(self.name, 'MATCH', 0.85, f"Same City/Pin + Partial Core Name ({u_core} / {c_core})")
        
        # Fallback: If one is generic (Core == Name), check against full name of other
        # e.g. U="DISTRICT HOSPITAL" (Generic) vs C="ARALAGUPPE... DISTRICT HOSPITAL"
        if u_core == u_name and u_core in c_name:
             return Vote(self.name, 'MATCH', 0.80, f"Same City/Pin + Generic Name Match ({u_core} in Name)")
        if c_core == c_name and c_core in u_name:
             return Vote(self.name, 'MATCH', 0.80, f"Same City/Pin + Generic Name Match ({c_core} in Name)")
                
        return Vote(self.name, 'ABSTAIN', 0.0, f"Location matches but Core Name differs ({u_core} vs {c_core})")

class TheDetective(CouncilMember):
    """
    The Detective: Signal Matcher.
    Matches based on unique signals like Email Domains, URLs.
    """
    def __init__(self):
        super().__init__("The Detective")
        self.cleaner = TheCleaner()
        self.domain_index = {} # Map: Domain -> List[Candidate]
        self.is_ready = False

    def load_data(self, master_colleges: List[Any]):
        """Builds the Domain index from Master Data."""
        if self.is_ready: return
        
        self.domain_index = {}
        
        for col in master_colleges:
            addr = getattr(col, 'address', None) or col.get('address', '')
            if not addr: continue
            
            cleaned = self.cleaner.clean_record({'address': addr})
            emails = cleaned['signals']['emails']
            urls = cleaned['signals']['urls']
            
            domains = set()
            for email in emails:
                domain = email.split('@')[-1]
                if domain not in ['gmail.com', 'yahoo.com', 'hotmail.com', 'rediffmail.com']:
                    domains.add(domain)
            
            for url in urls:
                # Extract domain from URL
                try:
                    from urllib.parse import urlparse
                    domain = urlparse(url).netloc
                    if domain.startswith('www.'): domain = domain[4:]
                    if domain: domains.add(domain)
                except: pass
                
            for domain in domains:
                if domain not in self.domain_index: self.domain_index[domain] = []
                self.domain_index[domain].append(col)
                
        self.is_ready = True
        logger.info(f"TheDetective indexed {len(self.domain_index)} unique domains.")

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        if not self.is_ready:
            return Vote(self.name, 'ABSTAIN', 0.0, "Index not loaded")
            
        # Extract signals from Query
        u_addr = unmatched_record.get('address', '')
        u_cleaned = self.cleaner.clean_record({'address': u_addr})
        u_emails = u_cleaned['signals']['emails']
        u_urls = u_cleaned['signals']['urls']
        
        u_domains = set()
        for email in u_emails:
            domain = email.split('@')[-1]
            if domain not in ['gmail.com', 'yahoo.com', 'hotmail.com', 'rediffmail.com']:
                u_domains.add(domain)
        
        if not u_domains:
            return Vote(self.name, 'ABSTAIN', 0.0, "No unique domains in query")
            
        # Check Candidate
        c_addr = candidate.address
        c_cleaned = self.cleaner.clean_record({'address': c_addr})
        c_emails = c_cleaned['signals']['emails']
        c_urls = c_cleaned['signals']['urls']
        
        c_domains = set()
        for email in c_emails:
            domain = email.split('@')[-1]
            if domain not in ['gmail.com', 'yahoo.com', 'hotmail.com', 'rediffmail.com']:
                c_domains.add(domain)
        for url in c_urls:
             try:
                from urllib.parse import urlparse
                domain = urlparse(url).netloc
                if domain.startswith('www.'): domain = domain[4:]
                if domain: c_domains.add(domain)
             except: pass

        common_domains = u_domains & c_domains
        
        if common_domains:
            # Check if this domain is unique to one college or shared (Chain)
            domain = list(common_domains)[0] # Take the first match
            candidates_with_domain = self.domain_index.get(domain, [])
            is_shared = len(candidates_with_domain) > 1
            
            if is_shared:
                return Vote(self.name, 'MATCH', 0.70, f"Shared Domain Match ({domain}) - Chain Identified")
            else:
                return Vote(self.name, 'MATCH', 0.99, f"Unique Domain Match ({domain})")
            
        return Vote(self.name, 'ABSTAIN', 0.0, "No common unique domains")

class TheCodeBreaker(CouncilMember):
    """
    The Code Breaker: Matches based on unique College Codes (e.g. (902791)).
    These codes are extremely specific and guarantee a match (>95%).
    """
    def __init__(self):
        super().__init__("The Code Breaker")
        self.code_index = {} # Code -> List[CandidateID]
        self.is_ready = False
        self.cleaner = TheCleaner()

    def load_data(self, candidates: List[Dict]):
        if self.is_ready: return
        
        for college in candidates:
            c_id = college['id']
            # Extract code from address
            c_cleaned = self.cleaner.clean_record({'address': college.get('address', '')})
            c_codes = c_cleaned['signals'].get('college_codes', [])
            
            for code in c_codes:
                if code not in self.code_index:
                    self.code_index[code] = []
                self.code_index[code].append(c_id)
                
        self.is_ready = True
        logger.info(f"TheCodeBreaker indexed {len(self.code_index)} unique college codes.")

    def vote(self, unmatched_record: Dict, candidate: Candidate) -> Vote:
        if not self.is_ready:
            return Vote(self.name, 'ABSTAIN', 0.0, "Not initialized with Master Data")

        # Check Query
        # Use raw_address if available, to preserve parentheses for code extraction
        u_addr = unmatched_record.get('raw_address') or unmatched_record.get('address', '')
        u_cleaned = self.cleaner.clean_record({'address': u_addr})
        u_codes = set(u_cleaned['signals'].get('college_codes', []))
        
        if not u_codes:
            return Vote(self.name, 'ABSTAIN', 0.0, "No college code in query")
            
        # Check Candidate
        c_addr = candidate.address
        c_cleaned = self.cleaner.clean_record({'address': c_addr})
        c_codes = set(c_cleaned['signals'].get('college_codes', []))
        
        common_codes = u_codes & c_codes
        
        if common_codes:
            code = list(common_codes)[0]
            
            # MULTI-SIGNAL VALIDATION: Code + Name + Address
            # Code match alone is not enough - validate with name and location
            
            # 1. Name Validation (fuzzy match)
            u_name = unmatched_record.get('college_name', '')
            c_name = candidate.name
            from rapidfuzz import fuzz
            name_similarity = fuzz.ratio(u_name.upper(), c_name.upper()) / 100.0
            
            # 2. Address Validation (lenient: state or city match)
            u_state = unmatched_record.get('state', '').upper()
            c_state = candidate.state.upper() if candidate.state else ''
            c_addr_upper = c_addr.upper()
            
            # Check state match or state in address
            address_match = (
                u_state == c_state or
                u_state in c_addr_upper or
                (len(u_state) > 3 and u_state in c_addr_upper)  # Avoid false matches on short names
            )
            
            # Require both name and address validation
            if name_similarity >= 0.7 and address_match:
                return Vote(
                    self.name, 'MATCH', 0.99,
                    f"Code Match ({code}) + Name ({name_similarity:.2f}) + Address Validated"
                )
            else:
                # Code matched but validation failed - let other members decide
                return Vote(
                    self.name, 'ABSTAIN', 0.0,
                    f"Code matched ({code}) but validation failed: Name={name_similarity:.2f}, Addr={address_match}"
                )
            
        # If Query has a code but Candidate doesn't match it -> Strong Reject?
        # Only if we are sure the candidate *should* have a code.
        # But maybe the candidate data is missing the code.
        # However, if Candidate HAS a code and it's DIFFERENT -> REJECT.
        if c_codes and u_codes and not common_codes:
             return Vote(self.name, 'REJECT', 0.99, f"College Code Mismatch ({list(u_codes)[0]} vs {list(c_codes)[0]})", is_veto=True)

        return Vote(self.name, 'ABSTAIN', 0.0, "No common college codes")

class CouncilChairman:
    """
    The Chairman: Synthesizes votes and applies parliamentary rules.
    """
    def __init__(self, glm_api_key: Optional[str] = None, vector_engine=None, 
                 tfidf_vectorizer=None, tfidf_matrix=None, tfidf_indices=None):
        self.members = [
            TheLibrarian(),
            TheFuzzyGuesser(),
            TheGeographer(),
            ThePhoneticListener(),
            TheSemanticScout(vector_engine=vector_engine),
            TheKeywordGuardian(vectorizer=tfidf_vectorizer, tfidf_matrix=tfidf_matrix, master_indices=tfidf_indices),
            TheLocalHero(),
            TheDetective(),
            TheCodeBreaker() # New member
        ]
        self.devils_advocate = TheDevilsAdvocate()
        
        # Weights (Total ~10-15)
        self.weights = {
            "The Librarian": 2.0,      # Exact Match
            "The Fuzzy Guesser": 1.0,  # Fuzzy Match
            "The Geographer": 2.0,     # Location Match
            "The Phonetic Listener": 1.5, # Sound Match
            "The Semantic Scout": 1.5, # Meaning Match
            "The Keyword Guardian": 1.5, # Keyword Match
            "The Local Hero": 2.5,     # City-Centric Match
            "The Detective": 2.0,      # Signal Match
            "The Code Breaker": 3.0    # Unique Code Match (>95% confidence)
        }
        
        # Wise Judge (LLM) is optional
        self.wise_judge = WiseJudge(api_key=glm_api_key) if glm_api_key else None

    def load_master_data(self, master_colleges: List[Any]):
        """
        Loads master data into members that need it (LocalHero, Detective).
        """
        for member in self.members:
            if hasattr(member, 'load_data'):
                member.load_data(master_colleges)

    def evaluate_candidate(self, unmatched_record: Dict, candidate: Candidate) -> Tuple[str, float, List[Vote]]:
        """
        Asks all council members to vote on the candidate.
        Returns (Decision, Confidence, Votes).
        """
        votes = []
        
        # 0. Global Preprocessing (The Enlightened Chairman)
        # Normalize the query name to help Fuzzy/Phonetic matchers handle aliases like "KIMS"
        # We use a fresh cleaner instance or reuse one if available
        if not hasattr(self, 'cleaner'):
             self.cleaner = TheCleaner()
             
        original_name = unmatched_record.get('college_name', '')
        original_addr = unmatched_record.get('address', '')
        
        cleaned_data = self.cleaner.clean_record({'college_name': original_name, 'address': original_addr})
        normalized_name = cleaned_data.get('normalized_name')
        cleaned_addr = cleaned_data.get('cleaned_address')
        
        # Create a context-enhanced record
        enhanced_record = unmatched_record.copy()
        enhanced_record['raw_address'] = original_addr # Preserve original for TheCodeBreaker
        
        if normalized_name and normalized_name != original_name:
            enhanced_record['college_name'] = normalized_name
            
        # Also use cleaned address to remove noise (emails, URLs) that confuse TheGeographer
        if cleaned_addr is not None: # It might be empty string, which is fine
            enhanced_record['address'] = cleaned_addr
            
        # 1. Collect Votes
        veto_triggered = False
        veto_reason = ""
        
        total_score = 0.0
        max_possible_score = 0.0
        
        for member in self.members:
            try:
                vote = member.vote(enhanced_record, candidate)
                votes.append(vote)
            except Exception as e:
                logger.error(f"Council Member {member.name} crashed: {e}")
                votes.append(Vote(member.name, 'ABSTAIN', 0.0, f"Error: {e}"))
            
            if vote.is_veto and vote.decision == 'REJECT':
                veto_triggered = True
                veto_reason = f"{member.name} VETO: {vote.reason}"
                # We continue collecting votes for audit, but decision is made
        
        if veto_triggered:
            return 'REJECT', 1.0, votes

        # Calculate weighted score
        match_votes = 0
        for vote in votes:
            weight = self.weights.get(vote.member_name, 1.0)
            if vote.decision == 'MATCH':
                total_score += vote.confidence * weight
                match_votes += 1
            elif vote.decision == 'REJECT':
                total_score -= vote.confidence * weight
            
            if vote.decision != 'ABSTAIN':
                max_possible_score += weight

        # Quorum Rule: Need at least 2 matches (unless Librarian matches exact OR Geographer matches strongly)
        librarian_match = any(v.member_name == "The Librarian" and v.decision == 'MATCH' for v in votes)
        geographer_strong_match = any(v.member_name == "The Geographer" and v.decision == 'MATCH' and v.confidence >= 0.9 for v in votes)
        
        if match_votes < 2 and not librarian_match and not geographer_strong_match:
             return 'REJECT', 0.0, votes # Quorum not met

        # Normalize score
        final_confidence = 0.0
        if max_possible_score > 0:
            final_confidence = max(0.0, total_score / max_possible_score)
            
        decision = 'MATCH' if final_confidence > 0.7 else 'REJECT'
        
        # --- PHASE 4: THE DEVIL'S ADVOCATE ---
        if decision == 'MATCH':
            critic_vote = self.devils_advocate.critique(unmatched_record, candidate, votes)
            if critic_vote.decision == 'REJECT':
                # Log the dissent
                votes.append(critic_vote)
                
                # If it's a VETO (High Risk), overturn the decision
                if critic_vote.is_veto:
                    return 'REJECT', 0.0, votes
                
                # If it's a warning, downgrade confidence
                final_confidence *= 0.8
                if final_confidence < 0.7:
                    return 'REJECT', final_confidence, votes
        
        return decision, final_confidence, votes

if __name__ == "__main__":
    # Test Case: Ruby Hall vs Laxmi Narasimha
    chairman = CouncilChairman()
    
    unmatched = {
        'college_name': 'RUBY HALL CLINIC',
        'state': 'MAHARASHTRA',
        'address': '40 SASSOON ROAD, PUNE'
    }
    
    candidate = Candidate(
        id='DNB0657',
        name='LAXMI NARASIMHA HOSPITAL',
        address='NAIM NAGAR, HANAMKONDA',
        state='TELANGANA',
        type='DNB'
    )
    
    print(f"Testing Match: {unmatched['college_name']} vs {candidate.name}")
    decision, conf, votes = chairman.evaluate_candidate(unmatched, candidate)
    
    print(f"Decision: {decision} (Confidence: {conf:.2f})")
    for v in votes:
        print(f" - {v.member_name}: {v.decision} ({v.reason})")
