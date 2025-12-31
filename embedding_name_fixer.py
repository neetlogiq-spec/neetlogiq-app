#!/usr/bin/env python3
"""
Embedding-Based Name Fixer Pipeline

Fixes broken/malformed college names using:
1. Semantic embeddings to find TOP similar candidates
2. Multi-model LLM voting to verify corrections
3. Parallel processing with 22 API keys × 17 models

Usage:
    python3 embedding_name_fixer.py [--db counselling|seat] [--dry-run]
"""

import sqlite3
import numpy as np
import logging
import json
import time
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.table import Table
from rich.panel import Panel
from rapidfuzz import fuzz

# Embedding model
from sentence_transformers import SentenceTransformer

# OpenRouter for LLM
from openrouter_client import OpenRouterClient

# Performance tracking and resilience (shared with agentic_matcher)
from llm_performance_tracker import (
    get_performance_tracker, get_retry_queue, get_circuit_breaker,
    get_cost_tracker, LLMPerformanceTracker, SmartRetryQueue, CircuitBreaker,
)

logger = logging.getLogger(__name__)
console = Console()


@dataclass
class CorrectionResult:
    """Result of a name correction attempt."""
    group_id: int
    original_name: str
    corrected_name: Optional[str]
    matched_college_id: Optional[str]
    confidence: float
    status: str  # 'auto_applied', 'pending_review', 'skipped', 'no_issue'
    votes: Dict[str, str]  # model -> corrected_name


class OpenRouterEmbedding:
    """
    OpenRouter-based embedding model using qwen/qwen3-embedding-8b.
    
    Features:
    - API-based (uses existing OpenRouter keys)
    - 4096 dimensions (vs 384 for all-MiniLM-L6-v2)
    - 32K context window
    - Higher accuracy (70.58 MTEB vs ~65)
    """
    
    MODEL_NAME = "qwen/qwen3-embedding-8b"
    DIMENSION = 4096
    
    def __init__(self, api_keys: List[str] = None):
        """Initialize with OpenRouter API keys."""
        if api_keys is None:
            api_keys = self._load_api_keys()
        
        self.api_keys = api_keys
        self._key_index = 0
        self.clients = [OpenRouterClient(key) for key in api_keys[:10]]  # Use up to 10 keys for parallel
    
    def _load_api_keys(self) -> List[str]:
        """Load API keys from config.yaml."""
        import yaml
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            
            if 'agentic_matcher' in config and 'api_keys' in config['agentic_matcher']:
                return config['agentic_matcher']['api_keys']
            if 'api_keys' in config:
                return config['api_keys']
            return []
        except Exception:
            return []
    
    def _get_client(self) -> OpenRouterClient:
        """Get next client (round-robin)."""
        client = self.clients[self._key_index % len(self.clients)]
        self._key_index += 1
        return client
    
    def encode(self, texts: List[str], show_progress_bar: bool = False) -> np.ndarray:
        """
        Generate embeddings for a list of texts IN PARALLEL.
        
        Args:
            texts: List of text strings to embed
            show_progress_bar: Ignored (for API compatibility)
            
        Returns:
            numpy array of shape (len(texts), DIMENSION)
        """
        # Process in batches of 20 (API limit per call)
        batch_size = 20
        batches = []
        for batch_num, i in enumerate(range(0, len(texts), batch_size)):
            batches.append((batch_num, texts[i:i + batch_size]))
        
        # Use parallel workers (up to 10 workers with different API keys)
        num_workers = min(len(self.clients), 10)
        results_list = [None] * len(batches)  # Pre-allocate to maintain order
        
        def process_batch(args):
            batch_num, batch_texts = args
            client_idx = batch_num % num_workers
            return batch_num, self._encode_batch_with_client(batch_texts, client_idx)
        
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            for batch_num, batch_embeddings in executor.map(process_batch, batches):
                results_list[batch_num] = batch_embeddings
        
        # Flatten in order
        all_embeddings = []
        for embeddings in results_list:
            if embeddings:
                all_embeddings.extend(embeddings)
        
        return np.array(all_embeddings, dtype=np.float32)
    
    def _encode_batch_with_client(self, texts: List[str], client_idx: int, max_retries: int = 3) -> List[np.ndarray]:
        """Encode a batch using a specific client."""
        import requests
        
        client = self.clients[client_idx % len(self.clients)]
        
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    "https://openrouter.ai/api/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {client.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.MODEL_NAME,
                        "input": texts,
                    },
                    timeout=60,
                )
                
                if response.status_code == 429:
                    time.sleep(2 ** attempt)
                    continue
                
                response.raise_for_status()
                data = response.json()
                
                embeddings = []
                for item in data.get('data', []):
                    embedding = np.array(item['embedding'], dtype=np.float32)
                    embeddings.append(embedding)
                
                return embeddings
                
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                else:
                    logger.error(f"Embedding API error: {e}")
                    return [np.zeros(self.DIMENSION, dtype=np.float32) for _ in texts]
        
        return [np.zeros(self.DIMENSION, dtype=np.float32) for _ in texts]
    
    def _encode_batch(self, texts: List[str], max_retries: int = 3) -> List[np.ndarray]:
        """Encode a batch of texts with retry logic."""
        import requests
        
        for attempt in range(max_retries):
            try:
                client = self._get_client()
                
                response = requests.post(
                    "https://openrouter.ai/api/v1/embeddings",
                    headers={
                        "Authorization": f"Bearer {client.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.MODEL_NAME,
                        "input": texts,
                    },
                    timeout=60,
                )
                
                if response.status_code == 429:
                    # Rate limited - wait and retry
                    time.sleep(2 ** attempt)
                    continue
                
                response.raise_for_status()
                data = response.json()
                
                # Extract embeddings
                embeddings = []
                for item in data.get('data', []):
                    embedding = np.array(item['embedding'], dtype=np.float32)
                    embeddings.append(embedding)
                
                return embeddings
                
            except Exception as e:
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                else:
                    logger.error(f"Embedding API error: {e}")
                    # Return zero embeddings as fallback
                    return [np.zeros(self.DIMENSION, dtype=np.float32) for _ in texts]
        
        return [np.zeros(self.DIMENSION, dtype=np.float32) for _ in texts]


class MasterEmbeddingBuilder:
    """Builds and stores embeddings for master college names using OpenRouter API."""
    
    def __init__(
        self,
        master_db_path: str = 'data/sqlite/master_data.db',
        api_keys: List[str] = None,
    ):
        self.master_db_path = master_db_path
        self.api_keys = api_keys
        self.model = None  # Lazy load
    
    def _load_model(self):
        """Lazy load the embedding model."""
        if self.model is None:
            console.print(f"[cyan]Loading embedding model: qwen/qwen3-embedding-8b (OpenRouter API)[/cyan]")
            self.model = OpenRouterEmbedding(api_keys=self.api_keys)
        return self.model
    
    def build_embeddings(self, force_rebuild: bool = False) -> int:
        """
        Generate embeddings for all master colleges.
        
        Args:
            force_rebuild: If True, rebuild even if embeddings exist
            
        Returns:
            Number of embeddings created
        """
        conn = sqlite3.connect(self.master_db_path)
        cursor = conn.cursor()
        
        # Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS master_embeddings (
                college_id TEXT PRIMARY KEY,
                college_name TEXT NOT NULL,
                state TEXT NOT NULL,
                course_type TEXT NOT NULL,
                embedding BLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_embed_state ON master_embeddings(state)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_embed_type ON master_embeddings(course_type)")
        conn.commit()
        
        # Check if embeddings exist
        cursor.execute("SELECT COUNT(*) FROM master_embeddings")
        existing_count = cursor.fetchone()[0]
        
        if existing_count > 0 and not force_rebuild:
            console.print(f"[green]✅ {existing_count} embeddings already exist. Use --force to rebuild.[/green]")
            conn.close()
            return existing_count
        
        # Clear existing embeddings if rebuilding
        if force_rebuild:
            cursor.execute("DELETE FROM master_embeddings")
            conn.commit()
        
        # Load all master colleges
        tables = [
            ('medical_colleges', 'medical'),
            ('dental_colleges', 'dental'),
            ('dnb_colleges', 'dnb'),
        ]
        
        all_colleges = []
        for table, course_type in tables:
            try:
                cursor.execute(f"""
                    SELECT id, 
                           COALESCE(normalized_name, name) as name,
                           COALESCE(normalized_state, state) as state
                    FROM {table}
                """)
                for row in cursor.fetchall():
                    all_colleges.append({
                        'id': row[0],
                        'name': row[1],
                        'state': row[2],
                        'course_type': course_type,
                    })
            except sqlite3.OperationalError:
                continue
        
        console.print(f"[cyan]Found {len(all_colleges)} colleges to embed[/cyan]")
        
        # Load model
        model = self._load_model()
        
        # Generate embeddings in batches
        batch_size = 100
        total_embedded = 0
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
        ) as progress:
            task = progress.add_task("Generating embeddings...", total=len(all_colleges))
            
            for i in range(0, len(all_colleges), batch_size):
                batch = all_colleges[i:i + batch_size]
                names = [c['name'] for c in batch]
                
                # Generate embeddings
                embeddings = model.encode(names, show_progress_bar=False)
                
                # Store in database
                for j, college in enumerate(batch):
                    embedding_bytes = embeddings[j].astype(np.float32).tobytes()
                    cursor.execute("""
                        INSERT OR REPLACE INTO master_embeddings 
                        (college_id, college_name, state, course_type, embedding)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        college['id'],
                        college['name'],
                        college['state'],
                        college['course_type'],
                        embedding_bytes,
                    ))
                    total_embedded += 1
                
                conn.commit()
                progress.update(task, advance=len(batch))
        
        conn.close()
        console.print(f"[green]✅ Created {total_embedded} embeddings[/green]")
        return total_embedded


class WordMerger:
    """
    Dictionary-based OCR word merger for deterministic 100% confidence corrections.
    
    Builds a word dictionary from master data and common words, then merges
    adjacent fragments that form valid dictionary words.
    
    Example:
        GOVER + NMENT = GOVERNMENT ✓
        MEDICA + L = MEDICAL ✓
        COLLEG + E = COLLEGE ✓
    """
    
    # Common words that appear in college names
    COMMON_WORDS = frozenset({
        # Generic college terms
        'MEDICAL', 'DENTAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'UNIVERSITY',
        'GOVERNMENT', 'GENERAL', 'SCIENCES', 'SCIENCE', 'ACADEMY', 'SCHOOL',
        'RESEARCH', 'CENTRE', 'CENTER', 'FOUNDATION', 'TRUST', 'CHARITABLE',
        'SOCIETY', 'MEMORIAL', 'NATIONAL', 'REGIONAL', 'DISTRICT', 'STATE',
        'TEACHING', 'TRAINING', 'EDUCATION', 'POSTGRADUATE', 'AUTONOMOUS',
        'PRIVATE', 'SPECIALTY', 'SPECIALITY', 'SUPER', 'MULTI', 'INDIA',
        'INDIAN', 'INTERNATIONAL', 'FORMERLY', 'PREVIOUSLY', 'EARLIER',
        'ATTACHED', 'AFFILIATED', 'ASSOCIATED', 'UNDER', 'RECOGNIZED',
        # States
        'ANDHRA', 'PRADESH', 'ARUNACHAL', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
        'GUJARAT', 'HARYANA', 'HIMACHAL', 'JHARKHAND', 'KARNATAKA', 'KERALA',
        'MADHYA', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND',
        'ODISHA', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL', 'NADU', 'TELANGANA',
        'TRIPURA', 'UTTARAKHAND', 'UTTAR', 'BENGAL', 'JAMMU', 'KASHMIR',
        # Major Cities
        'MUMBAI', 'DELHI', 'BANGALORE', 'BENGALURU', 'CHENNAI', 'KOLKATA',
        'HYDERABAD', 'AHMEDABAD', 'PUNE', 'JAIPUR', 'LUCKNOW', 'CHANDIGARH',
        'BHOPAL', 'PATNA', 'THIRUVANANTHAPURAM', 'KOCHI', 'COIMBATORE',
        'MANGALORE', 'MANGALURU', 'MYSORE', 'MYSURU', 'VIZAG', 'VISAKHAPATNAM',
        'NAGPUR', 'NASHIK', 'AURANGABAD', 'SOLAPUR', 'SURAT', 'VADODARA',
        'RAJKOT', 'INDORE', 'GWALIOR', 'JABALPUR', 'JODHPUR', 'UDAIPUR',
        'AGRA', 'VARANASI', 'ALLAHABAD', 'PRAYAGRAJ', 'KANPUR', 'MEERUT',
        'DEHRADUN', 'RANCHI', 'JAMSHEDPUR', 'RAIPUR', 'BILASPUR',
        'GUWAHATI', 'SHILLONG', 'IMPHAL', 'AIZAWL', 'KOHIMA', 'AGARTALA',
        'GANGTOK', 'SRINAGAR', 'JAMMU', 'LEH', 'PONDICHERRY', 'PUDUCHERRY',
        # Andhra Pradesh / Telangana cities (commonly split in OCR)
        'VIJAYAWADA', 'GUNTUR', 'NELLORE', 'KURNOOL', 'KADAPA', 'CUDDAPAH',
        'ANANTAPUR', 'ANANTAPURAM', 'TIRUPATI', 'CHITTOOR', 'KAKINADA',
        'RAJAHMUNDRY', 'RAJAMAHENDRAVARAM', 'ELURU', 'ONGOLE', 'MACHILIPATNAM',
        'NANDYAL', 'HINDUPUR', 'ADONI', 'TENALI', 'PRODDATUR', 'SRIKAKULAM',
        'VIZIANAGARAM', 'WARANGAL', 'KARIMNAGAR', 'KHAMMAM', 'NIZAMABAD',
        'MAHBUBNAGAR', 'NALGONDA', 'SANGAREDDY', 'MEDAK', 'SURYAPET',
        # Tamil Nadu cities
        'MADURAI', 'TRICHY', 'TIRUCHIRAPPALLI', 'SALEM', 'TIRUNELVELI',
        'TIRUPPUR', 'ERODE', 'VELLORE', 'THANJAVUR', 'DINDIGUL', 'THOOTHUKUDI',
        'KANCHIPURAM', 'CUDDALORE', 'NAGERCOIL', 'KARUR', 'SIVAKASI',
        # Karnataka cities
        'HUBLI', 'DHARWAD', 'BELGAUM', 'BELAGAVI', 'GULBARGA', 'KALABURAGI',
        'DAVANAGERE', 'BELLARY', 'BALLARI', 'SHIMOGA', 'SHIVAMOGGA', 'TUMKUR',
        'TUMAKURU', 'BIDAR', 'RAICHUR', 'HASSAN', 'MANDYA', 'UDUPI',
        # Maharashtra cities
        'THANE', 'KALYAN', 'DOMBIVLI', 'NAVI', 'PIMPRI', 'CHINCHWAD',
        'AMRAVATI', 'KOLHAPUR', 'SANGLI', 'JALGAON', 'AKOLA', 'LATUR',
        'DHULE', 'AHMEDNAGAR', 'CHANDRAPUR', 'PARBHANI', 'JALNA', 'WARDHA',
        # Gujarat cities
        'JAMNAGAR', 'BHAVNAGAR', 'JUNAGADH', 'GANDHIDHAM', 'ANAND', 'NADIAD',
        'MORBI', 'SURENDRANAGAR', 'BHARUCH', 'MEHSANA', 'PALANPUR', 'VAPI',
        # Other important cities
        'LUDHIANA', 'AMRITSAR', 'JALANDHAR', 'PATIALA', 'BATHINDA', 'FARIDABAD',
        'GURGAON', 'GURUGRAM', 'NOIDA', 'GHAZIABAD', 'ALIGARH', 'MORADABAD',
        'BAREILLY', 'GORAKHPUR', 'JHANSI', 'MATHURA', 'FIROZABAD', 'SAHARANPUR',
        'MUZAFFARNAGAR', 'ROORKEE', 'HARIDWAR', 'HALDWANI', 'KASHIPUR',
        'BOKARO', 'DHANBAD', 'HAZARIBAGH', 'CUTTACK', 'BHUBANESWAR', 'ROURKELA',
        'SAMBALPUR', 'BERHAMPUR', 'DURGAPUR', 'ASANSOL', 'SILIGURI', 'HOWRAH',
        'BHILAI', 'KORBA', 'UJJAIN', 'SAGAR', 'DEWAS', 'SATNA', 'REWA',
        'BIKANER', 'AJMER', 'ALWAR', 'BHARATPUR', 'SIKAR', 'PALI', 'KOTA',
        # Common names in colleges
        'LOKMANYA', 'TILAK', 'GANDHI', 'NEHRU', 'JAWAHAR', 'JAWAHARLAL',
        'RAJIV', 'INDIRA', 'MAHATMA', 'SARDAR', 'PATEL', 'AMBEDKAR', 'BABA',
        'SAHEB', 'BHIMRAO', 'PANDIT', 'DEENDAYAL', 'UPADHYAYA', 'VAJPAYEE',
        'ATAL', 'BIHARI', 'SHASTRI', 'BAHADUR', 'VARDHMAN', 'MAHAVIR',
        'SWAMI', 'VIVEKANANDA', 'RAMAKRISHNA', 'TAGORE', 'RABINDRANATH',
        'BOSE', 'SUBHAS', 'CHANDRA', 'NETAJI', 'MAULANA', 'AZAD', 'ABUL',
        'KALAM', 'ABDUL', 'RAJENDRA', 'PRASAD', 'RADHAKRISHNAN', 'YASHWANT',
        'PARMAR', 'BHIKHARI', 'MEGHE', 'PATIL', 'SHAH', 'GAJRA', 'RAJA',
        'EMPLOYEES', 'INSURANCE', 'CORPORATION', 'HAMDARD', 'METRO', 'CANCER',
        'ZORAM', 'FALKAWN', 'PRIYA', 'KIRAN', 'ANAND', 'SEEMA', 'BHARATI',
        'VIDYAPEETH', 'VOKKALIGARA', 'SANGHA', 'VENKATESWARA',
    })
    
    def __init__(self, master_db_path: str = 'data/sqlite/master_data.db'):
        self.master_db_path = master_db_path
        self.word_dict = set()
        self._build_dictionary()
    
    def _build_dictionary(self):
        """Build word dictionary from master data + common words."""
        # Start with common words
        self.word_dict = set(self.COMMON_WORDS)
        
        # Add words from master colleges
        try:
            conn = sqlite3.connect(self.master_db_path)
            cursor = conn.cursor()
            
            for table in ['medical_colleges', 'dental_colleges', 'dnb_colleges']:
                try:
                    cursor.execute(f"SELECT COALESCE(normalized_name, name) FROM {table}")
                    for row in cursor.fetchall():
                        if row[0]:
                            words = row[0].upper().split()
                            for word in words:
                                # Only add words with 4+ characters (avoid fragments)
                                if len(word) >= 4 and word.isalpha():
                                    self.word_dict.add(word)
                except sqlite3.OperationalError:
                    continue
            
            conn.close()
            console.print(f"[cyan]WordMerger: Built dictionary with {len(self.word_dict)} words[/cyan]")
        except Exception as e:
            logger.warning(f"Failed to build word dictionary: {e}")
    
    def merge_words(self, name: str) -> Tuple[str, bool, List[str]]:
        """
        Merge OCR-split word fragments into valid dictionary words.
        
        Args:
            name: The potentially broken name
            
        Returns:
            Tuple of (corrected_name, was_modified, list_of_changes)
        """
        if not name:
            return name, False, []
        
        words = name.upper().split()
        if len(words) < 2:
            return name, False, []
        
        result = []
        changes = []
        i = 0
        modified = False
        
        while i < len(words):
            current = words[i]
            
            # Try to merge with following words (up to 3 fragments)
            best_merge = None
            best_length = 0
            
            for lookahead in range(1, min(4, len(words) - i)):
                merged = ''.join(words[i:i + lookahead + 1])
                
                # Check if merged word is in dictionary
                if merged in self.word_dict and len(merged) > best_length:
                    best_merge = merged
                    best_length = lookahead + 1
            
            if best_merge and best_length > 1:
                # Found a valid merge
                original_fragments = ' '.join(words[i:i + best_length])
                result.append(best_merge)
                changes.append(f"{original_fragments} → {best_merge}")
                i += best_length
                modified = True
            else:
                result.append(current)
                i += 1
        
        corrected = ' '.join(result)
        return corrected, modified, changes
    
    def fix_batch(self, records: List[Dict], name_field: str = 'normalized_college_name', address_field: str = 'normalized_address') -> Dict:
        """
        Apply word merging to a batch of records (both names AND addresses).
        
        Returns:
            Dict with 'fixed', 'unchanged', and 'changes' lists
        """
        fixed = []
        unchanged = []
        all_changes = []
        
        for record in records:
            name = record.get(name_field, '')
            address = record.get(address_field, '')
            
            # Fix name
            corrected_name, name_modified, name_changes = self.merge_words(name)
            
            # Fix address too
            corrected_address, address_modified, address_changes = self.merge_words(address)
            
            was_modified = name_modified or address_modified
            
            if was_modified:
                if name_modified:
                    record['corrected_name'] = corrected_name
                if address_modified:
                    record['corrected_address'] = corrected_address
                    
                record['merge_changes'] = name_changes + address_changes
                record['merge_confidence'] = 1.0  # 100% confidence
                fixed.append(record)
                
                change_record = {
                    'original': name,
                    'corrected': corrected_name if name_modified else name,
                    'changes': name_changes,
                }
                if address_modified:
                    change_record['original_address'] = address
                    change_record['corrected_address'] = corrected_address
                    change_record['address_changes'] = address_changes
                    
                all_changes.append(change_record)
            else:
                unchanged.append(record)
        
        return {
            'fixed': fixed,
            'unchanged': unchanged,
            'changes': all_changes,
        }


class IntelligentDetector:
    """
    Intelligent detection of truly broken college names.
    
    Uses scoring algorithm instead of simple pattern matching:
    - Detects split words (COLLEG + E → COLLEGE)
    - Identifies isolated letters that aren't common words
    - Checks for encoding artifacts
    """
    
    # Common English words that are single letters (not broken)
    VALID_SINGLE_LETTERS = {'A', 'I'}
    
    # Common two-letter words (not broken)
    VALID_TWO_LETTER = {'OF', 'TO', 'IN', 'ON', 'AT', 'BY', 'OR', 'AN', 'AS', 'IS', 'IT', 'NO', 'SO', 'UP', 'WE', 'DO', 'IF', 'GO', 'MY', 'BE', 'HE', 'ME'}
    
    # Common word fragments that when isolated indicate split
    WORD_ENDINGS = {'AL', 'AN', 'AR', 'ER', 'ED', 'EN', 'ES', 'IC', 'LE', 'LY', 'NT', 'NG', 'OR', 'TH', 'TY', 'RY', 'CE', 'GE', 'SE', 'TE', 'VE'}
    
    # Dictionary of common medical college words for split detection
    COMMON_WORDS = {
        'MEDICAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'UNIVERSITY', 'GOVERNMENT',
        'DENTAL', 'RESEARCH', 'CENTRE', 'CENTER', 'ACADEMY', 'SCHOOL', 'STUDIES',
        'POSTGRADUATE', 'SCIENCES', 'HEALTH', 'EDUCATION', 'TRAINING', 'NATIONAL',
        'STATE', 'DISTRICT', 'GENERAL', 'TEACHING', 'MEMORIAL', 'CHARITABLE',
        'TRUST', 'SOCIETY', 'FOUNDATION', 'AUTONOMOUS'
    }
    
    def is_truly_broken(self, name: str) -> tuple:
        """
        Determine if a name is truly broken (encoding issues, not valid).
        
        Returns:
            (is_broken: bool, confidence: float, reasons: list)
        """
        if not name:
            return False, 0.0, []
        
        name_upper = name.upper().strip()
        words = name_upper.split()
        score = 0.0
        reasons = []
        
        # DEFINITE broken: contains '?' or 'QUESTION'
        if '?' in name_upper or 'QUESTION' in name_upper:
            return True, 1.0, ['contains_question_mark']
        
        # Check for double spaces (encoding issue)
        if '  ' in name_upper:
            score += 0.3
            reasons.append('double_spaces')
        
        # Check for isolated single letters that aren't valid words
        # But SKIP if they appear to be initials (consecutive single letters like "B M")
        for i, word in enumerate(words):
            if len(word) == 1 and word.isalpha() and word not in self.VALID_SINGLE_LETTERS:
                # Check if this is part of consecutive initials (like B M PATIL)
                is_part_of_initials = False
                
                # Check if previous word is also a single letter (part of initials)
                if i > 0 and len(words[i-1]) <= 2:
                    is_part_of_initials = True
                
                # Check if next word is also a single letter (part of initials)
                if i < len(words) - 1 and len(words[i+1]) == 1:
                    is_part_of_initials = True
                
                if is_part_of_initials:
                    continue  # Skip - this is likely a name initial like B M
                
                # Check if it could be part of adjacent word (split word)
                if i > 0 and len(words[i-1]) > 2:  # Only check if prev word is not initial
                    combined = words[i-1] + word
                    if combined.upper() in self.COMMON_WORDS:  # Stricter: only COMMON_WORDS
                        score += 0.4
                        reasons.append(f'split_letter:{words[i-1]}+{word}')
                        continue
                if i < len(words) - 1 and len(words[i+1]) > 2:  # Only check if next word is not initial
                    combined = word + words[i+1]
                    if combined.upper() in self.COMMON_WORDS:  # Stricter: only COMMON_WORDS
                        score += 0.4
                        reasons.append(f'split_letter:{word}+{words[i+1]}')
                        continue
                
                # Isolated letter not forming a word - only flag truly suspicious ones
                if word in {'E', 'L', 'T'}:
                    # These rarely appear as initials, more likely encoding issues
                    score += 0.3
                    reasons.append(f'isolated_letter:{word}')
        
        # Check for split word fragments at end
        for i, word in enumerate(words):
            if len(word) == 2 and word in self.WORD_ENDINGS and i > 0:
                prev_word = words[i-1]
                # Skip if previous word is also short (likely initials like "S C B AL")
                if len(prev_word) <= 2:
                    continue
                # Check if previous word + this forms a complete word
                combined = prev_word + word
                # Only flag if it forms a KNOWN common word, not just any word
                if combined.upper() in self.COMMON_WORDS:
                    score += 0.4
                    reasons.append(f'split_suffix:{prev_word}+{word}')
        
        # Check for truncated common words - be more strict
        for i, word in enumerate(words):
            if len(word) >= 4:
                for common in self.COMMON_WORDS:
                    # Skip POST + GRADUATE which is valid as two words
                    if word == 'POST' and i < len(words) - 1 and words[i+1] == 'GRADUATE':
                        continue
                    # Check if word is a truncation of common word
                    if common.startswith(word) and len(common) > len(word):
                        if i < len(words) - 1:
                            # Check if next word completes it
                            next_word = words[i+1]
                            combined = word + next_word
                            # Only flag if it EXACTLY matches a common word
                            if combined == common:
                                score += 0.4
                                reasons.append(f'split_word:{word}+{next_word}={common}')
        
        # Very short names might be truncated
        if len(name_upper) < 10:
            score += 0.2
            reasons.append('very_short')
        
        # Determine if truly broken - raise threshold
        is_broken = score >= 0.4  # Raised from 0.3 to reduce false positives
        return is_broken, min(score, 1.0), reasons
    
    def _is_likely_word(self, text: str) -> bool:
        """Check if text looks like a valid English word (stricter check)."""
        text_upper = text.upper()
        
        # Reject if it's a known common word with a single letter attached
        # e.g., SHRIB, MPATIL, BMEDICAL are not words
        for common in ['MEDICAL', 'COLLEGE', 'HOSPITAL', 'DENTAL', 'INSTITUTE', 'RESEARCH']:
            if text_upper.endswith(common) and len(text_upper) == len(common) + 1:
                return False  # Single letter + common word is not a real word
            if text_upper.startswith(common) and len(text_upper) == len(common) + 1:
                return False  # Common word + single letter is not a real word
        
        # Basic heuristic: has vowels and reasonable length
        vowels = set('AEIOU')
        has_vowel = any(c in vowels for c in text_upper)
        reasonable_length = 3 <= len(text) <= 20
        return has_vowel and reasonable_length
    
    def detect(self, db_path: str, table: str = 'group_matching_queue') -> List[Dict]:
        """
        Find records with truly broken names using intelligent scoring.
        
        Returns:
            List of records with broken names, sorted by confidence
        """
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all uncorrected records
        cursor.execute(f"""
            SELECT group_id, normalized_college_name, normalized_state, 
                   normalized_address, sample_course_type,
                   corrected_college_name, correction_status
            FROM {table}
            WHERE corrected_college_name IS NULL OR correction_status = 'pending_review'
        """)
        
        all_records = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        # Filter to truly broken names only
        broken_records = []
        for record in all_records:
            name = record.get('normalized_college_name', '')
            is_broken, confidence, reasons = self.is_truly_broken(name)
            
            if is_broken:
                record['broken_confidence'] = confidence
                record['broken_reasons'] = reasons
                broken_records.append(record)
        
        # Sort by confidence (highest first)
        broken_records.sort(key=lambda x: x.get('broken_confidence', 0), reverse=True)
        
        return broken_records


class EmbeddingSimilaritySearch:
    """Finds similar college names using OpenRouter embeddings."""
    
    def __init__(
        self,
        master_db_path: str = 'data/sqlite/master_data.db',
        api_keys: List[str] = None,
    ):
        self.master_db_path = master_db_path
        self.model = OpenRouterEmbedding(api_keys=api_keys)
        self._embeddings_cache = None
    
    def _load_embeddings(self, state: str = None, course_type: str = None) -> List[Dict]:
        """Load embeddings from database, optionally filtered by state/course_type."""
        conn = sqlite3.connect(self.master_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = "SELECT college_id, college_name, state, course_type, embedding FROM master_embeddings WHERE 1=1"
        params = []
        
        if state:
            query += " AND UPPER(state) = UPPER(?)"
            params.append(state)
        
        if course_type:
            # Map course types
            if course_type.lower() in ('medical', 'mbbs', 'diploma'):
                query += " AND course_type = 'medical'"
            elif course_type.lower() in ('dental', 'bds'):
                query += " AND course_type = 'dental'"
            elif course_type.lower() == 'dnb':
                query += " AND course_type = 'dnb'"
        
        cursor.execute(query, params)
        
        results = []
        for row in cursor.fetchall():
            embedding = np.frombuffer(row['embedding'], dtype=np.float32)
            results.append({
                'id': row['college_id'],
                'name': row['college_name'],
                'state': row['state'],
                'course_type': row['course_type'],
                'embedding': embedding,
            })
        
        conn.close()
        return results
    
    def search(
        self,
        query_name: str,
        state: str = None,
        course_type: str = None,
        top_k: int = 10,
    ) -> List[Tuple[Dict, float]]:
        """
        Find TOP-K most similar colleges.
        
        Returns:
            List of (college_dict, similarity_score) tuples
        """
        # Load embeddings (filtered by state/course_type)
        candidates = self._load_embeddings(state, course_type)
        
        if not candidates:
            return []
        
        # Compute query embedding
        query_embedding = self.model.encode([query_name])[0]
        
        # Compute cosine similarities
        similarities = []
        for candidate in candidates:
            sim = np.dot(query_embedding, candidate['embedding']) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(candidate['embedding'])
            )
            similarities.append((candidate, float(sim)))
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        return similarities[:top_k]
    
    def batch_search(
        self,
        records: List[Dict],
        top_k: int = 10,
    ) -> Dict[int, List[Tuple[Dict, float]]]:
        """
        Find TOP-K most similar colleges for ALL records in ONE batch.
        
        This dramatically reduces API calls by computing all embeddings at once.
        
        Args:
            records: List of records with 'group_id', 'normalized_college_name', 
                    'normalized_state', 'sample_course_type'
            top_k: Number of top candidates per record
            
        Returns:
            Dict mapping group_id -> List of (college_dict, similarity_score)
        """
        if not records:
            return {}
        
        # Extract all query names for batch embedding
        query_names = [r['normalized_college_name'] for r in records]
        
        # Compute ALL query embeddings in ONE API call
        console.print(f"[cyan]   Computing embeddings for {len(query_names)} names in batch...[/cyan]")
        query_embeddings = self.model.encode(query_names, show_progress_bar=False)
        
        # Pre-load all embeddings by state+course_type
        embeddings_cache = {}
        
        results = {}
        for idx, record in enumerate(records):
            query_embedding = query_embeddings[idx]
            state = record.get('normalized_state')
            course_type = record.get('sample_course_type')
            
            # Cache embeddings by state+course_type
            cache_key = (state, course_type)
            if cache_key not in embeddings_cache:
                embeddings_cache[cache_key] = self._load_embeddings(state, course_type)
            
            candidates = embeddings_cache[cache_key]
            
            if not candidates:
                results[record['group_id']] = []
                continue
            
            # Compute cosine similarities
            similarities = []
            query_norm = np.linalg.norm(query_embedding)
            if query_norm == 0:
                results[record['group_id']] = []
                continue
                
            for candidate in candidates:
                cand_norm = np.linalg.norm(candidate['embedding'])
                if cand_norm == 0:
                    continue
                sim = np.dot(query_embedding, candidate['embedding']) / (query_norm * cand_norm)
                similarities.append((candidate, float(sim)))
            
            # Sort by similarity (descending)
            similarities.sort(key=lambda x: x[1], reverse=True)
            results[record['group_id']] = similarities[:top_k]
        
        return results


class MultiModelVerifier:
    """Verifies name corrections using multiple LLM models with retry and fallback."""
    
    SYSTEM_PROMPT = """You are an OCR error fixer. Your ONLY job is to fix words broken by OCR scanning.

⚠️ CRITICAL: You must NEVER change the college identity. ONLY fix broken words.

Given a BROKEN name, fix any words that were split by OCR scanning.

WHAT TO FIX:
- "GOVER NMENT" → "GOVERNMENT"
- "MEDICA L" → "MEDICAL"
- "COLLEG E" → "COLLEGE"
- "HOSPIT AL" → "HOSPITAL"

WHAT TO PRESERVE:
- College names, person names, location names - keep unchanged
- Initials like "B M", "S C B" - keep as-is

Return JSON: {"corrected_name": "FIXED NAME", "confidence": 0.0-1.0}

If no fix needed, return the original name with confidence 1.0.
"""
    
    def __init__(self, api_keys: List[str]):
        self.clients = [OpenRouterClient(api_key=key) for key in api_keys]
        self.api_keys = api_keys
        
        # Load MODEL_CONFIG from config.yaml
        self.MODEL_CONFIG = self._load_model_config()
        
        # Model health tracking
        self.model_cooldowns = {}  # model -> cooldown_until timestamp
        self.model_failures = {}   # model -> consecutive failure count
        
        # Get ordered list of models by priority
        self.models = sorted(
            self.MODEL_CONFIG.keys(),
            key=lambda m: self.MODEL_CONFIG[m].get('priority', 99)
        )
        
        console.print(f"[cyan]Loaded {len(self.models)} models from config.yaml[/cyan]")
    
    def _load_model_config(self) -> Dict:
        """Load model configuration from config.yaml."""
        import yaml
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            
            # Get models from agentic_matcher section
            if 'agentic_matcher' in config and 'models' in config['agentic_matcher']:
                models_config = config['agentic_matcher']['models']
                # Add is_free flag based on model name
                for model_name, model_cfg in models_config.items():
                    model_cfg['is_free'] = ':free' in model_name.lower()
                return models_config
            
            console.print("[yellow]⚠️ No models found in config.yaml[/yellow]")
            return {}
        except Exception as e:
            console.print(f"[red]❌ Error loading models from config: {e}[/red]")
            return {}
    
    def _is_model_available(self, model: str) -> bool:
        """Check if model is available (not on cooldown)."""
        if model not in self.model_cooldowns:
            return True
        return time.time() > self.model_cooldowns[model]
    
    def _record_failure(self, model: str, is_rate_limit: bool = False):
        """Record model failure and apply cooldown if needed."""
        self.model_failures[model] = self.model_failures.get(model, 0) + 1
        
        if is_rate_limit:
            # Rate limit: longer cooldown (5 minutes for free models)
            cooldown = 300 if self.MODEL_CONFIG.get(model, {}).get('is_free', True) else 60
            self.model_cooldowns[model] = time.time() + cooldown
            logger.info(f"Model {model.split('/')[-1]} rate-limited, cooldown {cooldown}s")
        elif self.model_failures[model] >= 3:
            # Too many failures: short cooldown
            self.model_cooldowns[model] = time.time() + 30
    
    def _record_success(self, model: str):
        """Record model success (reset failure count)."""
        self.model_failures[model] = 0
    
    def _get_available_models(self, exclude: set = None) -> List[str]:
        """Get list of available models (not on cooldown, not excluded)."""
        exclude = exclude or set()
        available = []
        
        for model in self.models:
            if model in exclude:
                continue
            if not self._is_model_available(model):
                continue
            available.append(model)
        
        return available
    
    def _fuzzy_name_fallback(self, broken_name: str, candidates: List[Tuple[Dict, float]]) -> Tuple[Optional[str], Optional[str], float]:
        """
        Fallback: Use fuzzy matching to pick best candidate without LLM.
        
        This is used when all LLM models fail.
        """
        if not candidates:
            return None, None, 0.0
        
        # Remove extra spaces and compare
        cleaned_broken = broken_name.replace(' ', '')
        
        from rapidfuzz import fuzz
        
        best_match = None
        best_score = 0.0
        best_id = None
        
        for candidate, embed_sim in candidates:
            candidate_name = candidate['name']
            cleaned_candidate = candidate_name.replace(' ', '')
            
            # Fuzzy ratio ignoring spaces
            score = fuzz.ratio(cleaned_broken, cleaned_candidate) / 100.0
            
            # Combine with embedding similarity
            combined = (score * 0.6) + (embed_sim * 0.4)
            
            if combined > best_score:
                best_score = combined
                best_match = candidate_name
                best_id = candidate['id']
        
        # Only return if high confidence
        if best_score >= 0.75:
            return best_match, best_id, best_score
        return None, None, 0.0
    
    def verify(
        self,
        broken_name: str,
        state: str,
        candidates: List[Tuple[Dict, float]],
        num_votes: int = 3,
        max_retries: int = 5,
    ) -> Tuple[Optional[str], Optional[str], float, Dict[str, str]]:
        """
        Verify correction using multiple models with retry and fallback.
        
        Returns:
            (corrected_name, matched_id, confidence, votes)
        """
        if not candidates:
            return None, None, 0.0, {}
        
        # Build prompt
        candidates_str = "\n".join([
            f"{c[0]['id']}|{c[0]['name']}|{c[0]['state']} (similarity: {c[1]:.1%})"
            for c in candidates
        ])
        
        user_prompt = f"""BROKEN NAME: {broken_name}
STATE: {state}

CANDIDATES (ID|Name|State):
{candidates_str}

Find the best match. Return JSON only."""
        
        votes = {}
        models_tried = set()
        
        # Try to get num_votes successful responses
        while len(votes) < num_votes and len(models_tried) < max_retries:
            # Get available models
            available = self._get_available_models(exclude=models_tried)
            
            if not available:
                logger.debug(f"No available models, falling back to fuzzy matching")
                break
            
            # Pick next model
            model = available[0]
            models_tried.add(model)
            
            # Use rotating client
            client_idx = len(models_tried) % len(self.clients)
            client = self.clients[client_idx]
            
            try:
                timeout = self.MODEL_CONFIG.get(model, {}).get('timeout', 30)
                
                response = client.complete(
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    model=model,
                    temperature=0.1,
                    max_tokens=200,
                    timeout=timeout,
                )
                
                # Parse response
                json_str = response.content
                if "```json" in json_str:
                    json_str = json_str.split("```json")[1].split("```")[0]
                elif "```" in json_str:
                    json_str = json_str.split("```")[1].split("```")[0]
                
                data = json.loads(json_str.strip())
                corrected = data.get('corrected_name')
                
                if corrected:
                    votes[model] = corrected
                    self._record_success(model)
                    logger.debug(f"✓ {model.split('/')[-1]}: {corrected[:40]}...")
                else:
                    logger.debug(f"✗ {model.split('/')[-1]}: no match suggested")
                    
            except Exception as e:
                error_str = str(e)
                is_rate_limit = "429" in error_str
                is_timeout = "timeout" in error_str.lower()
                
                self._record_failure(model, is_rate_limit=is_rate_limit)
                
                if is_rate_limit:
                    logger.debug(f"✗ {model.split('/')[-1]}: rate limited")
                elif is_timeout:
                    logger.debug(f"✗ {model.split('/')[-1]}: timeout")
                else:
                    logger.debug(f"✗ {model.split('/')[-1]}: {str(e)[:50]}")
                
                # Small delay before retry
                time.sleep(0.5)
        
        # If we got votes, use voting
        if votes:
            from collections import Counter
            vote_counts = Counter(votes.values())
            best_answer, count = vote_counts.most_common(1)[0]
            confidence = count / len(votes)
            
            # Find matched_id
            matched_id = None
            for candidate, sim in candidates:
                if candidate['name'] == best_answer:
                    matched_id = candidate['id']
                    break
            
            return best_answer, matched_id, confidence, votes
        
        # Fallback to fuzzy matching
        logger.debug("All LLM models failed, using fuzzy fallback")
        corrected, matched_id, conf = self._fuzzy_name_fallback(broken_name, candidates)
        if corrected:
            return corrected, matched_id, conf, {"fuzzy_fallback": corrected}
        
        return None, None, 0.0, {}


class NameFixerPipeline:
    """Main pipeline orchestrator."""
    
    def __init__(
        self,
        queue_db_path: str,
        master_db_path: str = 'data/sqlite/master_data.db',
        api_keys: List[str] = None,
        dry_run: bool = False,
    ):
        self.queue_db_path = queue_db_path
        self.master_db_path = master_db_path
        self.dry_run = dry_run
        
        # Load API keys from config if not provided
        if api_keys is None:
            api_keys = self._load_api_keys()
        
        self.api_keys = api_keys
        
        # Initialize components (pass api_keys for OpenRouter embeddings)
        self.embedding_builder = MasterEmbeddingBuilder(master_db_path, api_keys=api_keys)
        self.word_merger = WordMerger(master_db_path)  # NEW: Dictionary-based word merging
        self.detector = IntelligentDetector()
        self.searcher = EmbeddingSimilaritySearch(master_db_path, api_keys=api_keys)
        self.verifier = MultiModelVerifier(api_keys)
    
    def _load_api_keys(self) -> List[str]:
        """Load API keys from config.yaml."""
        import yaml
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
            
            # Try agentic_matcher.api_keys first
            if 'agentic_matcher' in config and 'api_keys' in config['agentic_matcher']:
                keys = config['agentic_matcher']['api_keys']
                if keys:
                    console.print(f"[green]Loaded {len(keys)} API keys from config[/green]")
                    return keys
            
            # Fallback to top-level api_keys
            if 'api_keys' in config:
                keys = config['api_keys']
                if keys:
                    return keys
            
            console.print("[yellow]⚠️ No API keys found in config.yaml[/yellow]")
            return []
        except Exception as e:
            console.print(f"[red]❌ Error loading config: {e}[/red]")
            return []
    
    # Common words that exist in most college names - should be excluded from unique word matching
    COMMON_WORDS = frozenset({
        'MEDICAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'OF', 'AND', 'THE', 
        'SCIENCES', 'SCIENCE', 'EDUCATION', 'RESEARCH', 'CENTRE', 'CENTER',
        'DENTAL', 'GOVERNMENT', 'GOVT', 'PRIVATE', 'PVT', 'UNIVERSITY',
        'ACADEMY', 'SCHOOL', 'FOUNDATION', 'TRUST', 'CHARITABLE', 'SOCIETY',
        'FOR', 'IN', 'AT', 'WITH', 'STUDIES', 'TRAINING', 'POSTGRADUATE',
        'POST', 'GRADUATE', 'UNDER', 'SUPER', 'SPECIALTY', 'SPECIALITY',
        'MULTI', 'TEACHING', 'GENERAL', 'DISTRICT', 'REGIONAL', 'LT',
        'STATE', 'NATIONAL', 'INTERNATIONAL', 'INDIAN', 'INDIA', 'DR', 'SHRI',
    })
    
    # Dictionary of common split word patterns for deterministic OCR fixing
    OCR_SPLIT_PATTERNS = {
        # Common splits: fragment → full word
        'GOVER': 'GOVERN', 'GOVERN': 'GOVERN', 'GOVERNM': 'GOVERNMENT', 
        'MEDICA': 'MEDICAL', 'MEDI': 'MEDI', 'MEDIC': 'MEDIC',
        'COLLEG': 'COLLEGE', 'COLL': 'COLL',
        'HOSPIT': 'HOSPITAL', 'HOSP': 'HOSP',
        'INSTITU': 'INSTITUTE', 'INST': 'INST',
        'UNIVERSIT': 'UNIVERSITY', 'UNIV': 'UNIV',
        'DENT': 'DENT', 'DENTA': 'DENTAL',
        'RESEARC': 'RESEARCH', 'RES': 'RES',
        'SCIENC': 'SCIENCE', 'SCI': 'SCI',
        'CHHATT': 'CHHATTIS', 'CHHATTIS': 'CHHATTISGARH',
        'POSTGRADUAT': 'POSTGRADUATE', 'POSTGR': 'POSTGR',
    }
    
    def _fix_ocr_splits(self, name: str) -> str:
        """
        Rule-based OCR split word fixer.
        
        Merges common split patterns like:
        - "GOVER NMENT" → "GOVERNMENT"
        - "MEDICA L COLLEG E" → "MEDICAL COLLEGE"
        - "CHHATT ISGARH" → "CHHATTISGARH"
        
        Returns:
            Fixed name with merged words
        """
        if not name:
            return name
        
        words = name.upper().split()
        if len(words) < 2:
            return name
        
        result = []
        i = 0
        
        while i < len(words):
            current = words[i]
            
            # Check if current word + next word(s) form a complete word
            merged = False
            
            # Try merging up to 3 fragments
            for lookahead in range(1, min(4, len(words) - i)):
                test_merge = ''.join(words[i:i+lookahead+1])
                
                # Check if merged word is in our known words list
                if test_merge in self.COMMON_WORDS or test_merge in {
                    'GOVERNMENT', 'MEDICAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE',
                    'UNIVERSITY', 'DENTAL', 'RESEARCH', 'SCIENCES', 'SCIENCE',
                    'CHHATTISGARH', 'POSTGRADUATE', 'AUTONOMOUS', 'MEMORIAL',
                    'EDUCATION', 'TRAINING', 'CHARITABLE', 'FOUNDATION',
                }:
                    result.append(test_merge)
                    i += lookahead + 1
                    merged = True
                    break
                    
            if not merged:
                result.append(current)
                i += 1
        
        return ' '.join(result)
    def _multi_level_similarity_check(self, original: str, corrected: str) -> tuple[bool, float]:
        """
        Smart validation for name corrections.
        
        Strategy:
        1. Merge split words (GOVER NMENT → GOVERNMENT)
        2. Check if merged original is contained in corrected (handles suffix additions)
        3. Check unique identifier preservation (catches S R → B M mismatches)
        
        Returns:
            (passed: bool, confidence_score: float)
        """
        from rapidfuzz import fuzz
        
        # ===== PHASE 1: NORMALIZE AND MERGE SPLIT WORDS =====
        # This handles encoding issues like "GOVER NMENT" → "GOVERNMENT"
        
        def merge_split_words(text: str) -> str:
            """Merge adjacent fragments that form valid words."""
            words = text.upper().split()
            if not words:
                return ""
            
            merged = []
            i = 0
            while i < len(words):
                current = words[i]
                
                # Try merging with next word(s) if current is short
                while i + 1 < len(words) and len(current) < 4:
                    next_word = words[i + 1]
                    # Merge if combining them looks like one word
                    combined = current + next_word
                    if len(next_word) <= 3 or len(current) <= 2:
                        current = combined
                        i += 1
                    else:
                        break
                
                merged.append(current)
                i += 1
            
            return ' '.join(merged)
        
        orig_merged = merge_split_words(original)
        corr_clean = ' '.join(corrected.upper().split())
        
        # Also get no-space versions
        orig_nospace = ''.join(orig_merged.split())
        corr_nospace = ''.join(corr_clean.split())
        
        # Extract words for checks
        orig_words = set(orig_merged.split())
        corr_words = set(corr_clean.split())
        
        # ===== PHASE 1: EARLY ABBREVIATION MISMATCH CHECK =====
        # This MUST run first to catch S R PATIL → B M PATIL
        
        orig_abbrevs = {w for w in orig_words if len(w) <= 2 and w.isalpha()}
        corr_abbrevs = {w for w in corr_words if len(w) <= 2 and w.isalpha()}
        
        # If original has 2+ abbreviations like {S, R} and corrected has different ones {B, M}
        # Check the overlap - if there's NO overlap at all, it's likely wrong
        if len(orig_abbrevs) >= 2 and len(corr_abbrevs) >= 2:
            overlap = len(orig_abbrevs & corr_abbrevs)
            # Calculate overlap ratio based on smaller set
            min_count = min(len(orig_abbrevs), len(corr_abbrevs))
            overlap_ratio = overlap / min_count if min_count > 0 else 0
            
            # If less than 50% overlap in abbreviations, likely wrong match
            if overlap_ratio < 0.5:
                return False, 50.0  # Definite mismatch
        
        # ===== PHASE 2: ACRONYM EXPANSION CHECK =====
        # Handle MGM → MAHATMA GANDHI MEMORIAL by checking if abbreviations match first letters
        
        # Common words to exclude
        common = {'MEDICAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'OF', 'AND', 'THE', 
                 'SCIENCES', 'SCIENCE', 'EDUCATION', 'RESEARCH', 'CENTRE', 'CENTER',
                 'DENTAL', 'GOVERNMENT', 'GOVT', 'PRIVATE', 'PVT', 'UNIVERSITY', 'A',
                 'ACADEMY', 'SCHOOL', 'FOUNDATION', 'FOR', 'IN', 'AT', 'WITH'}
        
        corr_non_common = [w for w in corr_clean.split() if w not in common and len(w) > 2]
        
        # Check if abbrevs form acronym of corrected name
        if orig_abbrevs_meaningful and len(orig_abbrevs_meaningful) >= 2:
            # Get first letters of corrected non-common words
            corr_first_letters = {w[0] for w in corr_non_common if w}
            
            # If abbreviations match first letters, it's an acronym expansion
            abbrev_match = len(orig_abbrevs & corr_first_letters) / len(orig_abbrevs) if orig_abbrevs else 0
            if abbrev_match >= 0.5:
                # This looks like an acronym expansion (MGM → Mahatma Gandhi Memorial)
                return True, 90.0
        
        # ===== PHASE 3: DIRECT MATCH CHECKS =====
        
        # Check 1: High similarity when spaces removed (encoding fix)
        nospace_sim = fuzz.ratio(orig_nospace, corr_nospace)
        if nospace_sim >= 90:
            return True, nospace_sim
        
        # Check 2: Original contained in corrected (suffix addition)
        # e.g., "GOVERNMENT MEDICAL COLLEGE" in "GOVERNMENT MEDICAL COLLEGE AND HOSPITAL"
        if orig_nospace in corr_nospace or fuzz.partial_ratio(orig_nospace, corr_nospace) >= 95:
            return True, 95.0
        
        # ===== PHASE 3: UNIQUE IDENTIFIER CHECK =====
        # Extract unique identifiers (not common words)
        
        orig_words = set(orig_merged.split())
        corr_words = set(corr_clean.split())
        
        # Common words to exclude
        common = {'MEDICAL', 'COLLEGE', 'HOSPITAL', 'INSTITUTE', 'OF', 'AND', 'THE', 
                 'SCIENCES', 'SCIENCE', 'EDUCATION', 'RESEARCH', 'CENTRE', 'CENTER',
                 'DENTAL', 'GOVERNMENT', 'GOVT', 'PRIVATE', 'PVT', 'UNIVERSITY', 'A',
                 'ACADEMY', 'SCHOOL', 'FOUNDATION', 'TRUST', 'CHARITABLE', 'SOCIETY',
                 'FOR', 'IN', 'AT', 'WITH', 'STUDIES', 'TRAINING', 'POSTGRADUATE',
                 'POST', 'GRADUATE', 'SUPER', 'SPECIALTY', 'MULTI', 'TEACHING',
                 'GENERAL', 'DISTRICT', 'REGIONAL', 'STATE', 'NATIONAL', 'DR', 'SHRI', 'LT'}
        
        orig_unique = {w for w in orig_words - common if len(w) > 2}
        corr_unique = {w for w in corr_words - common if len(w) > 2}
        
        # Check if unique identifiers from original exist in corrected
        if orig_unique:
            matched = 0
            for orig_word in orig_unique:
                # Check fuzzy match against any word in corrected
                best_match = 0
                for corr_word in corr_unique | corr_words:
                    # Allow substring matching for split words
                    if orig_word in corr_word or corr_word in orig_word:
                        best_match = 100
                        break
                    score = fuzz.ratio(orig_word, corr_word)
                    best_match = max(best_match, score)
                
                if best_match >= 75:
                    matched += 1
            
            match_ratio = matched / len(orig_unique)
            
            # Pass if most unique identifiers are preserved
            if match_ratio >= 0.7:
                return True, 70 + (match_ratio * 30)
        
        # ===== PHASE 5: FINAL FUZZY CHECK =====
        # Fall back to overall similarity
        
        overall_sim = fuzz.token_sort_ratio(orig_merged, corr_clean)
        partial_sim = fuzz.partial_ratio(orig_merged, corr_clean)
        
        # Combined score favoring partial matching for truncated names
        combined = max(overall_sim, partial_sim * 0.9)
        
        # Pass if combined score is high enough
        return combined >= 80, combined
    
    def _ensure_columns_exist(self):
        """Add correction columns to group_matching_queue if they don't exist."""
        conn = sqlite3.connect(self.queue_db_path, timeout=30)
        conn.execute("PRAGMA journal_mode=WAL")  # Enable WAL for concurrent access
        conn.execute("PRAGMA busy_timeout=30000")  # 30 second timeout
        cursor = conn.cursor()
        
        # Check existing columns
        cursor.execute("PRAGMA table_info(group_matching_queue)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        
        # Add missing columns
        new_cols = [
            ('corrected_college_name', 'TEXT'),
            ('correction_confidence', 'REAL'),
            ('correction_status', 'TEXT'),
        ]
        
        for col_name, col_type in new_cols:
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE group_matching_queue ADD COLUMN {col_name} {col_type}")
                    console.print(f"[cyan]Added column: {col_name}[/cyan]")
                except sqlite3.OperationalError as e:
                    if "duplicate column" not in str(e).lower():
                        console.print(f"[yellow]Warning: Could not add {col_name}: {e}[/yellow]")
        
        conn.commit()
        conn.close()
    
    def run(self, limit: int = None, verbose: bool = False) -> Dict:
        """Run the full pipeline with PARALLEL BATCH PROCESSING.
        
        Args:
            limit: Max number of records to process (for testing)
            verbose: Show detailed output per record
        """
        console.print(Panel.fit(
            "[bold cyan]🔧 EMBEDDING-BASED NAME FIXER PIPELINE (PARALLEL)[/bold cyan]",
            border_style="cyan"
        ))
        
        # Step 1: Ensure schema
        console.print("\n[bold]Step 1: Ensuring database schema...[/bold]")
        self._ensure_columns_exist()
        
        # Step 2: Build/verify embeddings
        console.print("\n[bold]Step 2: Building master embeddings...[/bold]")
        self.embedding_builder.build_embeddings()
        
        # Step 3: Detect broken names
        console.print("\n[bold]Step 3: Detecting broken names...[/bold]")
        broken_records = self.detector.detect(self.queue_db_path)
        console.print(f"[yellow]Found {len(broken_records)} records with potential issues[/yellow]")
        
        if not broken_records:
            console.print("[green]✅ No broken names detected![/green]")
            return {'fixed': 0, 'skipped': 0, 'pending': 0}
        
        # Apply limit if specified
        if limit:
            broken_records = broken_records[:limit]
            console.print(f"[cyan]Processing first {limit} records only (--limit)[/cyan]")
        
        # Step 3.5: DICTIONARY-BASED WORD MERGING (NEW - 100% confidence)
        console.print("\n[bold]Step 3.5: Dictionary-based word merging (100% confidence)...[/bold]")
        merge_result = self.word_merger.fix_batch(broken_records)
        
        auto_fixed_count = len(merge_result['fixed'])
        if auto_fixed_count > 0:
            console.print(f"[green]✅ Auto-fixed {auto_fixed_count} records with dictionary merging[/green]")
            
            # Show sample fixes
            for change in merge_result['changes'][:5]:
                console.print(f"   [dim]{change['original'][:50]}[/dim]")
                console.print(f"   [green]→ {change['corrected'][:50]}[/green]")
                console.print(f"   [cyan]  Changes: {', '.join(change['changes'])}[/cyan]")
            
            if auto_fixed_count > 5:
                console.print(f"   [dim]... and {auto_fixed_count - 5} more[/dim]")
            
            # Apply auto-fixes to database
            if not self.dry_run:
                conn = sqlite3.connect(self.queue_db_path)
                cursor = conn.cursor()
                
                # Ensure corrected_address column exists
                try:
                    cursor.execute("ALTER TABLE group_matching_queue ADD COLUMN corrected_address TEXT")
                    conn.commit()
                except sqlite3.OperationalError:
                    pass  # Column already exists
                
                for record in merge_result['fixed']:
                    corrected_name = record.get('corrected_name')
                    corrected_addr = record.get('corrected_address')
                    
                    if corrected_name and corrected_addr:
                        cursor.execute("""
                            UPDATE group_matching_queue
                            SET corrected_college_name = ?,
                                corrected_address = ?,
                                correction_status = 'auto_applied',
                                correction_confidence = 1.0
                            WHERE group_id = ?
                        """, (corrected_name, corrected_addr, record['group_id']))
                    elif corrected_name:
                        cursor.execute("""
                            UPDATE group_matching_queue
                            SET corrected_college_name = ?,
                                correction_status = 'auto_applied',
                                correction_confidence = 1.0
                            WHERE group_id = ?
                        """, (corrected_name, record['group_id']))
                    elif corrected_addr:
                        cursor.execute("""
                            UPDATE group_matching_queue
                            SET corrected_address = ?,
                                correction_status = 'auto_applied',
                                correction_confidence = 1.0
                            WHERE group_id = ?
                        """, (corrected_addr, record['group_id']))
                        
                conn.commit()
                conn.close()
                
                # Count address fixes
                addr_fixed = sum(1 for r in merge_result['fixed'] if r.get('corrected_address'))
                console.print(f"[green]✅ Applied {auto_fixed_count} dictionary-based corrections to database[/green]")
                if addr_fixed > 0:
                    console.print(f"[green]   (including {addr_fixed} address corrections)[/green]")
        
        # Continue with remaining records that couldn't be fixed by dictionary
        remaining_broken = merge_result['unchanged']
        console.print(f"[yellow]{len(remaining_broken)} records need LLM verification[/yellow]")
        
        if not remaining_broken:
            console.print("[green]✅ All records fixed by dictionary merging![/green]")
            return {'fixed': auto_fixed_count, 'skipped': 0, 'pending': 0, 'dictionary_fixed': auto_fixed_count}
        
        # Step 4: PRE-COMPUTE CANDIDATES for REMAINING records using BATCH embedding
        console.print("\n[bold]Step 4: Finding embedding candidates for remaining records (BATCHED)...[/bold]")
        
        # Use batch_search to compute ALL embeddings in ONE API call
        all_candidates = self.searcher.batch_search(remaining_broken, top_k=10)
        
        # Filter records with good candidates
        records_with_candidates = []
        for record in remaining_broken:
            candidates = all_candidates.get(record['group_id'], [])
            top_sim = candidates[0][1] if candidates else 0
            if top_sim >= 0.5:
                record['candidates'] = candidates
                records_with_candidates.append(record)
        
        console.print(f"[cyan]Found candidates for {len(records_with_candidates)}/{len(remaining_broken)} records[/cyan]")
        
        if not records_with_candidates:
            console.print("[yellow]No records with good candidates found[/yellow]")
            return {'fixed': auto_fixed_count, 'skipped': len(remaining_broken), 'pending': 0, 'dictionary_fixed': auto_fixed_count}
        
        # Step 5: GROUP BY STATE + COURSE_TYPE
        console.print("\n[bold]Step 5: Grouping by state + course_type...[/bold]")
        from collections import defaultdict
        
        state_course_groups = defaultdict(list)
        for record in records_with_candidates:
            key = (record['normalized_state'], record['sample_course_type'])
            state_course_groups[key].append(record)
        
        console.print(f"[cyan]Created {len(state_course_groups)} groups[/cyan]")
        
        # Step 6: CREATE BATCHES (5 records per batch)
        BATCH_SIZE = 5
        batches = []
        for (state, course_type), records in state_course_groups.items():
            for i in range(0, len(records), BATCH_SIZE):
                batch = records[i:i + BATCH_SIZE]
                batches.append({
                    'state': state,
                    'course_type': course_type,
                    'records': batch,
                })
        
        console.print(f"[cyan]Split into {len(batches)} batches of ~{BATCH_SIZE} records[/cyan]")
        
        # Step 7: PARALLEL BATCH PROCESSING
        console.print("\n[bold]Step 6: Processing batches in parallel...[/bold]")
        
        # Use all workers like agentic_matcher - SmartRetryQueue handles rate limits reactively
        num_workers = min(len(self.api_keys), 22)
        num_models = len(self.verifier.models)
        console.print(f"[green]🚀 Using {num_workers} parallel workers with {num_models} models[/green]")
        
        results = {
            'auto_applied': [],
            'pending_review': [],
            'skipped': [],
        }
        
        # Initialize performance tracking and resilience (shared with agentic_matcher)
        perf_tracker = get_performance_tracker()
        retry_queue = get_retry_queue()
        circuit_breaker = get_circuit_breaker()
        cost_tracker = get_cost_tracker()
        cost_tracker.start_run()
        
        def process_batch(batch_idx: int, batch: Dict, model: str, client_idx: int):
            """Process a single batch of records."""
            client = self.verifier.clients[client_idx % len(self.verifier.clients)]
            records = batch['records']
            state = batch['state']
            
            # Build batch prompt
            batch_prompt = self._build_batch_prompt(records, state)
            
            timeout = self.verifier.MODEL_CONFIG.get(model, {}).get('timeout', 60)
            
            start_time = time.time()
            
            try:
                response = client.complete(
                    messages=[
                        {"role": "system", "content": self._get_batch_system_prompt()},
                        {"role": "user", "content": batch_prompt},
                    ],
                    model=model,
                    temperature=0.1,
                    max_tokens=2000,
                    timeout=timeout,
                )
                
                elapsed = time.time() - start_time
                
                # Record successful call
                perf_tracker.record_call(
                    model=model,
                    success=True,
                    response_time=elapsed,
                    batch_size=len(records),
                )
                
                # Record success in retry queue and circuit breaker
                retry_queue.on_success(model)
                circuit_breaker.record_success(model)
                
                # Track token usage
                usage = response.usage if hasattr(response, 'usage') else {}
                cost_tracker.record_usage(
                    model=model,
                    prompt_tokens=usage.get('prompt_tokens', 0),
                    completion_tokens=usage.get('completion_tokens', 0),
                )
                
                # Parse batch response
                corrections = self._parse_batch_response(response.content, records)
                return batch_idx, corrections, {"model": model, "success": True}
                
            except Exception as e:
                elapsed = time.time() - start_time
                error_str = str(e)
                is_rate_limit = "429" in error_str
                is_timeout = "timeout" in error_str.lower()
                
                # Determine error type
                if is_rate_limit:
                    error_type = "rate_limit"
                elif is_timeout:
                    error_type = "timeout"
                else:
                    error_type = "error"
                
                # Record failed call
                perf_tracker.record_call(
                    model=model,
                    success=False,
                    response_time=elapsed,
                    error_type=error_type,
                    batch_size=len(records),
                )
                
                # Apply cooldown/backoff via retry queue
                retry_queue.on_error(model, error_type)
                
                # Record in circuit breaker (may trip)
                circuit_breaker.record_failure(model)
                
                return batch_idx, None, {"model": model, "success": False, "error": error_type}
        
        # Process batches in parallel with MULTI-ROUND APPROACH
        # (Like agentic_matcher: process all, collect failures, wait, retry)
        MAX_ROUNDS = 5
        ROUND_DELAY = 30  # seconds (reduced - fewer failures expected)
        
        completed_batches = {}
        pending_batches = list(enumerate(batches))  # [(idx, batch), ...]
        
        # Filter to available models (via circuit breaker)
        available_models = circuit_breaker.get_available_models(self.verifier.models)
        console.print(f"[cyan]   {len(available_models)}/{num_models} models available (circuit breaker)[/cyan]")
        
        total_fixed = 0
        consecutive_zero_rounds = 0
        
        for round_num in range(1, MAX_ROUNDS + 1):
            if not pending_batches:
                break
            
            console.print(f"\n[bold magenta]🔄 ROUND {round_num}/{MAX_ROUNDS} - {len(pending_batches)} batches to process[/bold magenta]")
            
            # Get fresh ranked models for this round (circuit breaker may have recovered)
            available_models = circuit_breaker.get_available_models(self.verifier.models)
            ranked_models = perf_tracker.get_ranked_models(available_models) if available_models else self.verifier.models
            
            if not ranked_models:
                console.print("[yellow]   No models available, waiting for cooldown...[/yellow]")
                time.sleep(ROUND_DELAY)
                continue
            
            round_fixed = 0
            failed_batches = []
            
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("{task.completed}/{task.total}"),
                TextColumn("•"),
                TextColumn("[green]{task.fields[fixed]} fixed[/green]"),
                console=console,
            ) as progress:
                task = progress.add_task(
                    f"Round {round_num} batches...", 
                    total=len(pending_batches), 
                    fixed=total_fixed
                )
                
                # Use round-robin model assignment (different starting model each round)
                round_offset = (round_num - 1) % len(ranked_models)
                
                with ThreadPoolExecutor(max_workers=num_workers) as executor:
                    # Submit all batches immediately - SmartRetryQueue handles rate limits
                    futures = {}
                    for idx, (batch_idx, batch) in enumerate(pending_batches):
                        model_idx = (round_offset + idx) % len(ranked_models)
                        model = ranked_models[model_idx]
                        future = executor.submit(process_batch, batch_idx, batch, model, idx)
                        futures[future] = batch_idx
                    
                    # Track which models have been tried per batch
                    models_tried = {i: set() for i in range(len(batches))}
                    for idx, (batch_idx, _) in enumerate(pending_batches):
                        model_idx = (round_offset + idx) % len(ranked_models)
                        models_tried[batch_idx].add(ranked_models[model_idx])
                    
                    # Process as they complete with INSTANT PARALLEL FALLBACK
                    max_retries_per_batch = 3  # Try up to 3 different models
                    
                    while futures:
                        for future in as_completed(futures):
                            batch_idx = futures[future]
                            try:
                                result_idx, corrections, info = future.result()
                                
                                if info["success"] and corrections:
                                    # Success!
                                    completed_batches[batch_idx] = corrections
                                    batch_fixed = len([c for c in corrections if c.get('corrected_name')])
                                    round_fixed += batch_fixed
                                    total_fixed += batch_fixed
                                    progress.update(task, advance=1, fixed=total_fixed)
                                else:
                                    # Failed - try INSTANT FALLBACK on different model
                                    tried = models_tried[batch_idx]
                                    untried = [m for m in ranked_models if m not in tried]
                                    
                                    if untried and len(tried) < max_retries_per_batch:
                                        # Retry immediately on different model
                                        next_model = retry_queue.get_next_model(ranked_models, tried)
                                        if next_model:
                                            models_tried[batch_idx].add(next_model)
                                            new_future = executor.submit(
                                                process_batch, batch_idx, batches[batch_idx], next_model, len(tried)
                                            )
                                            futures[new_future] = batch_idx
                                            # Don't advance progress - retrying
                                        else:
                                            # No model available - add to round retry
                                            failed_batches.append((batch_idx, batches[batch_idx]))
                                            progress.update(task, advance=1, fixed=total_fixed)
                                    else:
                                        # Exhausted retries - add to round retry
                                        failed_batches.append((batch_idx, batches[batch_idx]))
                                        progress.update(task, advance=1, fixed=total_fixed)
                            except Exception as e:
                                # Exception - add to retry list
                                console.print(f"[red]   Batch {batch_idx} exception: {e}[/red]")
                                failed_batches.append((batch_idx, batches[batch_idx]))
                                progress.update(task, advance=1, fixed=total_fixed)
                            
                            # Remove processed future
                            del futures[future]
                            break  # Restart as_completed iteration
            
            # Round summary
            console.print(f"[green]   Round {round_num} complete: {round_fixed} fixed, {len(failed_batches)} failed[/green]")
            
            # Update pending batches for next round
            pending_batches = failed_batches
            
            # Smart early exit
            if round_fixed == 0:
                consecutive_zero_rounds += 1
                if consecutive_zero_rounds >= 2:
                    console.print(f"[yellow]   No progress in 2 rounds, moving to next step[/yellow]")
                    break
            else:
                consecutive_zero_rounds = 0
            
            # Wait between rounds (rate limit reset)
            if pending_batches and round_num < MAX_ROUNDS:
                console.print(f"[yellow]   ⏳ Waiting {ROUND_DELAY}s before Round {round_num + 1}...[/yellow]")
                time.sleep(ROUND_DELAY)
        
        # Step 8: Apply corrections to database
        console.print("\n[bold]Step 7: Applying corrections to database...[/bold]")
        
        for batch_idx, corrections in completed_batches.items():
            if not corrections:
                continue
            
            batch = batches[batch_idx]
            records = batch['records']
            
            for i, correction in enumerate(corrections):
                if i >= len(records):
                    break
                
                record = records[i]
                group_id = record['group_id']
                corrected_name = correction.get('corrected_name')
                confidence = correction.get('confidence', 0.8)
                
                if corrected_name:
                    # SMART VALIDATION: Multi-stage validation using SmartValidator
                    from validation_helpers import SmartValidator
                    
                    original_name = record.get('normalized_college_name', '')
                    state = record.get('normalized_state', '')
                    
                    # Initialize validator if not already done
                    if not hasattr(self, '_smart_validator'):
                        self._smart_validator = SmartValidator(
                            master_db_path=self.master_db_path,
                            api_keys=self.api_keys,
                        )
                    
                    # Run multi-stage validation
                    status, final_confidence, reason = self._smart_validator.validate_correction(
                        original=original_name,
                        corrected=corrected_name,
                        state=state,
                        llm_confidence=confidence,
                    )
                    
                    # Track results
                    if status == 'auto_applied':
                        results['auto_applied'].append(group_id)
                    elif status == 'pending_review':
                        results['pending_review'].append(group_id)
                        console.print(f"[yellow]⚠️ Pending review: {group_id}: '{original_name[:30]}' → '{corrected_name[:30]}' ({final_confidence:.0%})[/yellow]")
                    else:  # rejected
                        results['skipped'].append(group_id)
                        console.print(f"[red]❌ Rejected: {group_id}: '{original_name[:30]}' → '{corrected_name[:30]}' ({reason})[/red]")
                        continue  # Don't save rejected corrections
                    
                    if not self.dry_run:
                        conn = sqlite3.connect(self.queue_db_path, timeout=30)
                        cursor = conn.cursor()
                        cursor.execute("""
                            UPDATE group_matching_queue
                            SET corrected_college_name = ?,
                                correction_confidence = ?,
                                correction_status = ?
                            WHERE group_id = ?
                        """, (corrected_name, final_confidence, status, group_id))
                        conn.commit()
                        conn.close()
                else:
                    results['skipped'].append(group_id)
        
        # Summary
        console.print("\n[bold green]✅ Pipeline Complete![/bold green]")
        table = Table(title="Results Summary")
        table.add_column("Status", style="cyan")
        table.add_column("Count", style="green")
        table.add_row("Auto-applied", str(len(results['auto_applied'])))
        table.add_row("Pending review", str(len(results['pending_review'])))
        table.add_row("Skipped", str(len(results['skipped'])))
        console.print(table)
        
        return {
            'fixed': len(results['auto_applied']),
            'pending': len(results['pending_review']),
            'skipped': len(results['skipped']),
        }
    
    def _get_batch_system_prompt(self) -> str:
        """System prompt for batch processing - OCR FIX ONLY, NO ENTITY MATCHING."""
        return """You are an OCR error fixer. Your ONLY job is to fix words broken by OCR scanning.

⚠️ CRITICAL: You must NEVER change the college identity. ONLY fix broken words.

WHAT TO FIX:
- Words split by extra spaces: "GOVER NMENT" → "GOVERNMENT"
- Split word fragments: "MEDICA L" → "MEDICAL", "COLLEG E" → "COLLEGE"
- OCR character errors: "HOSPIT AL" → "HOSPITAL", "UNIVERSIT Y" → "UNIVERSITY"

WHAT TO PRESERVE (DO NOT CHANGE):
- College name words (e.g., "ATAL BIHARI VAJPAYEE" must stay "ATAL BIHARI VAJPAYEE")
- Location names (e.g., "BILASPUR", "SHIMLA", "RAIGARH")
- Person names (e.g., "SHRI B M PATIL", "DR YASHWANT SINGH")
- Initials like "B M", "S C B", "G M C" - keep as-is

EXAMPLES:
✅ "ATAL BIHARI VAJPAYEE GOVERNM ENT" → "ATAL BIHARI VAJPAYEE GOVERNMENT"
✅ "SHRI B M PATIL MEDICA L COLLEG E" → "SHRI B M PATIL MEDICAL COLLEGE"  
✅ "CHHATT ISGARH INSTITU TE OF ME" → "CHHATTISGARH INSTITUTE OF MEDICAL"
✅ "GOVERNMENT MEDICAL COLLEGE" → "GOVERNMENT MEDICAL COLLEGE" (no change needed)

❌ WRONG: "ATAL BIHARI VAJPAYEE" → "SUNDARLAL PATWA" (different college!)
❌ WRONG: "B M PATIL" → "S R PATIL" (changed person name!)
❌ WRONG: Suggesting a completely different college name

Return JSON array with one object per input:
[
  {"corrected_name": "FIXED NAME WITH MERGED WORDS", "confidence": 0.95},
  {"corrected_name": "ANOTHER FIXED NAME", "confidence": 0.90},
  ...
]

If a name looks correct (no broken words), return it unchanged with confidence 1.0."""
    
    def _build_batch_prompt(self, records: List[Dict], state: str) -> str:
        """Build prompt for a batch of records - OCR FIX ONLY, NO CANDIDATES."""
        prompt_parts = [f"STATE: {state}\n\nFix the broken words in these college names (merge split words only):\n"]
        
        for i, record in enumerate(records, 1):
            broken_name = record['normalized_college_name']
            # NO CANDIDATES - just fix the OCR broken words
            prompt_parts.append(f"\n{i}. {broken_name}")
        
        prompt_parts.append("\n\nReturn JSON array with corrections. ONLY merge split words, keep the college identity unchanged.")
        return "".join(prompt_parts)
    
    def _parse_batch_response(self, content: str, records: List[Dict]) -> List[Dict]:
        """Parse batch response and return list of corrections."""
        try:
            # Extract JSON from response
            json_str = content
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0]
            
            corrections = json.loads(json_str.strip())
            
            if isinstance(corrections, list):
                return corrections
            elif isinstance(corrections, dict):
                return [corrections]
            
            return []
        except Exception as e:
            logger.debug(f"Failed to parse batch response: {e}")
            return []


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fix broken college names using embeddings + LLM')
    parser.add_argument('--db', choices=['counselling', 'seat'], default='counselling',
                       help='Database to process')
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without applying')
    parser.add_argument('--rebuild-embeddings', action='store_true',
                       help='Force rebuild of master embeddings')
    parser.add_argument('--limit', type=int, default=None,
                       help='Limit number of records to process (for testing)')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Show detailed output for each record')
    parser.add_argument('--review', action='store_true',
                       help='Review pending corrections interactively')
    parser.add_argument('--manual', action='store_true',
                       help='Manually enter corrections for uncorrected records')
    
    args = parser.parse_args()
    
    # Determine database path
    if args.db == 'counselling':
        db_path = 'data/sqlite/counselling_data_partitioned.db'
    else:
        db_path = 'data/sqlite/seat_data.db'
    
    # Review pending corrections
    if args.review:
        review_pending_corrections(db_path)
        return
    
    # Manual corrections
    if args.manual:
        manual_corrections(db_path)
        return
    
    # Rebuild embeddings if requested
    if args.rebuild_embeddings:
        builder = MasterEmbeddingBuilder()
        builder.build_embeddings(force_rebuild=True)
        return
    
    # Run pipeline
    pipeline = NameFixerPipeline(
        queue_db_path=db_path,
        dry_run=args.dry_run,
    )
    pipeline.run(limit=args.limit, verbose=args.verbose)


def review_pending_corrections(db_path: str):
    """Interactive review of pending corrections."""
    from rich.prompt import Prompt, Confirm
    from rich.table import Table
    
    console.print(Panel.fit(
        "[bold cyan]📋 REVIEW PENDING CORRECTIONS[/bold cyan]",
        border_style="cyan"
    ))
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get pending records
    cursor.execute("""
        SELECT group_id, normalized_college_name, corrected_college_name, correction_confidence
        FROM group_matching_queue
        WHERE correction_status = 'pending_review'
        ORDER BY correction_confidence DESC
    """)
    pending = cursor.fetchall()
    
    if not pending:
        console.print("[green]✅ No pending corrections to review![/green]")
        conn.close()
        return
    
    console.print(f"\n[yellow]Found {len(pending)} pending corrections[/yellow]\n")
    
    approved = 0
    rejected = 0
    
    for i, (group_id, original, corrected, confidence) in enumerate(pending, 1):
        # Display the correction
        table = Table(title=f"Correction {i}/{len(pending)}", show_header=True)
        table.add_column("Field", style="cyan")
        table.add_column("Value", style="white")
        
        table.add_row("Group ID", str(group_id))
        table.add_row("Original", original)
        table.add_row("Corrected", corrected)
        table.add_row("Confidence", f"{confidence:.1%}")
        
        console.print(table)
        
        # Get user decision
        choice = Prompt.ask(
            "\n[bold]Action[/bold]",
            choices=["a", "r", "s", "q"],
            default="s"
        )
        console.print("[dim](a=approve, r=reject, s=skip, q=quit)[/dim]")
        
        if choice == "a":
            cursor.execute("""
                UPDATE group_matching_queue 
                SET correction_status = 'auto_applied'
                WHERE group_id = ?
            """, (group_id,))
            conn.commit()
            console.print("[green]✅ Approved![/green]\n")
            approved += 1
        elif choice == "r":
            cursor.execute("""
                UPDATE group_matching_queue 
                SET corrected_college_name = NULL, 
                    correction_status = NULL,
                    correction_confidence = NULL
                WHERE group_id = ?
            """, (group_id,))
            conn.commit()
            console.print("[red]❌ Rejected and cleared[/red]\n")
            rejected += 1
        elif choice == "q":
            console.print("[yellow]Exiting review...[/yellow]")
            break
        else:
            console.print("[dim]Skipped[/dim]\n")
    
    conn.close()
    
    # Summary
    console.print(Panel.fit(
        f"[bold]Review Complete[/bold]\n"
        f"Approved: {approved}\n"
        f"Rejected: {rejected}\n"
        f"Remaining: {len(pending) - approved - rejected}",
        border_style="green"
    ))


def manual_corrections(db_path: str):
    """Enhanced manual correction interface with suggestions and navigation."""
    from rich.prompt import Prompt
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
    from rich.align import Align
    
    console.print(Panel.fit(
        "[bold cyan]✏️  ENHANCED MANUAL CORRECTION[/bold cyan]\n"
        "Fix broken college names with smart suggestions",
        border_style="cyan"
    ))
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get records that need correction - ONLY pending review or skipped from pipeline
    # This ensures we only show the 121+3 records from pipeline, not all 4692 broken names
    cursor.execute("""
        SELECT group_id, normalized_college_name, normalized_state, 
               normalized_address, sample_course_type, record_count
        FROM group_matching_queue
        WHERE (
            -- Records marked as pending review or skipped by the pipeline
            correction_status IN ('pending_review', 'skipped')
            -- OR records with no status but also no match (fallback for legacy)
            OR (
                correction_status IS NULL 
                AND matched_college_id IS NULL
                AND corrected_college_name IS NULL
                AND (
                    -- Question marks indicate encoding issues
                    normalized_college_name LIKE '%?%' 
                    -- Literal "QUESTION" text
                    OR normalized_college_name LIKE '%QUESTION%'
                    -- Multiple consecutive spaces (encoding issues)  
                    OR normalized_college_name LIKE '%  %'
                )
            )
        )
        ORDER BY 
            CASE 
                WHEN correction_status = 'pending_review' THEN 1
                WHEN correction_status = 'skipped' THEN 2
                ELSE 3
            END,
            record_count DESC
    """)
    uncorrected = cursor.fetchall()
    
    if not uncorrected:
        console.print("[green]✅ No uncorrected records found![/green]")
        conn.close()
        return
    
    # Load master data for suggestions
    master_conn = sqlite3.connect('data/sqlite/master_data.db')
    master_cursor = master_conn.cursor()
    master_cursor.execute("""
        SELECT id, name, state, address FROM colleges
        UNION ALL
        SELECT id, name, state, address FROM dental_colleges
    """)
    master_colleges = master_cursor.fetchall()
    master_conn.close()
    
    # Build search index
    master_lookup = {row[1].upper(): row for row in master_colleges}  # name -> (id, name, state, addr)
    master_names = list(master_lookup.keys())
    
    console.print(f"\n[yellow]Found {len(uncorrected)} uncorrected records[/yellow]")
    console.print(f"[dim]Loaded {len(master_names)} master colleges for suggestions[/dim]")
    
    # Navigation help
    console.print("\n[bold]Commands:[/bold]")
    console.print("  [cyan]1-5[/cyan]    Select suggestion")
    console.print("  [cyan]Enter[/cyan]  Skip to next")
    console.print("  [cyan]b[/cyan]      Go back")
    console.print("  [cyan]j N[/cyan]    Jump to record N")
    console.print("  [cyan]s TEXT[/cyan] Search master data")
    console.print("  [cyan]i[/cyan]      Mark as unmatchable (ignore)")
    console.print("  [cyan]q[/cyan]      Quit\n")
    
    corrected_count = 0
    ignored_count = 0
    auto_applied_count = 0
    current_idx = 0
    
    while 0 <= current_idx < len(uncorrected):
        group_id, original, state, address, course_type, record_count = uncorrected[current_idx]
        
        # Get suggestions using fuzzy matching
        from rapidfuzz import fuzz, process
        
        # Filter by state first if available
        if state:
            state_filtered = [name for name in master_names 
                            if master_lookup[name][2] and state.upper() in master_lookup[name][2].upper()]
            search_pool = state_filtered if state_filtered else master_names
        else:
            search_pool = master_names
        
        # Find similar names using WEIGHTED SCORING
        # token_set_ratio alone gives high scores to short generic names
        # This weighted approach prioritizes unique identifier words
        def weighted_score(query: str, candidate: str, source_course_type: str = None) -> float:
            """Calculate weighted similarity score prioritizing unique words.
            
            Args:
                query: The source college name being searched
                candidate: Master college name being compared
                source_course_type: Course type from source data (medical/dental/etc)
            """
            # Multiple scoring approaches
            ratio = fuzz.ratio(query, candidate)  # Exact character match
            token_sort = fuzz.token_sort_ratio(query, candidate)  # Handles word reordering
            partial = fuzz.partial_ratio(query, candidate)  # Substring matching
            
            # EXPANDED common words list - excludes generic medical terms
            common_words = {
                'MEDICAL', 'COLLEGE', 'HOSPITAL', 'UNIVERSITY', 'INSTITUTE', 
                'AND', 'OF', 'THE', 'SCIENCES', 'SCIENCE', 'HEALTH', 'CENTRE', 'CENTER',
                'RESEARCH', 'GENERAL', 'DISTRICT', 'GOVERNMENT', 'GOVT', 'STATE',
                'PRIVATE', 'PVT', 'TEACHING', 'TRAINING', 'EDUCATION', 'POST',
                'GRADUATE', 'POSTGRADUATE', 'SUPER', 'SPECIALTY', 'MULTI',
                'DENTAL', 'FOR', 'IN', 'AT', 'WITH', 'CHARITABLE', 'TRUST',
            }
            query_words = set(query.upper().split()) - common_words
            candidate_words = set(candidate.upper().split()) - common_words
            
            # Bonus for matching unique words (the ACTUAL college name)
            if query_words and candidate_words:
                unique_overlap = len(query_words & candidate_words) / max(len(query_words), len(candidate_words))
                unique_bonus = unique_overlap * 40  # Up to 40 point bonus for unique name match
            else:
                unique_bonus = 0
            
            # Use ratio (not token_set) as primary scorer to avoid inflated scores
            # token_set gives 100% when all words in shorter match longer - too generous
            base_score = (ratio * 0.5) + (token_sort * 0.3) + (partial * 0.2)
            
            # Apply unique word bonus but cap at 100
            final_score = min(100, base_score + unique_bonus)
            
            # COURSE TYPE PENALTY: Break ties between medical vs dental colleges
            # If source is 'medical' but candidate contains 'DENTAL', penalize
            # If source is 'dental' but candidate doesn't contain 'DENTAL', penalize
            course_penalty = 0
            if source_course_type:
                source_type_upper = source_course_type.upper()
                candidate_upper = candidate.upper()
                
                # Check for medical source matching dental college (or vice versa)
                if 'MEDICAL' in source_type_upper or 'MBBS' in source_type_upper or 'MD' in source_type_upper:
                    # Source is medical - penalize dental colleges
                    if 'DENTAL' in candidate_upper and 'MEDICAL' not in candidate_upper:
                        course_penalty = 15  # Significant penalty for wrong college type
                elif 'DENTAL' in source_type_upper or 'BDS' in source_type_upper or 'MDS' in source_type_upper:
                    # Source is dental - penalize non-dental colleges
                    if 'DENTAL' not in candidate_upper:
                        course_penalty = 15  # Significant penalty for wrong college type
            
            return max(0, final_score - course_penalty)
        
        # Get candidates with weighted scores
        scored_candidates = []
        for name in search_pool:
            score = weighted_score(original.upper() if original else "", name, course_type)
            scored_candidates.append((name, score))
        
        # Sort by score descending and take top 5
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        suggestions = [(name, score, None) for name, score in scored_candidates[:5]]
        
        # AUTO-APPLY: If top match is >95%, validate and apply automatically
        if suggestions and suggestions[0][1] >= 95:
            top_name, top_score = suggestions[0][0], suggestions[0][1]
            master_info = master_lookup.get(top_name)
            if master_info:
                # CRITICAL: Use SmartValidator to check for unique identifier mismatch
                from validation_helpers import SmartValidator
                
                # Create validator instance if not exists (use function-level cache)
                if '_smart_validator' not in dir():
                    _smart_validator = SmartValidator()
                
                # Validate the correction
                char_result = _smart_validator._char_similarity(original, master_info[1])
                
                # Only auto-apply if char similarity check passes (no unique_id_mismatch)
                if char_result.get('reason') != 'unique_id_mismatch' and char_result.get('score', 0) >= 0.5:
                    cursor.execute("""
                        UPDATE group_matching_queue 
                        SET corrected_college_name = ?,
                            correction_status = 'auto_manual',
                            correction_confidence = ?
                        WHERE group_id = ?
                    """, (master_info[1].upper(), top_score / 100.0, group_id))
                    conn.commit()
                    console.print(f"[green]✓ Auto-applied ({top_score:.0f}%): {original[:40]}... → {master_info[1][:40]}[/green]")
                    auto_applied_count += 1
                    current_idx += 1
                    continue
                else:
                    # Failed validation - show for manual review
                    console.print(f"[yellow]⚠️ Validation failed ({char_result.get('reason')}), showing for review: {original[:40]}...[/yellow]")
        
        # Build display
        console.print("\n" + "═" * 80)
        
        # Header with navigation info
        header = Text()
        header.append(f"Record {current_idx + 1}/{len(uncorrected)}", style="bold cyan")
        header.append(f"  │  Group ID: {group_id}", style="dim")
        header.append(f"  │  ", style="dim")
        header.append(f"{record_count} records affected", style="yellow bold")
        console.print(Panel(header, border_style="blue"))
        
        # Full broken name (NO TRUNCATION)
        console.print(f"\n[bold red]BROKEN NAME:[/bold red]")
        console.print(f"  {original}")
        
        # Context
        console.print(f"\n[bold]CONTEXT:[/bold]")
        console.print(f"  State:       {state or 'Unknown'}")
        console.print(f"  Address:     {address or 'None'}")
        console.print(f"  Course Type: {course_type or 'Unknown'}")
        
        # Suggestions
        console.print(f"\n[bold green]SUGGESTIONS FROM MASTER DATA:[/bold green]")
        if suggestions:
            for idx, (match_name, score, _) in enumerate(suggestions, 1):
                master_info = master_lookup.get(match_name)
                if master_info:
                    master_id, name, m_state, m_addr = master_info
                    score_color = "green" if score >= 80 else "yellow" if score >= 60 else "red"
                    console.print(f"  [{idx}] [{score_color}]{score}%[/{score_color}] {name}")
                    console.print(f"      [dim]{m_state} | {(m_addr or '')[:60]}[/dim]")
        else:
            console.print("  [dim]No similar names found[/dim]")
        
        console.print(f"\n  [6] Enter custom name")
        console.print("═" * 80)
        
        # Get user input
        choice = Prompt.ask("\n[bold]Choice[/bold]", default="").strip()
        
        # Handle commands
        if choice.lower() == 'q':
            console.print("[yellow]Exiting...[/yellow]")
            break
        
        elif choice.lower() == 'b':
            if current_idx > 0:
                current_idx -= 1
                console.print("[cyan]← Going back[/cyan]")
            else:
                console.print("[yellow]Already at first record[/yellow]")
            continue
        
        elif choice.lower().startswith('j '):
            try:
                jump_to = int(choice[2:]) - 1
                if 0 <= jump_to < len(uncorrected):
                    current_idx = jump_to
                    console.print(f"[cyan]Jumping to record {jump_to + 1}[/cyan]")
                else:
                    console.print(f"[red]Invalid: must be 1-{len(uncorrected)}[/red]")
            except ValueError:
                console.print("[red]Usage: j NUMBER[/red]")
            continue
        
        elif choice.lower().startswith('s '):
            # Search master data
            search_term = choice[2:].strip().upper()
            search_results = process.extract(search_term, master_names, scorer=fuzz.token_set_ratio, limit=10)
            console.print(f"\n[bold]Search results for '{search_term}':[/bold]")
            for idx, (name, score, _) in enumerate(search_results, 1):
                master_info = master_lookup.get(name)
                if master_info:
                    console.print(f"  [{idx:2}] {score}% - {master_info[1]} ({master_info[2]})")
            console.print("\n[dim]Enter the number to select, or any other command[/dim]")
            continue
        
        elif choice.lower() == 'i':
            # Mark as unmatchable
            cursor.execute("""
                UPDATE group_matching_queue 
                SET correction_status = 'unmatchable'
                WHERE group_id = ?
            """, (group_id,))
            conn.commit()
            console.print("[yellow]Marked as unmatchable[/yellow]")
            ignored_count += 1
            current_idx += 1
            continue
        
        elif choice == '' or choice.lower() == 's':
            # Skip
            console.print("[dim]Skipped[/dim]")
            current_idx += 1
            continue
        
        elif choice == '6':
            # Custom entry
            custom = Prompt.ask("[bold]Enter correct name[/bold]", default="")
            if custom.strip():
                cursor.execute("""
                    UPDATE group_matching_queue 
                    SET corrected_college_name = ?,
                        correction_status = 'manual',
                        correction_confidence = 1.0
                    WHERE group_id = ?
                """, (custom.strip().upper(), group_id))
                conn.commit()
                console.print(f"[green]✅ Saved: {custom.strip().upper()}[/green]")
                corrected_count += 1
            current_idx += 1
            continue
        
        elif choice.isdigit() and 1 <= int(choice) <= len(suggestions):
            # Select suggestion
            selected_idx = int(choice) - 1
            selected_name = suggestions[selected_idx][0]
            master_info = master_lookup.get(selected_name)
            
            if master_info:
                cursor.execute("""
                    UPDATE group_matching_queue 
                    SET corrected_college_name = ?,
                        correction_status = 'manual',
                        correction_confidence = 1.0
                    WHERE group_id = ?
                """, (master_info[1].upper(), group_id))
                conn.commit()
                console.print(f"[green]✅ Saved: {master_info[1]}[/green]")
                corrected_count += 1
            current_idx += 1
            continue
        
        else:
            # Treat as custom correction
            if choice.strip():
                cursor.execute("""
                    UPDATE group_matching_queue 
                    SET corrected_college_name = ?,
                        correction_status = 'manual',
                        correction_confidence = 1.0
                    WHERE group_id = ?
                """, (choice.strip().upper(), group_id))
                conn.commit()
                console.print(f"[green]✅ Saved: {choice.strip().upper()}[/green]")
                corrected_count += 1
            current_idx += 1
    
    conn.close()
    
    # Summary
    console.print(Panel.fit(
        f"[bold]Manual Entry Complete[/bold]\n"
        f"🤖 Auto-applied (>95%): {auto_applied_count}\n"
        f"✅ Manually corrected: {corrected_count}\n"
        f"🚫 Ignored: {ignored_count}\n"
        f"⏭️  Skipped: {len(uncorrected) - corrected_count - ignored_count - auto_applied_count}",
        border_style="green"
    ))


if __name__ == '__main__':
    main()
