#!/usr/bin/env python3
"""
Tinker Agentic Edition - ADVANCED
Extends tinker3.py with full AgenticNormalizer capabilities including:
- Standard courses context for LLM
- Wave-based batch processing
- Model-specific batch sizes
- DB-level grouping/deduplication
- Council voting / Multi-model verification
- Invalid client tracking
- Exponential backoff for rate limits
- Detailed statistics tracking
- Fuzzy matching fallback
- Error handling with logging
"""
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import threading
import time
import sys
import os
import json
import queue
import logging
import difflib  # For fuzzy matching
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple, Any, Union, Callable
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
from enum import Enum

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)


# Add course_standardizer to path
sys.path.append(os.path.abspath("course_standardizer"))
sys.path.append(os.getcwd())

try:
    import tinker3
    from tinker3 import CourseCleanerApp
except ImportError:
    print("Error: tinker3.py not found in current directory.")
    sys.exit(1)

try:
    from openrouter_client import OpenRouterClient
except ImportError:
    try:
        from course_standardizer.openrouter_client import OpenRouterClient
    except ImportError:
        print("Warning: OpenRouterClient not found, using fallback.")
        OpenRouterClient = None

# ═══════════════════════════════════════════════════════════════════════════
# MODEL CONFIGURATION (from agentic_matcher.py / agentic_verifier.py)
# ═══════════════════════════════════════════════════════════════════════════
MODEL_CONFIG = {
    # Priority 0: BEST REASONING - Primary models
    "tngtech/deepseek-r1t-chimera:free": {
        "max_tokens": 16384, "batch_size": 10, "timeout": 120, "priority": 0
    },
    "openai/gpt-oss-120b:free": {
        "max_tokens": 8192, "batch_size": 15, "timeout": 120, "priority": 0
    },
    "qwen/qwen3-235b-a22b:free": {
        "max_tokens": 8000, "batch_size": 6, "timeout": 120, "priority": 0
    },
    # Priority 1: QUALITY - Fallback tier 1
    "google/gemini-2.0-flash-exp:free": {
        "max_tokens": 8000, "batch_size": 10, "timeout": 90, "priority": 1
    },
    "meta-llama/llama-3.3-70b-instruct:free": {
        "max_tokens": 8192, "batch_size": 15, "timeout": 90, "priority": 1
    },
    # Priority 2: CAPACITY - Fallback tier 2
    "qwen/qwen3-coder:free": {
        "max_tokens": 65536, "batch_size": 12, "timeout": 120, "priority": 2
    },
    "amazon/nova-2-lite-v1:free": {
        "max_tokens": 65536, "batch_size": 15, "timeout": 120, "priority": 2
    },
    "mistralai/mistral-small-3.1-24b-instruct:free": {
        "max_tokens": 16384, "batch_size": 8, "timeout": 90, "priority": 2
    },
}

# Sorted by priority
WORKER_MODELS = sorted(MODEL_CONFIG.keys(), key=lambda m: MODEL_CONFIG[m]["priority"])


class NormalizationVerdict(Enum):
    """Verdict from council voting."""
    ACCEPT = "accept"
    REJECT = "reject"
    UNCERTAIN = "uncertain"


@dataclass
class ModelVote:
    """A vote from a single model."""
    model_name: str
    normalized: str
    confidence: float
    reason: str
    response_time: float


@dataclass
class NormalizationResult:
    """Result with council votes."""
    original: str
    normalized: str
    confidence: float
    match_type: str
    reason: str
    votes: List[ModelVote] = field(default_factory=list)
    vote_agreement: float = 0.0


@dataclass
class AgenticStats:
    """Detailed statistics tracking."""
    total_terms: int = 0
    unique_terms: int = 0
    cached_hits: int = 0
    exact_matches: int = 0
    llm_normalizations: int = 0
    failed: int = 0
    model_calls: int = 0
    model_failures: int = 0
    retries: int = 0
    council_votes: int = 0
    rate_limit_delays: float = 0.0
    invalid_clients: int = 0
    
    def summary(self) -> str:
        return (
            f"📊 Stats: {self.total_terms} terms ({self.unique_terms} unique)\n"
            f"✅ Cached: {self.cached_hits} | Exact: {self.exact_matches} | LLM: {self.llm_normalizations}\n"
            f"❌ Failed: {self.failed} | Retries: {self.retries}\n"
            f"🤖 API Calls: {self.model_calls} | Failures: {self.model_failures}\n"
            f"⏱️ Rate Limit Delays: {self.rate_limit_delays:.1f}s | Invalid Clients: {self.invalid_clients}"
        )


class AgenticApp(CourseCleanerApp):
    """Enhanced Course Standardizer with advanced agentic features."""
    
    SYSTEM_PROMPT = """You are a STRICT course name matching specialist for medical/dental education.

CRITICAL RULE: You must ONLY return course names that EXACTLY EXIST in the provided STANDARDS LIST.
⚠️ DO NOT invent, modify, or create new course names. ⚠️
⚠️ DO NOT combine or shorten course names. ⚠️

Your task: Match input courses to the EXACT course from the STANDARDS LIST provided.

MATCHING RULES:
1. OUTPUT MUST BE A VERBATIM COPY from the STANDARDS LIST - no modifications allowed
2. If input is "DNB- DIPLOMA OTORHINOLARYNGOLOGY", find the exact match in standards (e.g., "DNB- DIPLOMA ENT")
3. PRESERVE DEGREE LEVELS: If input has "DIPLOMA", output MUST have "DIPLOMA"
4. If no exact or near-exact match exists in standards, set confidence < 0.3
5. NEVER output a course name that is not in the provided standards list

OUTPUT FORMAT (JSON array):
[
  {"original": "input course", "normalized": "EXACT COPY FROM STANDARDS LIST", "confidence": 0.95, "reason": "Matched to standard: [standard name]"},
  ...
]

CONFIDENCE GUIDE:
- 0.95+: Exact match from standards list
- 0.80-0.94: Near-exact match (spelling variation only)
- 0.50-0.79: Partial match with same degree level
- < 0.50: No confident match found - DO NOT GUESS

IMPORTANT REMINDERS:
- Double-check: Is your normalized output IN the standards list? If not, DON'T use it.
- Always return ALL inputs in your response
- Prefer returning low confidence over making up a course name"""

    def __init__(self, root):
        self.stats = AgenticStats()
        self.clients: List[OpenRouterClient] = []
        self.invalid_clients: Set[int] = set()
        self.api_keys: List[str] = []
        
        # LLM Progress UI elements
        self.llm_progress_frame = None
        self.llm_progress_bar = None
        self.llm_status_label = None
        
        # LLM Cache for persistence (survives data refresh)
        self.llm_cache_file = os.path.join(os.path.dirname(__file__), ".llm_normalize_cache.json")
        self.llm_cache: Dict[str, Dict] = {}
        self._load_llm_cache()
        
        # ===== GOD-LEVEL AI COMPONENTS =====
        
        # Pattern Learning Engine
        self.learned_patterns: Dict[str, str] = {}  # prefix -> replacement
        self.pattern_file = os.path.join(os.path.dirname(__file__), ".learned_patterns.json")
        self._load_patterns()
        
        # Processing pipeline log for explainability
        self.explanation_log: List[Dict] = []
        
        # Consistency tracking
        self.consistency_map: Dict[str, Set[str]] = {}  # original -> set of normalizations
        
        # ===== ADVANCED FEATURES =====
        
        # Multi-Model Ensemble: Track accuracy per model
        self.model_accuracy: Dict[str, Dict] = {}  # model -> {correct, total, avg_conf}
        self.model_accuracy_file = os.path.join(os.path.dirname(__file__), ".model_accuracy.json")
        self._load_model_accuracy()
        
        # Adaptive Confidence Thresholds
        self.adaptive_thresholds: Dict[str, float] = {
            "auto_match": 0.80,  # Above this = auto-accept
            "possible": 0.50,    # Above this = possible match
            "reject": 0.30       # Below this = reject
        }
        
        # Agentic Reasoning: Component parsers
        self.degree_prefixes = ["MD", "MS", "DNB", "DM", "MCH", "MBBS", "BDS", "DIPLOMA", "PG", "UG"]
        self.specialty_keywords = []  # Will be populated from standards
        
        # Predictive Pre-Cache flag
        self.predictive_cache_enabled = True
        
        # ===== 300K-SCALE OPTIMIZATIONS =====
        
        # Pagination
        self.page_size = 1000  # Rows per page
        self.current_page = 0
        self.total_pages = 0
        self.total_records = 0
        
        # Chunked Processing
        self.chunk_size = 10000  # Records per chunk
        self.batch_size_llm = 50  # Terms per LLM call (was 10)
        
        # Progress Persistence / Resumable
        self.progress_file = os.path.join(os.path.dirname(__file__), ".processing_progress.json")
        self.processing_state = {
            "current_chunk": 0,
            "processed_terms": [],
            "pending_terms": [],
            "is_running": False,
            "last_updated": None
        }
        self._load_processing_state()
        
        # ===== 🏆 LEGEND MODE FEATURES =====
        
        # Self-Improving AI: Track corrections to improve prompts
        self.correction_history: List[Dict] = []
        self.correction_file = os.path.join(os.path.dirname(__file__), ".correction_history.json")
        self._load_correction_history()
        
        # Smart Prioritization: Score-based processing order
        self.priority_weights = {
            "high_frequency": 2.0,  # Items appearing many times
            "low_confidence": 1.5,  # Items with low current scores
            "user_flagged": 3.0     # Items user manually flagged
        }
        
        # Multi-Strategy Pipeline
        self.strategies = ["cache", "pattern", "llm", "fuzzy", "flag"]
        self.current_strategy_idx = 0
        
        # ETA Calculator
        self.processing_start_time = None
        self.items_per_second = 0.0
        self.eta_samples: List[float] = []
        
        # Auto-Parameter Tuning
        self.auto_tune_enabled = True
        self.tuning_history: List[Dict] = []
        
        # Stats label reference
        self.llm_stats_label = None
        
        super().__init__(root)
        
        # Get db_path from parent (set by setup_database) or create file-based if :memory:
        if not hasattr(self, 'db_path') or self.db_path == ":memory:":
            self.db_path = os.path.join(os.path.dirname(__file__), "temp_course_data.db")
            # Export in-memory to file for thread access
            if hasattr(self, 'conn') and self.conn:
                import sqlite3
                file_conn = sqlite3.connect(self.db_path)
                self.conn.backup(file_conn)
                file_conn.close()
                print(f"📁 Exported in-memory DB to {self.db_path}")
        
        self.root.title("Course Standardizer Workbench v7.0 (Agentic Edition 🧠)")
        
        # Inject agentic button and progress section
        self._add_agentic_button()
        self._add_llm_progress_section()
        
        # Hook into error map learning
        self._hook_error_map_learning()
        
        # Update stats display
        self._update_stats_display()
        
    def _add_agentic_button(self):
        """Add the Agentic Batch button to the actions frame"""
        button_added = False
        
        for child in self.root.winfo_children():
            if isinstance(child, ttk.Frame):
                for notebook_child in child.winfo_children():
                    if isinstance(notebook_child, ttk.Notebook):
                        main_tab = notebook_child.winfo_children()[0]
                        for tab_child in main_tab.winfo_children():
                            if isinstance(tab_child, ttk.Frame):
                                for frame_child in tab_child.winfo_children():
                                    if isinstance(frame_child, ttk.Labelframe):
                                        frame_text = str(frame_child.cget("text"))
                                        if "Actions" in frame_text:
                                            ttk.Button(
                                                frame_child, 
                                                text="🧠 Agentic Batch", 
                                                command=self.run_agentic_batch
                                            ).pack(side=tk.LEFT, padx=5, pady=5)
                                            print("✅ Added Agentic Batch button to Actions frame")
                                            button_added = True
                                            return
        
        if not button_added:
            # Fallback: Add to menu bar
            print("⚠️ Could not find Actions frame, adding to menu")
            self._add_agentic_menu()
    
    def _add_agentic_menu(self):
        """Fallback: Add Agentic option to menu bar."""
        # Find or create menu bar
        menubar = None
        for child in self.root.winfo_children():
            if isinstance(child, tk.Menu):
                menubar = child
                break
        
        if not menubar:
            menubar = tk.Menu(self.root)
            self.root.config(menu=menubar)
        
        # Add Agentic menu
        agentic_menu = tk.Menu(menubar, tearoff=0)
        agentic_menu.add_command(label="🧠 Run Agentic Batch", command=self.run_agentic_batch)
        menubar.add_cascade(label="🧠 Agentic", menu=agentic_menu)
        print("✅ Added Agentic menu to menu bar")

    def _add_llm_progress_section(self):
        """Add LLM Progress section near Tokenization Rules."""
        # Find the right panel (where Tokenization Rules is)
        for child in self.root.winfo_children():
            if isinstance(child, ttk.Frame):  # main_frame
                for notebook_child in child.winfo_children():
                    if isinstance(notebook_child, ttk.Notebook):
                        main_tab = notebook_child.winfo_children()[0]
                        for tab_child in main_tab.winfo_children():
                            if isinstance(tab_child, ttk.Frame):
                                for frame_child in tab_child.winfo_children():
                                    if isinstance(frame_child, ttk.Frame):
                                        # Look for the right panel
                                        for subframe in frame_child.winfo_children():
                                            if isinstance(subframe, ttk.Labelframe):
                                                frame_text = str(subframe.cget("text"))
                                                if "Tokenization" in frame_text or "Rules" in frame_text:
                                                    # Add our progress section below it
                                                    parent = subframe.master
                                                    self._create_llm_progress_frame(parent)
                                                    return
        
        # Fallback: Add to root if not found
        print("⚠️ Could not find Tokenization Rules, adding LLM progress to root")
        self._create_llm_progress_frame(self.root)
    
    def _create_llm_progress_frame(self, parent):
        """Create the LLM progress frame with progress bar and status."""
        self.llm_progress_frame = ttk.LabelFrame(parent, text="🧠 LLM Processing")
        self.llm_progress_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Status label
        self.llm_status_label = ttk.Label(
            self.llm_progress_frame, 
            text=f"Ready ({len(self.llm_cache)} cached normalizations)",
            font=("TkDefaultFont", 9)
        )
        self.llm_status_label.pack(fill=tk.X, padx=5, pady=2)
        
        # Progress bar
        self.llm_progress_bar = ttk.Progressbar(
            self.llm_progress_frame, 
            mode="determinate",
            length=200
        )
        self.llm_progress_bar.pack(fill=tk.X, padx=5, pady=5)
        
        # Buttons frame
        btn_frame = ttk.Frame(self.llm_progress_frame)
        btn_frame.pack(fill=tk.X, padx=5, pady=2)
        
        # Reapply Cache button
        ttk.Button(
            btn_frame,
            text="🔄 Reapply",
            command=self._do_reapply_cache
        ).pack(side=tk.LEFT, padx=2)
        
        # Smart Retry button
        ttk.Button(
            btn_frame,
            text="🔁 Retry",
            command=self.run_smart_retry
        ).pack(side=tk.LEFT, padx=2)
        
        # Clear Cache button
        ttk.Button(
            btn_frame,
            text="🗑️",
            command=self._do_clear_cache,
            width=3
        ).pack(side=tk.LEFT, padx=2)
        
        # 🚀 UNIFIED SMART PROCESS button
        ttk.Button(
            btn_frame,
            text="🚀 PROCESS",
            command=self.run_smart_process
        ).pack(side=tk.LEFT, padx=5)
        
        # ⏸️ Pause button
        ttk.Button(
            btn_frame,
            text="⏸️",
            command=self.pause_processing,
            width=3
        ).pack(side=tk.LEFT, padx=2)
        
        # 📤📥 Export/Import in same row
        ttk.Button(btn_frame, text="📤", width=3,
                   command=self.export_learning).pack(side=tk.LEFT, padx=1)
        ttk.Button(btn_frame, text="📥", width=3,
                   command=self.import_learning).pack(side=tk.LEFT, padx=1)
        
        # 📋 Review, 📊 Details, 🔍 Verify buttons
        ttk.Button(btn_frame, text="📋", width=3,
                   command=self.show_batch_review).pack(side=tk.LEFT, padx=1)
        ttk.Button(btn_frame, text="📊", width=3,
                   command=self.show_progress_details).pack(side=tk.LEFT, padx=1)
        ttk.Button(btn_frame, text="🔍", width=3,
                   command=self.run_strict_verification).pack(side=tk.LEFT, padx=1)
        
        # Stats frame
        stats_frame = ttk.Frame(self.llm_progress_frame)
        stats_frame.pack(fill=tk.X, padx=5, pady=2)
        
        self.llm_stats_label = ttk.Label(
            stats_frame,
            text="📊 Cached: 0 | Auto: 0 | Possible: 0",
            font=("TkDefaultFont", 8)
        )
        self.llm_stats_label.pack(side=tk.LEFT)
        
        # Pagination frame
        page_frame = ttk.Frame(self.llm_progress_frame)
        page_frame.pack(fill=tk.X, padx=5, pady=2)
        
        ttk.Button(page_frame, text="◀◀", width=3, 
                   command=lambda: self._go_to_page(0)).pack(side=tk.LEFT)
        ttk.Button(page_frame, text="◀", width=3, 
                   command=lambda: self._go_to_page(self.current_page - 1)).pack(side=tk.LEFT)
        
        self.pagination_label = ttk.Label(page_frame, text="Page 1/1 (0 records)", 
                                          font=("TkDefaultFont", 8))
        self.pagination_label.pack(side=tk.LEFT, padx=10)
        
        ttk.Button(page_frame, text="▶", width=3, 
                   command=lambda: self._go_to_page(self.current_page + 1)).pack(side=tk.LEFT)
        ttk.Button(page_frame, text="▶▶", width=3, 
                   command=lambda: self._go_to_page(self.total_pages - 1)).pack(side=tk.LEFT)
        
        print("✅ Added LLM Progress section to GUI")

    def _do_reapply_cache(self):
        """Reapply cached normalizations to current data."""
        if not self.llm_cache:
            messagebox.showinfo("Cache Empty", "No cached normalizations to apply.")
            return
        
        applied = self.reapply_llm_cache()
        if self.llm_status_label:
            self.llm_status_label.configure(text=f"✅ Reapplied {applied} cached normalizations")
        self.refresh_tree()
        messagebox.showinfo("Cache Applied", f"Reapplied {applied} cached normalizations to current data.")
    
    def _do_clear_cache(self):
        """Clear the LLM normalization cache."""
        if messagebox.askyesno("Clear Cache", f"Delete {len(self.llm_cache)} cached normalizations?"):
            self.llm_cache = {}
            if os.path.exists(self.llm_cache_file):
                os.remove(self.llm_cache_file)
            if self.llm_status_label:
                self.llm_status_label.configure(text="Cache cleared")
            self._update_stats_display()
            messagebox.showinfo("Cache Cleared", "LLM cache has been cleared.")
    
    def _update_stats_display(self):
        """Update the real-time stats display."""
        if not self.llm_stats_label:
            return
        
        cached = len(self.llm_cache)
        
        # Get DB stats if available
        auto_count = 0
        possible_count = 0
        unmatched_count = 0
        
        if hasattr(self, 'conn') and self.conn:
            try:
                cursor = self.conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE score >= 80")
                auto_count = cursor.fetchone()[0] or 0
                cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE score >= 50 AND score < 80")
                possible_count = cursor.fetchone()[0] or 0
                cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE score < 50")
                unmatched_count = cursor.fetchone()[0] or 0
            except:
                pass
        
        self.llm_stats_label.configure(
            text=f"📊 Cached: {cached} | Auto: {auto_count} | Possible: {possible_count} | Low: {unmatched_count}"
        )

    def _load_llm_cache(self):
        """Load cached LLM normalizations from file."""
        try:
            if os.path.exists(self.llm_cache_file):
                with open(self.llm_cache_file, 'r') as f:
                    self.llm_cache = json.load(f)
                print(f"✅ Loaded {len(self.llm_cache)} cached LLM normalizations")
        except Exception as e:
            print(f"⚠️ Could not load LLM cache: {e}")
            self.llm_cache = {}
    
    def _save_llm_cache(self):
        """Save LLM normalizations to file."""
        try:
            with open(self.llm_cache_file, 'w') as f:
                json.dump(self.llm_cache, f, indent=2)
            print(f"✅ Saved {len(self.llm_cache)} LLM normalizations to cache")
        except Exception as e:
            print(f"⚠️ Could not save LLM cache: {e}")
    
    def _cache_normalization(self, original: str, normalized: str, confidence: float):
        """Cache a normalization result."""
        key = original.upper().strip()
        self.llm_cache[key] = {
            "normalized": normalized,
            "confidence": confidence,
            "timestamp": time.time()
        }
    
    def clean_invalid_cache(self):
        """Remove cache entries that don't match any standard course."""
        if not self.llm_cache:
            messagebox.showinfo("Cache Empty", "No cache entries to clean.")
            return
        
        standards = self._get_standards_set() if hasattr(self, '_get_standards_set') else set()
        if not standards:
            messagebox.showwarning("No Standards", "No standards loaded to validate against.")
            return
        
        invalid_keys = []
        for key, data in self.llm_cache.items():
            normalized = data.get("normalized", "").upper().strip()
            if normalized and normalized not in standards:
                invalid_keys.append(key)
        
        if not invalid_keys:
            messagebox.showinfo("Cache Valid", "All cache entries match standards!")
            return
        
        if messagebox.askyesno("Clean Invalid Cache",
            f"Found {len(invalid_keys)} cache entries that don't match standards.\n\n"
            "Remove them?"):
            for key in invalid_keys:
                del self.llm_cache[key]
            self._save_llm_cache()
            logger.info(f"🧹 Cleaned {len(invalid_keys)} invalid cache entries")
            messagebox.showinfo("Cache Cleaned", f"Removed {len(invalid_keys)} invalid entries.")
    
    def _sync_db_to_file(self):
        """Sync in-memory database to file for thread-safe access."""
        if not hasattr(self, 'conn') or not self.conn:
            return
        
        import sqlite3
        
        # Set up file-based path if needed
        if not hasattr(self, 'db_path') or self.db_path == ":memory:":
            self.db_path = os.path.join(os.path.dirname(__file__), "temp_course_data.db")
        
        try:
            # Export current in-memory database to file
            file_conn = sqlite3.connect(self.db_path)
            self.conn.backup(file_conn)
            file_conn.close()
            logger.info(f"📁 Synced DB to {self.db_path}")
        except Exception as e:
            logger.error(f"DB sync error: {e}")
    
    def _sync_file_to_db(self):
        """Sync file database back to main connection."""
        if not hasattr(self, 'conn') or not self.conn:
            return
        if not hasattr(self, 'db_path') or self.db_path == ":memory:":
            return
        
        import sqlite3
        
        try:
            file_conn = sqlite3.connect(self.db_path)
            file_conn.backup(self.conn)
            file_conn.close()
            logger.info(f"📁 Synced file back to main DB")
        except Exception as e:
            logger.error(f"DB sync back error: {e}")
    
    def reapply_llm_cache(self):
        """Reapply cached LLM normalizations to current data after refresh."""
        if not self.llm_cache or not hasattr(self, 'conn') or not self.conn:
            return 0
        
        applied = 0
        cursor = self.conn.cursor()
        
        # Get all records
        cursor.execute("SELECT id, original FROM processed_courses")
        for row in cursor.fetchall():
            row_id, original = row
            key = original.upper().strip() if original else ""
            
            if key in self.llm_cache:
                cached = self.llm_cache[key]
                cursor.execute("""
                    UPDATE processed_courses 
                    SET suggested = ?, score = ?, status = ?, final = ?
                    WHERE id = ?
                """, (
                    cached["normalized"],
                    int(cached["confidence"] * 100),
                    "Auto-Matched (Cached)" if cached["confidence"] > 0.8 else "Possible Match",
                    cached["normalized"] if cached["confidence"] > 0.9 else "",
                    row_id
                ))
                applied += 1
        
        self.conn.commit()
        print(f"✅ Reapplied {applied} cached LLM normalizations")
        return applied

    def _load_config(self) -> Tuple[List[str], Dict]:
        """Load API keys and model config from config.yaml."""
        config_paths = [
            Path("config.yaml"),
            Path("/Users/kashyapanand/Public/New/config.yaml"),
            Path.home() / "Public" / "New" / "config.yaml",
        ]
        
        api_keys = []
        model_config = MODEL_CONFIG.copy()
        
        for config_path in config_paths:
            if config_path.exists():
                try:
                    import yaml
                    with open(config_path) as f:
                        config = yaml.safe_load(f)
                        
                        # Load API keys
                        keys = config.get('agentic_matcher', {}).get('api_keys', [])
                        if keys:
                            api_keys = keys
                            print(f"✅ Loaded {len(keys)} API keys from {config_path}")
                        
                        # Load model-specific config
                        yaml_models = config.get('agentic_matcher', {}).get('models', {})
                        for model_name, model_cfg in yaml_models.items():
                            if model_name in model_config:
                                model_config[model_name].update(model_cfg)
                        
                        break
                except Exception as e:
                    print(f"Warning: Could not load config from {config_path}: {e}")
        
        return api_keys, model_config

    def _build_standards_context(self) -> str:
        """Build context of standard courses for LLM."""
        # Use ALL standards - no limit (LLMs handle large contexts now)
        standards = self.standard_terms if hasattr(self, 'standard_terms') and self.standard_terms else []
        return "\n".join(f"- {s}" for s in sorted(standards))

    def _get_grouped_terms(self) -> Dict[str, List[int]]:
        """Group/deduplicate terms at DB level (like agentic_matcher)."""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT original, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
            FROM processed_courses 
            WHERE score < ?
            GROUP BY UPPER(TRIM(original))
            ORDER BY cnt DESC
        """, (self.auto_threshold.get(),))
        
        groups = {}
        for row in cursor.fetchall():
            original = row[0]
            ids = [x.strip() for x in row[1].split(',')]  # IDs are UUIDs (strings)
            groups[original] = ids
        
        return groups

    def _create_clients(self, api_keys: List[str]) -> List[OpenRouterClient]:
        """Create OpenRouter clients for parallel processing."""
        if not OpenRouterClient:
            return []
        
        clients = []
        for key in api_keys:
            try:
                clients.append(OpenRouterClient(api_key=key, timeout=120))
            except Exception as e:
                print(f"Warning: Failed to create client: {e}")
        
        return clients

    def _call_llm_with_backoff(
        self, 
        client_idx: int,
        model: str,
        messages: List[Dict],
        attempt: int = 1
    ) -> Tuple[Optional[str], Dict]:
        """Call LLM with exponential backoff for rate limits."""
        if client_idx in self.invalid_clients:
            return None, {"error": "invalid_client", "success": False}
        
        model_config = MODEL_CONFIG.get(model, {})
        max_tokens = model_config.get("max_tokens", 8192)
        timeout = model_config.get("timeout", 90)
        
        try:
            client = self.clients[client_idx % len(self.clients)]
            response = client.complete(
                messages=messages,
                model=model,
                temperature=0.1,
                max_tokens=max_tokens,
                timeout=timeout,
            )
            self.stats.model_calls += 1
            return response.content, {"success": True, "model": model}
            
        except Exception as e:
            self.stats.model_failures += 1
            error_str = str(e)
            
            # Categorize error
            if "429" in error_str:
                # Rate limit - exponential backoff
                delay = min(2 ** attempt, 16)  # 2, 4, 8, 16 seconds max
                self.stats.rate_limit_delays += delay
                time.sleep(delay)
                return None, {"error": "429", "success": False, "retry_delay": delay}
            
            elif "401" in error_str:
                # Invalid API key - mark client as invalid
                self.invalid_clients.add(client_idx)
                self.stats.invalid_clients += 1
                return None, {"error": "401", "success": False}
            
            elif "503" in error_str or "timeout" in error_str.lower():
                time.sleep(1)
                return None, {"error": "503", "success": False}
            
            return None, {"error": str(e)[:50], "success": False}

    def _parse_llm_response(self, content: str) -> List[Dict]:
        """Parse LLM JSON response."""
        import re
        
        # Try to extract JSON array
        patterns = [
            r'```json\s*(.*?)\s*```',
            r'```\s*(.*?)\s*```',
            r'\[.*\]',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content, re.DOTALL)
            if match:
                try:
                    json_str = match.group(1) if '```' in pattern else match.group()
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    continue
        
        # Try parsing whole content
        try:
            return json.loads(content)
        except:
            return []

    def _normalize_batch_with_council(
        self,
        terms: List[str],
        standards_context: str,
        num_votes: int = 2
    ) -> List[NormalizationResult]:
        """
        Normalize with council voting - multiple models vote on same terms.
        """
        results: Dict[str, NormalizationResult] = {}
        votes_per_term: Dict[str, List[ModelVote]] = {t: [] for t in terms}
        
        # Build prompt
        terms_list = "\n".join(f"{i+1}. {t}" for i, t in enumerate(terms))
        user_prompt = f"""STANDARD COURSES (match to these):
{standards_context}

COURSES TO NORMALIZE:
{terms_list}

Normalize each course to the closest standard. Return JSON array."""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        
        # Get votes from multiple models
        models_to_use = WORKER_MODELS[:num_votes]
        
        for model_idx, model in enumerate(models_to_use):
            client_idx = model_idx % len(self.clients)
            start_time = time.time()
            
            content, info = self._call_llm_with_backoff(client_idx, model, messages)
            response_time = time.time() - start_time
            
            if content and info.get("success"):
                parsed = self._parse_llm_response(content)
                self.stats.council_votes += 1
                
                for item in parsed:
                    original = item.get("original", "")
                    normalized = item.get("normalized", "")
                    confidence = float(item.get("confidence", 0.5))
                    reason = item.get("reason", "")
                    
                    # Find matching term (case-insensitive)
                    for term in terms:
                        if term.upper().strip() == original.upper().strip():
                            vote = ModelVote(
                                model_name=model.split("/")[-1][:15],
                                normalized=normalized,
                                confidence=confidence,
                                reason=reason,
                                response_time=response_time
                            )
                            votes_per_term[term].append(vote)
                            break
        
        # Aggregate votes
        for term in terms:
            votes = votes_per_term[term]
            
            if not votes:
                # No votes - failed
                results[term] = NormalizationResult(
                    original=term,
                    normalized=term.upper().strip(),
                    confidence=0.0,
                    match_type="failed",
                    reason="No model votes received",
                    votes=[],
                    vote_agreement=0.0
                )
                self.stats.failed += 1
                continue
            
            # Find consensus (most common normalized value)
            normalized_counts: Dict[str, List[ModelVote]] = {}
            for v in votes:
                key = v.normalized.upper().strip()
                if key not in normalized_counts:
                    normalized_counts[key] = []
                normalized_counts[key].append(v)
            
            # Pick the one with most votes / highest confidence
            best_normalized = max(
                normalized_counts.items(),
                key=lambda x: (len(x[1]), sum(v.confidence for v in x[1]) / len(x[1]))
            )
            
            winning_votes = best_normalized[1]
            avg_confidence = sum(v.confidence for v in winning_votes) / len(winning_votes)
            agreement = len(winning_votes) / len(votes)
            
            results[term] = NormalizationResult(
                original=term,
                normalized=best_normalized[0],
                confidence=avg_confidence,
                match_type="council" if len(votes) > 1 else "llm",
                reason=f"Council: {len(winning_votes)}/{len(votes)} agree",
                votes=votes,
                vote_agreement=agreement
            )
            self.stats.llm_normalizations += 1
        
        return [results[t] for t in terms]

    def _process_batch_with_model(
        self,
        batch_idx: int,
        batch: List[str],
        model: str,
        client_idx: int,
        standards_context: str
    ) -> Tuple[int, List[Dict], bool, str]:
        """Process a single batch with ONE model (for parallel execution)."""
        terms_list = "\n".join(f"{i+1}. {t}" for i, t in enumerate(batch))
        user_prompt = f"""STANDARD COURSES (match to these):
{standards_context}

COURSES TO NORMALIZE:
{terms_list}

Normalize each course to the closest standard. Return JSON array."""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        
        content, info = self._call_llm_with_backoff(client_idx, model, messages)
        
        if content and info.get("success"):
            parsed = self._parse_llm_response(content)
            return batch_idx, parsed, True, model
        else:
            error = info.get("error", "unknown")
            return batch_idx, [], False, error

    def _normalize_parallel(
        self,
        all_terms: List[str],
        standards_context: str,
        batch_size: int = 10,
        max_workers: int = 5,
        progress_callback: Optional[callable] = None
    ) -> List[NormalizationResult]:
        """
        FAST PARALLEL batch processing like agentic_matcher.py.
        Processes multiple batches simultaneously across different models.
        """
        if not all_terms:
            return []
        
        # Split into batches
        batches = []
        for i in range(0, len(all_terms), batch_size):
            batches.append((i // batch_size, all_terms[i:i + batch_size]))
        
        total_batches = len(batches)
        completed_count = 0
        print(f"\n🚀 PARALLEL: {len(all_terms)} terms → {total_batches} batches × {max_workers} workers")
        
        # Track results
        completed_results: Dict[int, List[Dict]] = {}
        batch_terms: Dict[int, List[str]] = {idx: terms for idx, terms in batches}
        models_tried: Dict[int, Set[str]] = {i: set() for i in range(total_batches)}
        
        # Ensure clients are loaded
        if not self.clients:
            api_keys, _ = self._load_config()
            if api_keys:
                self.api_keys = api_keys
                self.clients = self._create_clients(api_keys)
            if not self.clients:
                logger.error("No API clients available - cannot process")
                return []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all jobs with round-robin model assignment
            futures = {}
            for batch_idx, batch in batches:
                model = WORKER_MODELS[batch_idx % len(WORKER_MODELS)]
                client_idx = batch_idx % len(self.clients)
                models_tried[batch_idx].add(model)
                
                future = executor.submit(
                    self._process_batch_with_model,
                    batch_idx, batch, model, client_idx, standards_context
                )
                futures[future] = batch_idx
            
            # Process with immediate fallback
            while futures:
                done_futures = []
                for future in as_completed(futures):
                    batch_idx = futures[future]
                    idx, parsed, success, model_or_error = future.result()
                    
                    if success and parsed:
                        completed_results[idx] = parsed
                        completed_count += 1
                        model_short = model_or_error.split("/")[-1][:12]
                        print(f"   ✅ Batch {idx+1}/{total_batches}: {len(parsed)} ({model_short})")
                        self.stats.model_calls += 1
                        
                        # Update progress bar
                        if progress_callback:
                            progress_callback(completed_count, total_batches)
                    else:
                        # Retry with different model
                        tried = models_tried[idx]
                        next_model = None
                        for m in WORKER_MODELS:
                            if m not in tried and len(tried) < 4:
                                next_model = m
                                break
                        
                        if next_model:
                            models_tried[idx].add(next_model)
                            new_future = executor.submit(
                                self._process_batch_with_model,
                                idx, batch_terms[idx], next_model, 
                                len(tried) % len(self.clients), standards_context
                            )
                            futures[new_future] = idx
                            print(f"   ↻ Batch {idx+1} retry → {next_model.split('/')[-1][:12]}")
                            self.stats.retries += 1
                        else:
                            completed_results[idx] = []
                            print(f"   ❌ Batch {idx+1}: All models failed")
                    
                    done_futures.append(future)
                
                for f in done_futures:
                    del futures[f]
        
        # Get standards set for verification
        standards_set = self._get_standards_set() if hasattr(self, '_get_standards_set') else set()
        
        # Convert to NormalizationResult with INLINE VERIFICATION
        results: List[NormalizationResult] = []
        for batch_idx, terms in batch_terms.items():
            parsed = completed_results.get(batch_idx, [])
            parsed_map = {p.get("original", "").upper().strip(): p for p in parsed if p.get("original")}
            
            for term in terms:
                term_key = term.upper().strip()
                if term_key in parsed_map:
                    p = parsed_map[term_key]
                    normalized = p.get("normalized", term) or term
                    confidence = float(p.get("confidence", 0.5))
                    
                    # 🔍 INLINE VERIFICATION: Check if normalized exists in standards
                    if standards_set and normalized.upper().strip() not in standards_set:
                        # Try to find a close match
                        best_match, match_score = self._find_best_standard_match(normalized, threshold=0.80) if hasattr(self, '_find_best_standard_match') else ("", 0.0)
                        
                        if best_match and match_score >= 0.80:
                            logger.info(f"🔄 LLM corrected: '{normalized}' → '{best_match}' ({match_score:.0%})")
                            normalized = best_match
                            confidence = confidence * match_score
                        else:
                            # LLM returned invalid result - penalize heavily
                            logger.warning(f"❌ LLM returned invalid: '{normalized}' not in standards")
                            confidence = confidence * 0.3  # Heavy penalty
                    
                    results.append(NormalizationResult(
                        original=term,
                        normalized=normalized,
                        confidence=confidence,
                        match_type="parallel_llm",
                        reason=p.get("reason", ""),
                    ))
                    self.stats.llm_normalizations += 1
                else:
                    results.append(NormalizationResult(
                        original=term,
                        normalized=term.upper().strip(),
                        confidence=0.0,
                        match_type="no_match",
                        reason="No LLM match",
                    ))
        
        return results

    def run_agentic_batch(self):
        """Run advanced agentic normalization with all features."""
        if not OpenRouterClient:
            messagebox.showerror("Error", "OpenRouterClient not available.")
            return
        
        # Reset stats
        self.stats = AgenticStats()
        self.invalid_clients = set()
        
        # 1. Load config
        self.api_keys, model_config = self._load_config()
        
        if not self.api_keys:
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                api_key = simpledialog.askstring("API Key", "Enter OpenRouter API Key:", parent=self.root)
                if not api_key:
                    return
            self.api_keys = [api_key]
        
        # 2. Create clients
        self.clients = self._create_clients(self.api_keys)
        if not self.clients:
            messagebox.showerror("Error", "Failed to create API clients.")
            return
        
        # 3. Get grouped terms (DB-level deduplication)
        groups = self._get_grouped_terms()
        
        if not groups:
            messagebox.showinfo("Agentic Batch", "No records found below threshold.")
            return
        
        unique_terms = list(groups.keys())
        total_records = sum(len(ids) for ids in groups.values())
        
        self.stats.total_terms = total_records
        self.stats.unique_terms = len(unique_terms)
        
        # 4. Confirm
        msg = (
            f"🧠 AGENTIC NORMALIZATION\n\n"
            f"Records: {total_records} ({len(unique_terms)} unique)\n"
            f"API Keys: {len(self.clients)}\n"
            f"Models: {len(WORKER_MODELS)}\n"
            f"Features: Council Voting, Wave Processing, Backoff\n\n"
            f"Proceed?"
        )
        if not messagebox.askyesno("Confirm", msg):
            return
        
        # 5. Build standards context
        standards_context = self._build_standards_context()
        
        # 6. Run in thread
        self.progress['maximum'] = len(unique_terms)
        self.progress['value'] = 0
        
        # Queue for thread-safe DB updates
        update_queue = queue.Queue()
        
        def _apply_updates():
            """Apply queued updates in main thread (required for :memory: SQLite)."""
            updated_count = 0
            while not update_queue.empty():
                try:
                    normalized, confidence, row_id = update_queue.get_nowait()
                    cursor = self.conn.cursor()
                    cursor.execute("""
                        UPDATE processed_courses 
                        SET suggested = ?, score = ?, status = ?, final = ?
                        WHERE id = ?
                    """, (
                        normalized,
                        int(confidence * 100),
                        "Auto-Matched" if confidence > 0.8 else "Possible Match",
                        normalized if confidence > 0.9 else "",
                        row_id
                    ))
                    updated_count += 1
                except queue.Empty:
                    break
            self.conn.commit()
            return updated_count
        
        def _process():
            # Use PARALLEL processing for speed!
            print(f"\n🚀 Starting PARALLEL Agentic Processing...")
            
            # Update LLM progress UI
            def update_status(text):
                if self.llm_status_label:
                    self.root.after(0, lambda: self.llm_status_label.configure(text=text))
            
            def update_llm_progress(completed, total):
                if self.llm_progress_bar:
                    pct = int((completed / total) * 100)
                    self.root.after(0, lambda: self.llm_progress_bar.configure(value=pct))
                    self.root.after(0, lambda: update_status(f"Processing: {completed}/{total} batches ({pct}%)"))
            
            # Reset progress
            if self.llm_progress_bar:
                self.root.after(0, lambda: self.llm_progress_bar.configure(value=0, maximum=100))
            update_status(f"🚀 Processing {len(unique_terms)} terms in parallel...")
            
            try:
                # Process ALL terms in parallel (much faster!)
                results = self._normalize_parallel(
                    unique_terms,
                    standards_context,
                    batch_size=10,  # 10 terms per batch
                    max_workers=min(5, len(self.clients)),  # Up to 5 parallel workers
                    progress_callback=update_llm_progress
                )
                
                # Queue successful results for DB update
                for result in results:
                    if result.confidence > 0.3:
                        term = result.original
                        # Case-insensitive lookup
                        row_ids = groups.get(term, [])
                        if not row_ids:
                            term_upper = term.upper().strip()
                            for key in groups:
                                if key.upper().strip() == term_upper:
                                    row_ids = groups[key]
                                    break
                        
                        if row_ids:
                            for row_id in row_ids:
                                update_queue.put((result.normalized, result.confidence, row_id))
                            # Cache the normalization for persistence
                            self._cache_normalization(term, result.normalized, result.confidence)
                
                # Update progress
                self.root.after(0, lambda: self.progress.configure(value=len(unique_terms)))
                
            except Exception as e:
                print(f"Error in parallel processing: {e}")
                import traceback
                traceback.print_exc()
            
            # Apply all updates in main thread
            def _finalize():
                updated = _apply_updates()
                
                # Save cache to file for persistence
                self._save_llm_cache()
                
                # Update LLM status
                if self.llm_status_label:
                    self.llm_status_label.configure(text=f"✅ Complete! Updated {updated} records (cached)")
                if self.llm_progress_bar:
                    self.llm_progress_bar.configure(value=100)
                    
                stats_msg = (
                    f"🧠 Agentic Processing Complete!\n\n"
                    f"Updated: {updated} records\n"
                    f"Cached: {len(self.llm_cache)} normalizations\n\n"
                    f"{self.stats.summary()}"
                )
                messagebox.showinfo("Complete", stats_msg)
                self.refresh_tree()
            
            self.root.after(0, _finalize)
        
        threading.Thread(target=_process, daemon=True).start()

    # ========== ADVANCED AUTOMATION FEATURES ==========
    
    def process_files(self, file_paths: list):
        """Override to auto-apply LLM cache and run predictive pre-cache."""
        # Call parent implementation
        super().process_files(file_paths)
        
        # Update adaptive thresholds based on accuracy history
        self._update_adaptive_thresholds()
        
        # Auto-apply cached normalizations
        if self.llm_cache:
            self.root.after(500, self._auto_apply_cache)
    
    def _auto_apply_cache(self):
        """Auto-apply cache after data load with user notification."""
        if not self.llm_cache or not hasattr(self, 'conn') or not self.conn:
            return
        
        applied = self.reapply_llm_cache()
        if applied > 0:
            if self.llm_status_label:
                self.llm_status_label.configure(text=f"✅ Auto-applied {applied} cached normalizations")
            self.refresh_tree()
            print(f"✅ Auto-applied {applied} cached normalizations on data load")
    
    def run_smart_retry(self):
        """Multi-round retry for unmatched/low-confidence items."""
        if not hasattr(self, 'conn') or not self.conn:
            messagebox.showwarning("No Data", "Load data first.")
            return
        
        # Get low-confidence items (score < 70)
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT DISTINCT original 
            FROM processed_courses 
            WHERE score < 70 AND score > 0
            LIMIT 100
        """)
        
        low_conf_items = [row[0] for row in cursor.fetchall()]
        
        if not low_conf_items:
            messagebox.showinfo("No Retries Needed", "All items have good confidence scores!")
            return
        
        if messagebox.askyesno("Smart Retry", 
            f"Found {len(low_conf_items)} low-confidence items.\n\n"
            f"Retry with enhanced prompts?"):
            self._run_retry_batch(low_conf_items)
    
    def _run_retry_batch(self, items: List[str]):
        """Run retry batch with enhanced prompts."""
        if self.llm_status_label:
            self.llm_status_label.configure(text=f"🔄 Retrying {len(items)} items...")
        
        # Reload cache (user might have added mappings)
        self._load_llm_cache()
        
        # Run agentic batch on these specific items (will use smarter prompt)
        self.run_agentic_batch()
    
    def learn_from_error_map(self, original: str, correction: str):
        """Learn from user's error mapping - cache at 100% confidence."""
        if not original or not correction:
            return
        
        # Cache with highest confidence
        self._cache_normalization(original, correction.upper().strip(), 1.0)
        self._save_llm_cache()
        
        print(f"✅ Learned: '{original}' → '{correction}'")
    
    def _hook_error_map_learning(self):
        """Hook into parent's error map save to auto-learn."""
        # This is called when user clicks "Add to Error Map"
        original_add_error = getattr(self, 'add_to_error_map', None)
        
        if original_add_error:
            def wrapped_add_error(*args, **kwargs):
                result = original_add_error(*args, **kwargs)
                # Learn from the mapping
                if hasattr(self, 'quick_original') and hasattr(self, 'quick_correction'):
                    orig = self.quick_original.get() if hasattr(self.quick_original, 'get') else ""
                    corr = self.quick_correction.get() if hasattr(self.quick_correction, 'get') else ""
                    if orig and corr:
                        self.learn_from_error_map(orig, corr)
                        # Also extract patterns
                        self._extract_pattern(orig, corr)
                return result
            self.add_to_error_map = wrapped_add_error

    # ========== GOD-LEVEL AI METHODS ==========
    
    def _load_patterns(self):
        """Load learned transformation patterns."""
        try:
            if os.path.exists(self.pattern_file):
                with open(self.pattern_file, 'r') as f:
                    self.learned_patterns = json.load(f)
                print(f"🧠 Loaded {len(self.learned_patterns)} learned patterns")
        except Exception as e:
            self.learned_patterns = {}
    
    def _save_patterns(self):
        """Save learned patterns to file."""
        try:
            with open(self.pattern_file, 'w') as f:
                json.dump(self.learned_patterns, f, indent=2)
        except:
            pass
    
    # ===== MULTI-MODEL ENSEMBLE =====
    
    def _load_model_accuracy(self):
        """Load model accuracy tracking data."""
        try:
            if os.path.exists(self.model_accuracy_file):
                with open(self.model_accuracy_file, 'r') as f:
                    self.model_accuracy = json.load(f)
                print(f"📊 Loaded accuracy data for {len(self.model_accuracy)} models")
        except:
            self.model_accuracy = {}
    
    def _save_model_accuracy(self):
        """Save model accuracy data."""
        try:
            with open(self.model_accuracy_file, 'w') as f:
                json.dump(self.model_accuracy, f, indent=2)
        except:
            pass
    
    def _update_model_accuracy(self, model: str, was_correct: bool, confidence: float):
        """Update accuracy stats for a model."""
        if model not in self.model_accuracy:
            self.model_accuracy[model] = {"correct": 0, "total": 0, "avg_conf": 0.0}
        
        stats = self.model_accuracy[model]
        stats["total"] += 1
        if was_correct:
            stats["correct"] += 1
        
        # Running average of confidence
        old_avg = stats["avg_conf"]
        stats["avg_conf"] = old_avg + (confidence - old_avg) / stats["total"]
        
        self._save_model_accuracy()
    
    def _get_model_weight(self, model: str) -> float:
        """Get weight for model based on historical accuracy."""
        if model not in self.model_accuracy:
            return 1.0  # Default weight for new models
        
        stats = self.model_accuracy[model]
        if stats["total"] < 5:
            return 1.0  # Not enough data
        
        accuracy = stats["correct"] / stats["total"]
        return 0.5 + (accuracy * 0.5)  # Weight between 0.5 and 1.0
    
    def _ensemble_vote(self, votes: List[Tuple[str, str, float]]) -> Tuple[str, float]:
        """
        Ensemble voting with weighted votes.
        votes: List of (model, normalized_result, confidence)
        Returns: (winning_result, combined_confidence)
        """
        if not votes:
            return "", 0.0
        
        if len(votes) == 1:
            return votes[0][1], votes[0][2]
        
        # Weight votes by model accuracy
        weighted_votes: Dict[str, float] = {}
        for model, result, conf in votes:
            weight = self._get_model_weight(model)
            result_key = result.upper().strip()
            if result_key not in weighted_votes:
                weighted_votes[result_key] = 0.0
            weighted_votes[result_key] += conf * weight
        
        # Find winner
        winner = max(weighted_votes, key=weighted_votes.get)
        
        # Calculate combined confidence
        total_weight = sum(self._get_model_weight(m) * c for m, r, c in votes)
        winner_weight = weighted_votes[winner]
        combined_conf = winner_weight / len(votes) if votes else 0.0
        
        # Unanimous bonus
        unique_results = set(r.upper().strip() for _, r, _ in votes)
        if len(unique_results) == 1:
            combined_conf = min(1.0, combined_conf * 1.2)  # 20% bonus for unanimous
        
        return winner, min(1.0, combined_conf)
    
    # ===== AGENTIC REASONING CHAIN =====
    
    def _parse_course_components(self, text: str) -> Dict[str, str]:
        """
        Parse course into components: degree, specialty, subspecialty.
        Example: "MD GENERAL MEDICINE" -> {degree: "MD", specialty: "GENERAL MEDICINE"}
        """
        text = text.upper().strip()
        words = text.split()
        
        components = {
            "degree": "",
            "specialty": "",
            "subspecialty": "",
            "raw": text
        }
        
        if not words:
            return components
        
        # Check for known degree prefix
        for i, word in enumerate(words):
            if word in self.degree_prefixes:
                components["degree"] = word
                components["specialty"] = " ".join(words[i+1:])
                break
        
        # If no degree found, assume first word is degree
        if not components["degree"] and len(words) >= 1:
            components["degree"] = words[0]
            components["specialty"] = " ".join(words[1:]) if len(words) > 1 else ""
        
        # Check for subspecialty pattern (e.g., "CARDIOLOGY - INTERVENTIONAL")
        if " - " in components["specialty"]:
            parts = components["specialty"].split(" - ")
            components["specialty"] = parts[0].strip()
            components["subspecialty"] = parts[1].strip() if len(parts) > 1 else ""
        
        return components
    
    def _agentic_reasoning_normalize(self, original: str, standards: List[str]) -> Tuple[str, float, str]:
        """
        Agentic Reasoning Chain:
        1. Parse into components
        2. Match each component
        3. Reconstruct
        4. Validate
        Returns: (normalized, confidence, explanation)
        """
        # Step 1: Parse
        components = self._parse_course_components(original)
        
        # Step 2: Match degree
        degree_conf = 1.0 if components["degree"] in self.degree_prefixes else 0.7
        
        # Step 3: Find best matching standard
        best_match = ""
        best_score = 0.0
        
        for std in standards:
            std_components = self._parse_course_components(std)
            
            # Score based on component matching
            score = 0.0
            
            # Degree match
            if components["degree"] == std_components["degree"]:
                score += 0.4
            
            # Specialty match (fuzzy)
            if components["specialty"] and std_components["specialty"]:
                if components["specialty"] == std_components["specialty"]:
                    score += 0.5
                elif components["specialty"] in std_components["specialty"] or std_components["specialty"] in components["specialty"]:
                    score += 0.3
            
            # Subspecialty match
            if components["subspecialty"] == std_components["subspecialty"]:
                score += 0.1
            
            if score > best_score:
                best_score = score
                best_match = std
        
        # Step 4: Validate
        explanation = f"Degree: {components['degree']} ({degree_conf*100:.0f}%), Specialty: {components['specialty']}"
        
        return best_match, best_score, explanation
    
    # ===== ADAPTIVE THRESHOLDS =====
    
    def _update_adaptive_thresholds(self):
        """Adjust thresholds based on model performance."""
        if not self.model_accuracy:
            return
        
        # Calculate overall accuracy
        total_correct = sum(m["correct"] for m in self.model_accuracy.values())
        total_all = sum(m["total"] for m in self.model_accuracy.values())
        
        if total_all < 50:
            return  # Not enough data
        
        overall_accuracy = total_correct / total_all
        
        # Adjust thresholds based on accuracy
        if overall_accuracy > 0.9:
            # High accuracy - can be more aggressive
            self.adaptive_thresholds["auto_match"] = 0.75
            self.adaptive_thresholds["possible"] = 0.45
        elif overall_accuracy < 0.7:
            # Lower accuracy - be more conservative
            self.adaptive_thresholds["auto_match"] = 0.85
            self.adaptive_thresholds["possible"] = 0.60
        
        print(f"📊 Adaptive thresholds updated: auto={self.adaptive_thresholds['auto_match']}, possible={self.adaptive_thresholds['possible']}")
    
    def _get_status_for_confidence(self, confidence: float) -> str:
        """Get status label based on adaptive thresholds."""
        if confidence >= self.adaptive_thresholds["auto_match"]:
            return "Auto-Matched"
        elif confidence >= self.adaptive_thresholds["possible"]:
            return "Possible Match"
        else:
            return "Low Confidence"
    
    # ===== PREDICTIVE PRE-CACHE =====
    
    def _predictive_pre_cache(self, terms: List[str]):
        """
        Pre-compute likely matches for faster results.
        Runs in background when data is loaded.
        """
        if not self.predictive_cache_enabled:
            return
        
        print("⚡ Starting predictive pre-cache...")
        
        predicted = 0
        for term in terms:  # Process ALL terms - no limit
            key = term.upper().strip()
            
            # Skip if already cached
            if key in self.llm_cache:
                continue
            
            # Try pattern matching first
            transformed, was_transformed = self._apply_patterns(term)
            if was_transformed:
                self._cache_normalization(term, transformed, 0.85)
                predicted += 1
                continue
            
            # Try agentic reasoning against standards
            if hasattr(self, 'standard_courses') and self.standard_courses:
                result, conf, _ = self._agentic_reasoning_normalize(term, list(self.standard_courses)[:50])
                if conf > 0.6:
                    self._cache_normalization(term, result, conf)
                    predicted += 1
        
        if predicted > 0:
            print(f"⚡ Pre-cached {predicted} predictions")
            self._save_llm_cache()
    
    def _extract_pattern(self, original: str, corrected: str):
        """Extract transformation patterns from a correction."""
        orig_parts = original.upper().split()
        corr_parts = corrected.upper().split()
        
        # Look for prefix transformations (e.g., NBEMS -> DNB)
        if len(orig_parts) >= 1 and len(corr_parts) >= 1:
            if orig_parts[0] != corr_parts[0]:
                self.learned_patterns[orig_parts[0]] = corr_parts[0]
                print(f"🧠 Pattern learned: {orig_parts[0]} → {corr_parts[0]}")
                self._save_patterns()
    
    def _apply_patterns(self, text: str) -> Tuple[str, bool]:
        """Apply learned patterns to text. Returns (result, was_transformed)."""
        words = text.upper().split()
        transformed = False
        
        for i, word in enumerate(words):
            if word in self.learned_patterns:
                words[i] = self.learned_patterns[word]
                transformed = True
        
        return " ".join(words), transformed
    
    def _check_consistency(self) -> List[Dict]:
        """Find and report inconsistencies (same input -> different outputs)."""
        inconsistencies = []
        
        if not hasattr(self, 'conn') or not self.conn:
            return inconsistencies
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT original, GROUP_CONCAT(DISTINCT suggested) as suggestions, COUNT(DISTINCT suggested) as cnt
            FROM processed_courses
            WHERE suggested IS NOT NULL AND suggested != ''
            GROUP BY UPPER(TRIM(original))
            HAVING cnt > 1
        """)
        
        for row in cursor.fetchall():
            inconsistencies.append({
                "original": row[0],
                "suggestions": row[1].split(",") if row[1] else [],
                "count": row[2]
            })
        
        return inconsistencies
    
    def _fix_inconsistencies(self) -> int:
        """Auto-fix inconsistencies by choosing highest confidence version (thread-safe)."""
        import sqlite3
        
        fixed = 0
        
        if not hasattr(self, 'db_path') or not self.db_path:
            return fixed
        
        # Use thread-local connection
        thread_conn = sqlite3.connect(self.db_path)
        cursor = thread_conn.cursor()
        
        # Get items with inconsistent normalizations
        cursor.execute("""
            SELECT original, suggested, MAX(score) as max_score
            FROM processed_courses
            WHERE suggested IS NOT NULL
            GROUP BY UPPER(TRIM(original))
        """)
        
        best_per_original = {}
        for row in cursor.fetchall():
            key = row[0].upper().strip() if row[0] else ""
            if key:
                best_per_original[key] = (row[1], row[2])
        
        # Apply the best version to all instances
        for key, (best_suggestion, best_score) in best_per_original.items():
            cursor.execute("""
                UPDATE processed_courses 
                SET suggested = ?, score = ?
                WHERE UPPER(TRIM(original)) = ? AND (suggested != ? OR suggested IS NULL)
            """, (best_suggestion, best_score, key, best_suggestion))
            fixed += cursor.rowcount
        
        thread_conn.commit()
        thread_conn.close()
        return fixed
    
    def _log_explanation(self, original: str, result: str, method: str, confidence: float, details: str = ""):
        """Log explanation for a normalization decision."""
        self.explanation_log.append({
            "original": original,
            "result": result,
            "method": method,
            "confidence": confidence,
            "details": details,
            "timestamp": time.time()
        })
    
    def run_god_mode(self):
        """⚡ ONE-CLICK GOD MODE - Runs EVERYTHING automatically."""
        if not hasattr(self, 'conn') or not self.conn:
            messagebox.showwarning("No Data", "Load data first.")
            return
        
        if not messagebox.askyesno("⚡ GOD MODE ⚡", 
            "This will run the ULTIMATE AI processing pipeline:\n\n"
            "1. Apply cached normalizations\n"
            "2. Apply learned patterns\n"
            "3. Run parallel LLM normalization\n"
            "4. Fix inconsistencies\n"
            "5. Generate explainability report\n\n"
            "Proceed?"):
            return
        
        if self.llm_status_label:
            self.llm_status_label.configure(text="⚡ GOD MODE ACTIVATED ⚡")
        
        # Sync in-memory DB to file for thread access
        self._sync_db_to_file()
        
        # Reset explanation log
        self.explanation_log = []
        
        def _god_mode_process():
            total_updated = 0
            
            # Create thread-local database connection
            import sqlite3
            thread_conn = sqlite3.connect(self.db_path)
            thread_cursor = thread_conn.cursor()
            
            # Step 1: Apply cache (using thread connection)
            print("\n⚡ STEP 1: Applying cached normalizations...")
            if self.llm_status_label:
                self.root.after(0, lambda: self.llm_status_label.configure(text="⚡ Step 1/5: Applying cache..."))
            
            cached_applied = 0
            for key, data in self.llm_cache.items():
                try:
                    thread_cursor.execute("""
                        UPDATE processed_courses 
                        SET suggested = ?, score = ?, status = 'Cached'
                        WHERE UPPER(TRIM(original)) = ? AND (score IS NULL OR score < ?)
                    """, (data["normalized"], int(data["confidence"] * 100), key, int(data["confidence"] * 100)))
                    cached_applied += thread_cursor.rowcount
                except Exception as e:
                    logger.error(f"Cache apply error: {e}")
            thread_conn.commit()
            total_updated += cached_applied
            print(f"   ✅ Applied {cached_applied} cached normalizations")
            
            # Step 2: Apply learned patterns
            print("\n⚡ STEP 2: Applying learned patterns...")
            if self.llm_status_label:
                self.root.after(0, lambda: self.llm_status_label.configure(text="⚡ Step 2/5: Applying patterns..."))
            
            patterns_applied = 0
            if self.learned_patterns:
                thread_cursor.execute("SELECT id, original, score FROM processed_courses WHERE score < 80")
                for row in thread_cursor.fetchall():
                    row_id, original, score = row
                    if not original:
                        continue
                    transformed, was_transformed = self._apply_patterns(original)
                    if was_transformed and transformed != original.upper():
                        thread_cursor.execute("""
                            UPDATE processed_courses 
                            SET suggested = ?, score = 85, status = 'Pattern Matched'
                            WHERE id = ?
                        """, (transformed, row_id))
                        patterns_applied += thread_cursor.rowcount
                thread_conn.commit()
            total_updated += patterns_applied
            print(f"   ✅ Applied patterns to {patterns_applied} items")
            
            # Step 3: Run LLM normalization on remaining
            print("\n⚡ STEP 3: Running parallel LLM normalization...")
            if self.llm_status_label:
                self.root.after(0, lambda: self.llm_status_label.configure(text="⚡ Step 3/5: LLM processing..."))
            
            # Close thread connection before LLM (it creates its own)
            thread_conn.close()
            
            # Get remaining unprocessed items
            self._run_llm_on_unprocessed()
            
            # Step 4: Fix inconsistencies
            print("\n⚡ STEP 4: Fixing inconsistencies...")
            if self.llm_status_label:
                self.root.after(0, lambda: self.llm_status_label.configure(text="⚡ Step 4/5: Fixing inconsistencies..."))
            
            fixed = self._fix_inconsistencies()
            print(f"   ✅ Fixed {fixed} inconsistencies")
            
            # Step 5: Generate report
            print("\n⚡ STEP 5: Generating report...")
            if self.llm_status_label:
                self.root.after(0, lambda: self.llm_status_label.configure(text="⚡ Step 5/5: Generating report..."))
            
            # Finalize
            def _finalize():
                self._save_llm_cache()
                self._update_stats_display()
                self.refresh_tree()
                
                if self.llm_status_label:
                    self.llm_status_label.configure(text="⚡ GOD MODE COMPLETE ⚡")
                
                # Show summary
                inconsistencies = self._check_consistency()
                messagebox.showinfo("⚡ GOD MODE COMPLETE ⚡",
                    f"Ultimate AI Processing Complete!\n\n"
                    f"📊 Results:\n"
                    f"• Cached applied: {cached_applied}\n"
                    f"• Patterns applied: {patterns_applied}\n"
                    f"• Inconsistencies fixed: {fixed}\n"
                    f"• Remaining issues: {len(inconsistencies)}\n\n"
                    f"🧠 Learned patterns: {len(self.learned_patterns)}\n"
                    f"💾 Total cached: {len(self.llm_cache)}"
                )
            
            self.root.after(0, _finalize)
        
        threading.Thread(target=_god_mode_process, daemon=True).start()
    
    def _apply_patterns_to_db(self) -> int:
        """Apply learned patterns to database records."""
        if not self.learned_patterns or not self.conn:
            return 0
        
        applied = 0
        cursor = self.conn.cursor()
        
        cursor.execute("SELECT id, original, suggested, score FROM processed_courses WHERE score < 80")
        
        for row in cursor.fetchall():
            row_id, original, current_suggested, score = row
            if not original:
                continue
            
            transformed, was_transformed = self._apply_patterns(original)
            
            if was_transformed and transformed != original.upper():
                # Check if transformed matches a standard
                cursor.execute("""
                    UPDATE processed_courses 
                    SET suggested = ?, score = 85, status = 'Pattern Matched'
                    WHERE id = ?
                """, (transformed, row_id))
                applied += 1
                
                self._log_explanation(original, transformed, "pattern", 0.85, 
                    f"Applied learned pattern: {list(self.learned_patterns.items())[:3]}")
        
        self.conn.commit()
        return applied
    
    def _run_llm_on_unprocessed(self):
        """Run LLM on remaining unprocessed items using thread-local connection."""
        import sqlite3
        
        # Create thread-local connection
        thread_conn = sqlite3.connect(self.db_path)
        thread_cursor = thread_conn.cursor()
        
        # Get unprocessed terms
        thread_cursor.execute("""
            SELECT DISTINCT original 
            FROM processed_courses 
            WHERE score < ? OR score IS NULL
        """, (int(self.adaptive_thresholds["auto_match"] * 100),))
        
        terms = [row[0] for row in thread_cursor.fetchall() if row[0]]
        
        if not terms:
            print("   ℹ️ No unprocessed terms remaining")
            thread_conn.close()
            return
        
        print(f"   📝 Processing {len(terms)} unprocessed terms...")
        
        # Build standards context
        standards_context = self._get_standards_context() if hasattr(self, '_get_standards_context') else ""
        
        # Run parallel normalization
        results = self._normalize_parallel(
            terms,  # Process ALL terms - no limit
            standards_context,
            batch_size=self.batch_size_llm,
            max_workers=min(5, len(self.clients)) if self.clients else 3
        )
        
        # Apply results using thread connection
        updated = 0
        for result in results:
            if result.confidence >= self.adaptive_thresholds["reject"]:
                status = self._get_status_for_confidence(result.confidence)
                
                thread_cursor.execute("""
                    UPDATE processed_courses 
                    SET suggested = ?, score = ?, status = ?, final = ?
                    WHERE UPPER(TRIM(original)) = ?
                """, (
                    result.normalized,
                    int(result.confidence * 100),
                    status,
                    result.normalized if result.confidence >= self.adaptive_thresholds["auto_match"] else "",
                    result.original.upper().strip()
                ))
                updated += thread_cursor.rowcount
                
                # Cache result
                self._cache_normalization(result.original, result.normalized, result.confidence)
        
        thread_conn.commit()
        thread_conn.close()
        
        print(f"   ✅ LLM normalized {updated} items")


    # ========== 300K-SCALE OPTIMIZATION METHODS ==========
    
    def _load_processing_state(self):
        """Load processing state for resumable processing."""
        try:
            if os.path.exists(self.progress_file):
                with open(self.progress_file, 'r') as f:
                    self.processing_state = json.load(f)
                if self.processing_state.get("pending_terms"):
                    print(f"⚠️ Found {len(self.processing_state['pending_terms'])} pending terms from previous session")
        except:
            pass
    
    def _save_processing_state(self):
        """Save processing state for resume capability."""
        self.processing_state["last_updated"] = time.time()
        try:
            with open(self.progress_file, 'w') as f:
                json.dump(self.processing_state, f)
        except:
            pass
    
    def _clear_processing_state(self):
        """Clear processing state after completion."""
        self.processing_state = {
            "current_chunk": 0,
            "processed_terms": [],
            "pending_terms": [],
            "is_running": False,
            "last_updated": None
        }
        if os.path.exists(self.progress_file):
            os.remove(self.progress_file)
    
    # ===== PAGINATION =====
    
    def _update_pagination_info(self):
        """Update pagination info based on current data."""
        if not hasattr(self, 'conn') or not self.conn:
            return
        
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM processed_courses")
        self.total_records = cursor.fetchone()[0] or 0
        self.total_pages = max(1, (self.total_records + self.page_size - 1) // self.page_size)
        
        # Update pagination label if exists
        if hasattr(self, 'pagination_label') and self.pagination_label:
            self.pagination_label.configure(
                text=f"Page {self.current_page + 1}/{self.total_pages} ({self.total_records:,} records)"
            )
    
    def _go_to_page(self, page: int):
        """Navigate to a specific page."""
        if page < 0:
            page = 0
        elif page >= self.total_pages:
            page = self.total_pages - 1
        
        self.current_page = page
        self._refresh_tree_paginated()
    
    def _refresh_tree_paginated(self):
        """Refresh tree with pagination - only load current page."""
        if not hasattr(self, 'tree') or not self.tree:
            return
        
        # Clear current items
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        if not hasattr(self, 'conn') or not self.conn:
            return
        
        cursor = self.conn.cursor()
        offset = self.current_page * self.page_size
        
        cursor.execute(f"""
            SELECT id, original, suggested, score, status, final
            FROM processed_courses
            ORDER BY score DESC, original
            LIMIT ? OFFSET ?
        """, (self.page_size, offset))
        
        for row in cursor.fetchall():
            self.tree.insert("", "end", values=row)
        
        self._update_pagination_info()
    
    # ===== CHUNKED PROCESSING =====
    
    def run_chunked_god_mode(self):
        """GOD MODE optimized for 300k+ records with chunked processing."""
        if not hasattr(self, 'conn') or not self.conn:
            messagebox.showwarning("No Data", "Load data first.")
            return
        
        # Check for resumable state
        if self.processing_state.get("pending_terms"):
            resume = messagebox.askyesno("Resume Processing",
                f"Found {len(self.processing_state['pending_terms'])} pending terms.\n\n"
                "Resume from where you left off?")
            if resume:
                self._resume_processing()
                return
        
        # Get total count
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(DISTINCT original) FROM processed_courses WHERE score < ?", 
                      (int(self.adaptive_thresholds["auto_match"] * 100),))
        total_unprocessed = cursor.fetchone()[0] or 0
        
        if total_unprocessed == 0:
            messagebox.showinfo("All Done!", "All records are already processed!")
            return
        
        # Estimate time
        batches_needed = (total_unprocessed + self.batch_size_llm - 1) // self.batch_size_llm
        est_minutes = (batches_needed * 3) // 60  # ~3 seconds per batch
        
        if not messagebox.askyesno("⚡ GOD MODE (300k Scale) ⚡",
            f"Processing {total_unprocessed:,} records in {self.chunk_size:,}-record chunks.\n\n"
            f"• Batch size: {self.batch_size_llm} terms/LLM call\n"
            f"• Estimated batches: {batches_needed:,}\n"
            f"• Estimated time: ~{est_minutes} minutes\n\n"
            "Processing is RESUMABLE if stopped.\n\n"
            "Proceed?"):
            return
        
        self._start_chunked_processing()
    
    def _start_chunked_processing(self):
        """Start chunked processing with progress persistence."""
        if self.llm_status_label:
            self.llm_status_label.configure(text="⚡ GOD MODE (300k Scale) ACTIVATED ⚡")
        
        # Get all unprocessed terms
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT DISTINCT original 
            FROM processed_courses 
            WHERE score < ?
        """, (int(self.adaptive_thresholds["auto_match"] * 100),))
        
        all_terms = [row[0] for row in cursor.fetchall() if row[0]]
        
        # Initialize processing state
        self.processing_state = {
            "current_chunk": 0,
            "processed_terms": [],
            "pending_terms": all_terms,
            "is_running": True,
            "last_updated": time.time()
        }
        self._save_processing_state()
        
        # Start processing in background
        threading.Thread(target=self._process_chunks, daemon=True).start()
    
    def _process_chunks(self):
        """Process data in chunks with checkpointing."""
        pending = self.processing_state["pending_terms"]
        total = len(pending)
        processed_count = 0
        
        print(f"\n⚡ Processing {total:,} terms in chunks of {self.chunk_size:,}...")
        
        # Process in chunks
        for chunk_idx in range(0, total, self.chunk_size):
            if not self.processing_state["is_running"]:
                print("⏸️ Processing paused")
                break
            
            chunk = pending[chunk_idx:chunk_idx + self.chunk_size]
            chunk_num = chunk_idx // self.chunk_size + 1
            total_chunks = (total + self.chunk_size - 1) // self.chunk_size
            
            print(f"\n📦 Chunk {chunk_num}/{total_chunks}: {len(chunk):,} terms")
            
            if self.llm_status_label:
                self.root.after(0, lambda c=chunk_num, t=total_chunks: 
                    self.llm_status_label.configure(text=f"⚡ Chunk {c}/{t} processing..."))
            
            # Process this chunk using the existing parallel method
            try:
                # Use larger batch size for 300k scale
                results = self._normalize_parallel(
                    chunk,
                    self._get_standards_context(),
                    batch_size=self.batch_size_llm,
                    max_workers=min(5, len(self.clients)),
                    progress_callback=lambda done, tot: self._chunk_progress(done, tot, chunk_num, total_chunks)
                )
                
                # Apply results to database
                update_count = self._apply_results_to_db(results)
                processed_count += len(chunk)
                
                print(f"   ✅ Chunk {chunk_num} complete: {update_count} updates")
                
                # Update progress state
                self.processing_state["current_chunk"] = chunk_num
                self.processing_state["processed_terms"].extend(chunk)
                self.processing_state["pending_terms"] = pending[chunk_idx + self.chunk_size:]
                self._save_processing_state()
                
            except Exception as e:
                print(f"   ❌ Chunk {chunk_num} error: {e}")
                import traceback
                traceback.print_exc()
        
        # Finalize
        def _finalize():
            self._save_llm_cache()
            self._update_stats_display()
            self._refresh_tree_paginated()
            self._clear_processing_state()
            
            if self.llm_status_label:
                self.llm_status_label.configure(text="⚡ GOD MODE COMPLETE ⚡")
            
            messagebox.showinfo("⚡ GOD MODE COMPLETE ⚡",
                f"Processed {processed_count:,} terms across {(total + self.chunk_size - 1) // self.chunk_size} chunks.\n\n"
                f"Cached: {len(self.llm_cache):,} normalizations")
        
        self.root.after(0, _finalize)
    
    def _chunk_progress(self, done: int, total: int, chunk_num: int, total_chunks: int):
        """Update progress for chunked processing."""
        if self.llm_progress_bar:
            # Calculate overall progress
            chunk_progress = done / total if total > 0 else 0
            overall = ((chunk_num - 1) + chunk_progress) / total_chunks * 100
            self.root.after(0, lambda: self.llm_progress_bar.configure(value=overall))
    
    def _apply_results_to_db(self, results: List) -> int:
        """Apply normalization results to database."""
        if not results or not self.conn:
            return 0
        
        cursor = self.conn.cursor()
        updated = 0
        
        for result in results:
            if result.confidence > self.adaptive_thresholds["reject"]:
                status = self._get_status_for_confidence(result.confidence)
                
                cursor.execute("""
                    UPDATE processed_courses 
                    SET suggested = ?, score = ?, status = ?, final = ?
                    WHERE UPPER(TRIM(original)) = ?
                """, (
                    result.normalized,
                    int(result.confidence * 100),
                    status,
                    result.normalized if result.confidence >= self.adaptive_thresholds["auto_match"] else "",
                    result.original.upper().strip()
                ))
                updated += cursor.rowcount
                
                # Cache the result
                self._cache_normalization(result.original, result.normalized, result.confidence)
        
        self.conn.commit()
        return updated
    
    def _get_standards_context(self) -> str:
        """Get standards context for LLM."""
        # Use ALL standard_terms
        if hasattr(self, 'standard_terms') and self.standard_terms:
            return "\n".join(self.standard_terms)
        return ""
    
    def _resume_processing(self):
        """Resume processing from saved state."""
        if not self.processing_state.get("pending_terms"):
            messagebox.showinfo("Nothing to Resume", "No pending processing found.")
            return
        
        self.processing_state["is_running"] = True
        threading.Thread(target=self._process_chunks, daemon=True).start()
    
    def pause_processing(self):
        """Pause current processing."""
        self.processing_state["is_running"] = False
        self._save_processing_state()
        if self.llm_status_label:
            self.llm_status_label.configure(text="⏸️ Processing paused - resumable")
        messagebox.showinfo("Paused", "Processing paused. You can resume later.")
    
    def run_smart_process(self):
        """
        🚀 UNIFIED SMART PROCESS
        Auto-selects the best processing mode based on data size:
        - < 1000 records: GOD MODE (quick, all features)
        - 1000-50000 records: 300K MODE (chunked processing)
        - > 50000 records: LEGEND MODE (full optimization)
        """
        if not hasattr(self, 'conn') or not self.conn:
            messagebox.showwarning("No Data", "Load data first.")
            return
        
        # Check for resumable state first
        if self.processing_state.get("pending_terms"):
            resume = messagebox.askyesno("Resume Processing",
                f"Found {len(self.processing_state['pending_terms'])} pending terms.\n\n"
                "Resume from where you left off?")
            if resume:
                self._resume_processing()
                return
        
        # Count unprocessed records
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT COUNT(DISTINCT original) 
            FROM processed_courses 
            WHERE score < ?
        """, (int(self.adaptive_thresholds["auto_match"] * 100),))
        unprocessed = cursor.fetchone()[0] or 0
        
        if unprocessed == 0:
            messagebox.showinfo("All Done!", "All records are already processed!")
            return
        
        # Auto-select mode based on size
        if unprocessed < 1000:
            mode = "GOD"
            mode_func = self.run_god_mode
            desc = "Quick processing with all AI features"
        elif unprocessed < 50000:
            mode = "300K"
            mode_func = self.run_chunked_god_mode
            desc = "Chunked processing with progress save"
        else:
            mode = "LEGEND"
            mode_func = self.run_legend_mode
            desc = "Full optimization with smart prioritization"
        
        if messagebox.askyesno(f"🚀 SMART PROCESS ({mode} MODE)",
            f"Processing {unprocessed:,} records\n\n"
            f"Auto-selected: {mode} MODE\n"
            f"({desc})\n\n"
            f"Features:\n"
            f"• Auto-apply cache & patterns\n"
            f"• Parallel LLM processing\n"
            f"• Self-improving AI\n"
            f"• Resumable if stopped\n\n"
            "Proceed?"):
            mode_func()


    # ========== 🏆 LEGEND MODE METHODS ==========
    
    def _load_correction_history(self):
        """Load correction history for self-improvement."""
        try:
            if os.path.exists(self.correction_file):
                with open(self.correction_file, 'r') as f:
                    self.correction_history = json.load(f)
                print(f"🏆 Loaded {len(self.correction_history)} corrections for self-improvement")
        except:
            self.correction_history = []
    
    def _save_correction_history(self):
        """Save correction history."""
        try:
            with open(self.correction_file, 'w') as f:
                json.dump(self.correction_history[-1000:], f)  # Keep last 1000
        except:
            pass
    
    def record_correction(self, original: str, wrong: str, correct: str):
        """Record a user correction for self-improvement."""
        self.correction_history.append({
            "original": original,
            "wrong": wrong,
            "correct": correct,
            "timestamp": time.time()
        })
        self._save_correction_history()
        
        # Also learn pattern
        self._extract_pattern(original, correct)
        self._cache_normalization(original, correct, 1.0)
        
        print(f"🏆 Correction recorded: '{wrong}' → '{correct}'")
    
    def _get_improved_prompt(self) -> str:
        """Generate improved prompt based on correction history."""
        base_prompt = self.NORMALIZATION_PROMPT
        
        if not self.correction_history:
            return base_prompt
        
        # Add examples from corrections
        examples = []
        for corr in self.correction_history[-10:]:  # Last 10 corrections
            examples.append(f"- '{corr['original']}' should be '{corr['correct']}' (NOT '{corr['wrong']}')")
        
        if examples:
            improved = base_prompt + "\n\nLEARNED CORRECTIONS:\n" + "\n".join(examples)
            return improved
        
        return base_prompt
    
    def _prioritize_terms(self, terms: List[str]) -> List[str]:
        """Smart prioritization: high-value items first."""
        if not hasattr(self, 'conn') or not self.conn or not terms:
            return terms
        
        cursor = self.conn.cursor()
        
        # Get frequency and score for each term
        term_scores = {}
        for term in terms:
            cursor.execute("""
                SELECT COUNT(*) as freq, AVG(score) as avg_score
                FROM processed_courses 
                WHERE UPPER(TRIM(original)) = ?
            """, (term.upper().strip(),))
            row = cursor.fetchone()
            
            freq = row[0] or 1
            avg_score = row[1] or 0
            
            # Calculate priority score
            priority = 0.0
            priority += min(freq, 10) * self.priority_weights["high_frequency"]  # Frequency bonus
            priority += (100 - avg_score) / 100 * self.priority_weights["low_confidence"]  # Low score bonus
            
            term_scores[term] = priority
        
        # Sort by priority (highest first)
        return sorted(terms, key=lambda t: term_scores.get(t, 0), reverse=True)
    
    def _multi_strategy_normalize(self, term: str) -> Tuple[str, float, str]:
        """
        Multi-strategy normalization pipeline:
        1. Cache → 2. Pattern → 3. LLM → 4. Fuzzy → 5. Flag
        """
        key = term.upper().strip()
        
        # Strategy 1: Cache
        if key in self.llm_cache:
            cached = self.llm_cache[key]
            return cached["normalized"], cached["confidence"], "cache"
        
        # Strategy 2: Pattern
        transformed, was_transformed = self._apply_patterns(term)
        if was_transformed:
            return transformed, 0.85, "pattern"
        
        # Strategy 3: LLM (will be called separately in batch)
        # Return None to indicate LLM needed
        return "", 0.0, "needs_llm"
    
    def _calculate_eta(self, processed: int, total: int) -> str:
        """Calculate estimated time remaining."""
        if processed == 0 or not self.processing_start_time:
            return "Calculating..."
        
        elapsed = time.time() - self.processing_start_time
        rate = processed / elapsed  # items per second
        
        # Add to samples for smoothing
        self.eta_samples.append(rate)
        if len(self.eta_samples) > 10:
            self.eta_samples = self.eta_samples[-10:]
        
        # Use average rate
        avg_rate = sum(self.eta_samples) / len(self.eta_samples)
        self.items_per_second = avg_rate
        
        remaining = total - processed
        if avg_rate > 0:
            eta_seconds = remaining / avg_rate
            
            if eta_seconds < 60:
                return f"{int(eta_seconds)}s"
            elif eta_seconds < 3600:
                return f"{int(eta_seconds // 60)}m {int(eta_seconds % 60)}s"
            else:
                hours = int(eta_seconds // 3600)
                mins = int((eta_seconds % 3600) // 60)
                return f"{hours}h {mins}m"
        
        return "Calculating..."
    
    def _auto_tune_parameters(self):
        """Auto-tune batch size and thresholds based on performance."""
        if not self.auto_tune_enabled or not self.model_accuracy:
            return
        
        # Calculate overall success rate
        total_calls = sum(m.get("total", 0) for m in self.model_accuracy.values())
        if total_calls < 100:
            return  # Not enough data
        
        # Tune batch size based on error rate
        error_rate = 1 - (sum(m.get("correct", 0) for m in self.model_accuracy.values()) / total_calls)
        
        if error_rate < 0.1:
            # Very low errors - can increase batch size
            self.batch_size_llm = min(100, self.batch_size_llm + 10)
        elif error_rate > 0.3:
            # High errors - decrease batch size
            self.batch_size_llm = max(20, self.batch_size_llm - 10)
        
        print(f"🏆 Auto-tuned: batch_size={self.batch_size_llm}, error_rate={error_rate:.2%}")
    
    def export_learning(self):
        """Export all learned data for sharing/backup."""
        export_data = {
            "patterns": self.learned_patterns,
            "cache": dict(list(self.llm_cache.items())[:5000]),  # Limit size
            "corrections": self.correction_history,
            "model_accuracy": self.model_accuracy,
            "exported_at": time.time()
        }
        
        export_file = os.path.join(os.path.dirname(__file__), "learning_export.json")
        try:
            with open(export_file, 'w') as f:
                json.dump(export_data, f, indent=2)
            messagebox.showinfo("Export Complete", 
                f"Learning data exported to:\n{export_file}\n\n"
                f"Patterns: {len(self.learned_patterns)}\n"
                f"Cache: {len(self.llm_cache)}\n"
                f"Corrections: {len(self.correction_history)}")
        except Exception as e:
            messagebox.showerror("Export Failed", str(e))
    
    def import_learning(self):
        """Import learned data from file."""
        from tkinter import filedialog
        
        file_path = filedialog.askopenfilename(
            title="Select Learning Export File",
            filetypes=[("JSON files", "*.json")]
        )
        
        if not file_path:
            return
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Merge patterns
            if "patterns" in data:
                self.learned_patterns.update(data["patterns"])
                self._save_patterns()
            
            # Merge cache
            if "cache" in data:
                self.llm_cache.update(data["cache"])
                self._save_llm_cache()
            
            # Merge corrections
            if "corrections" in data:
                self.correction_history.extend(data["corrections"])
                self._save_correction_history()
            
            messagebox.showinfo("Import Complete", 
                f"Learning data imported!\n\n"
                f"Patterns: {len(self.learned_patterns)}\n"
                f"Cache: {len(self.llm_cache)}\n"
                f"Corrections: {len(self.correction_history)}")
        except Exception as e:
            messagebox.showerror("Import Failed", str(e))
    
    def run_legend_mode(self):
        """🏆 LEGEND MODE - The ultimate AI processing."""
        if not hasattr(self, 'conn') or not self.conn:
            messagebox.showwarning("No Data", "Load data first.")
            return
        
        if not messagebox.askyesno("🏆 LEGEND MODE 🏆",
            "The ULTIMATE AI processing:\n\n"
            "✓ Self-improving prompts from corrections\n"
            "✓ Smart prioritization (high-value first)\n"
            "✓ Multi-strategy pipeline (cache→pattern→LLM)\n"
            "✓ Real-time ETA updates\n"
            "✓ Auto-parameter tuning\n"
            "✓ Desktop notification on completion\n\n"
            "Proceed with LEGEND MODE?"):
            return
        
        self.processing_start_time = time.time()
        self.eta_samples = []
        
        if self.llm_status_label:
            self.llm_status_label.configure(text="🏆 LEGEND MODE ACTIVATED 🏆")
        
        def _legend_process():
            # Auto-tune parameters
            self._auto_tune_parameters()
            
            # Get unprocessed terms
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT DISTINCT original 
                FROM processed_courses 
                WHERE score < ?
            """, (int(self.adaptive_thresholds["auto_match"] * 100),))
            
            all_terms = [row[0] for row in cursor.fetchall() if row[0]]
            
            if not all_terms:
                self.root.after(0, lambda: messagebox.showinfo("🏆", "All records already processed!"))
                return
            
            # Smart prioritization
            print("🏆 Prioritizing terms...")
            prioritized = self._prioritize_terms(all_terms)
            
            total = len(prioritized)
            processed = 0
            llm_needed = []
            
            # Phase 1: Quick wins (cache + patterns)
            print("🏆 Phase 1: Cache + Pattern matching...")
            for term in prioritized:
                result, conf, strategy = self._multi_strategy_normalize(term)
                
                if strategy in ["cache", "pattern"]:
                    # Apply immediately
                    cursor.execute("""
                        UPDATE processed_courses 
                        SET suggested = ?, score = ?, status = ?
                        WHERE UPPER(TRIM(original)) = ?
                    """, (result, int(conf * 100), f"Legend-{strategy}", term.upper().strip()))
                    processed += 1
                else:
                    llm_needed.append(term)
                
                # Update ETA every 100 items
                if processed % 100 == 0:
                    eta = self._calculate_eta(processed, total)
                    self.root.after(0, lambda e=eta, p=processed, t=total: 
                        self.llm_status_label.configure(text=f"🏆 Phase 1: {p}/{t} | ETA: {e}") if self.llm_status_label else None)
            
            self.conn.commit()
            print(f"🏆 Phase 1 complete: {processed} quick wins, {len(llm_needed)} need LLM")
            
            # Phase 2: LLM processing with improved prompts
            if llm_needed:
                print(f"🏆 Phase 2: LLM processing {len(llm_needed)} terms...")
                if self.llm_status_label:
                    self.root.after(0, lambda: self.llm_status_label.configure(text=f"🏆 Phase 2: LLM for {len(llm_needed)} terms..."))
                
                # Use chunked processing
                self.processing_state["pending_terms"] = llm_needed
                self.processing_state["is_running"] = True
                self._process_chunks()
            
            # Finalize
            def _finalize():
                self._save_llm_cache()
                self._update_stats_display()
                self._refresh_tree_paginated()
                
                elapsed = time.time() - self.processing_start_time
                
                if self.llm_status_label:
                    self.llm_status_label.configure(text="🏆 LEGEND MODE COMPLETE 🏆")
                
                # Desktop notification (Mac)
                try:
                    os.system(f'''osascript -e 'display notification "LEGEND MODE complete! Processed {total} terms in {elapsed/60:.1f} minutes" with title "🏆 Course Standardizer"' ''')
                except:
                    pass
                
                messagebox.showinfo("🏆 LEGEND MODE COMPLETE 🏆",
                    f"Ultimate AI Processing Complete!\n\n"
                    f"Total: {total:,} terms\n"
                    f"Quick wins: {processed:,}\n"
                    f"LLM processed: {len(llm_needed):,}\n"
                    f"Time: {elapsed/60:.1f} minutes\n"
                    f"Rate: {total/elapsed:.1f} items/sec")
            
            self.root.after(0, _finalize)
        
        threading.Thread(target=_legend_process, daemon=True).start()

    # ========== DEGREE LEVEL VALIDATION ==========
    
    # Degree hierarchy for validation
    DEGREE_LEVELS = {
        "DIPLOMA": ["DIPLOMA", "DIP", "D."],
        "DNB": ["DNB", "DIPLOMATE"],
        "DNB- DIPLOMA": ["DNB- DIPLOMA", "DNB-DIPLOMA", "DNB DIPLOMA"],
        "MD": ["MD", "M.D."],
        "MS": ["MS", "M.S."],
        "DM": ["DM", "D.M."],
        "MCH": ["MCH", "M.CH", "M.CH."],
        "MBBS": ["MBBS", "M.B.B.S"],
        "BDS": ["BDS", "B.D.S"],
        "PG": ["PG", "POST GRADUATE", "POSTGRADUATE"],
        "UG": ["UG", "UNDER GRADUATE", "UNDERGRADUATE"],
    }
    
    def _extract_degree_level(self, text: str) -> str:
        """Extract degree level from course text."""
        if not text:
            return ""
        
        text_upper = text.upper().strip()
        
        # Check for compound degrees first (more specific)
        if "DNB- DIPLOMA" in text_upper or "DNB-DIPLOMA" in text_upper or "DNB DIPLOMA" in text_upper:
            return "DNB- DIPLOMA"
        
        # Check for individual degrees
        for level, variants in self.DEGREE_LEVELS.items():
            for variant in variants:
                if text_upper.startswith(variant) or f" {variant}" in text_upper:
                    return level
        
        return ""
    
    def _validate_normalization(self, original: str, normalized: str, confidence: float) -> Tuple[str, float, bool]:
        """
        Validate a normalization and fix if needed.
        Returns: (corrected_result, adjusted_confidence, was_corrected)
        """
        if not original or not normalized:
            return normalized, confidence, False
        
        orig_degree = self._extract_degree_level(original)
        norm_degree = self._extract_degree_level(normalized)
        
        # Check if degree level was lost
        if orig_degree and orig_degree != norm_degree:
            logger.warning(f"⚠️ Degree mismatch: '{original}' has {orig_degree} but normalized to '{normalized}' with {norm_degree}")
            
            # Try to fix by prepending the original degree level
            if orig_degree == "DNB- DIPLOMA" and "DNB" in normalized.upper():
                # Replace "DNB " with "DNB- DIPLOMA "
                fixed = normalized.upper().replace("DNB ", "DNB- DIPLOMA ", 1)
                logger.info(f"✅ Fixed: '{normalized}' → '{fixed}'")
                return fixed, confidence * 0.9, True
            
            elif orig_degree == "DIPLOMA" and "DIPLOMA" not in normalized.upper():
                # Add DIPLOMA prefix if missing
                fixed = f"DIPLOMA {normalized}"
                logger.info(f"✅ Fixed: '{normalized}' → '{fixed}'")
                return fixed, confidence * 0.9, True
            
            # If we can't fix, reduce confidence significantly
            return normalized, confidence * 0.5, False
        
        return normalized, confidence, False
    
    def run_validation_pass(self) -> int:
        """Run validation on all processed records to catch and fix false matches."""
        if not hasattr(self, 'conn') or not self.conn:
            return 0
        
        logger.info("Running validation pass on processed records...")
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, original, suggested, score 
            FROM processed_courses 
            WHERE suggested IS NOT NULL AND suggested != ''
        """)
        
        fixed_count = 0
        for row in cursor.fetchall():
            row_id, original, suggested, score = row
            
            corrected, new_conf, was_fixed = self._validate_normalization(original, suggested, score/100)
            
            if was_fixed:
                cursor.execute("""
                    UPDATE processed_courses 
                    SET suggested = ?, score = ?, status = 'Validated-Fixed'
                    WHERE id = ?
                """, (corrected, int(new_conf * 100), row_id))
                fixed_count += 1
                
                # Also update cache
                self._cache_normalization(original, corrected, new_conf)
        
        self.conn.commit()
        logger.info(f"✅ Validation complete: Fixed {fixed_count} records")
        
        if fixed_count > 0:
            messagebox.showinfo("Validation Complete", f"Fixed {fixed_count} false matches!")
        
        return fixed_count

    # ========== STANDARDS VERIFICATION SYSTEM ==========
    
    def _get_standards_set(self) -> Set[str]:
        """Get set of standard courses (uppercase) for fast lookup."""
        # Use standard_terms from parent class (tinker3)
        if hasattr(self, 'standard_terms') and self.standard_terms:
            return {s.upper().strip() for s in self.standard_terms}
        # Fallback to standard_courses if set
        if hasattr(self, 'standard_courses') and self.standard_courses:
            return {s.upper().strip() for s in self.standard_courses}
        return set()
    
    def _find_best_standard_match(self, suggestion: str, threshold: float = 0.85) -> Tuple[str, float]:
        """
        Find the best matching standard course for a suggestion.
        Returns (best_match, similarity_score) or ("", 0.0) if no match.
        """
        if not suggestion:
            return "", 0.0
        
        standards = self._get_standards_set()
        if not standards:
            return "", 0.0
        
        suggestion_upper = suggestion.upper().strip()
        
        # 1. Exact match
        if suggestion_upper in standards:
            return suggestion, 1.0
        
        # 2. Find best fuzzy match
        best_match = ""
        best_score = 0.0
        
        # Get the standards list (prefer standard_terms)
        standards_list = self.standard_terms if hasattr(self, 'standard_terms') and self.standard_terms else []
        if not standards_list and hasattr(self, 'standard_courses') and self.standard_courses:
            standards_list = list(self.standard_courses)
        
        for std in standards:
            score = difflib.SequenceMatcher(None, suggestion_upper, std).ratio()
            if score > best_score:
                best_score = score
                # Get original case version
                for orig in standards_list:
                    if orig.upper().strip() == std:
                        best_match = orig
                        break
        
        if best_score >= threshold:
            return best_match, best_score
        
        return "", 0.0
    
    def verify_suggestion(self, original: str, suggestion: str, confidence: float) -> Tuple[str, float, str]:
        """
        Verify a suggestion against standards.
        Returns: (verified_result, new_confidence, status)
        Status: 'Verified-Exact', 'Verified-Close', 'Unverified', 'No-Match'
        """
        if not suggestion:
            return suggestion, confidence, "No-Match"
        
        standards = self._get_standards_set()
        if not standards:
            logger.warning("No standards loaded - skipping verification")
            return suggestion, confidence, "No-Standards"
        
        suggestion_upper = suggestion.upper().strip()
        
        # Get standards list for original case lookup
        standards_list = self.standard_terms if hasattr(self, 'standard_terms') and self.standard_terms else []
        
        # Check exact match first
        if suggestion_upper in standards:
            # Find original case
            for std in standards_list:
                if std.upper().strip() == suggestion_upper:
                    return std, min(confidence * 1.1, 1.0), "Verified-Exact"
            return suggestion, confidence, "Verified-Exact"
        
        # Try to find close match (>85% similarity)
        best_match, score = self._find_best_standard_match(suggestion, threshold=0.85)
        if best_match and score >= 0.85:
            logger.info(f"✅ Verified close: '{suggestion}' → '{best_match}' ({score:.0%})")
            return best_match, confidence * score, "Verified-Close"
        
        # Try looser match (>70% similarity) with reduced confidence
        best_match, score = self._find_best_standard_match(suggestion, threshold=0.70)
        if best_match and score >= 0.70:
            logger.warning(f"⚠️ Loose match: '{suggestion}' → '{best_match}' ({score:.0%})")
            return best_match, confidence * score * 0.8, "Verified-Loose"
        
        # No match found - flag for review
        logger.warning(f"❌ No standard match for: '{suggestion}'")
        return suggestion, confidence * 0.3, "Unverified"
    
    def run_strict_verification(self):
        """
        Run strict verification on ALL suggestions against standards.
        This ensures every suggested course actually exists in the standards list.
        """
        if not hasattr(self, 'conn') or not self.conn:
            messagebox.showwarning("No Data", "Load data first.")
            return
        
        standards = self._get_standards_set()
        if not standards:
            messagebox.showwarning("No Standards", "No standard courses loaded!")
            return
        
        if not messagebox.askyesno("🔍 Strict Verification",
            f"This will verify ALL suggestions against {len(standards)} standard courses.\n\n"
            "• Exact matches → Verified (high confidence)\n"
            "• Close matches (>85%) → Corrected to standard\n"
            "• Loose matches (70-85%) → Corrected, lower confidence\n"
            "• No match → Flagged for review\n\n"
            "Proceed?"):
            return
        
        logger.info(f"🔍 Starting strict verification against {len(standards)} standards...")
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, original, suggested, score 
            FROM processed_courses 
            WHERE suggested IS NOT NULL AND suggested != ''
        """)
        
        stats = {"exact": 0, "close": 0, "loose": 0, "unverified": 0, "total": 0}
        
        for row in cursor.fetchall():
            row_id, original, suggested, score = row
            stats["total"] += 1
            
            verified, new_conf, status = self.verify_suggestion(original, suggested, score/100)
            
            if status == "Verified-Exact":
                stats["exact"] += 1
            elif status == "Verified-Close":
                stats["close"] += 1
            elif status == "Verified-Loose":
                stats["loose"] += 1
            else:
                stats["unverified"] += 1
            
            # Update if changed
            if verified != suggested or int(new_conf * 100) != score:
                cursor.execute("""
                    UPDATE processed_courses 
                    SET suggested = ?, score = ?, status = ?
                    WHERE id = ?
                """, (verified, int(new_conf * 100), status, row_id))
                
                # Update cache with verified result
                if status in ["Verified-Exact", "Verified-Close"]:
                    self._cache_normalization(original, verified, new_conf)
        
        self.conn.commit()
        self._save_llm_cache()
        self._update_stats_display()
        
        logger.info(f"🔍 Verification complete: {stats}")
        
        messagebox.showinfo("🔍 Verification Complete",
            f"Verified {stats['total']} records:\n\n"
            f"✅ Exact matches: {stats['exact']}\n"
            f"🔄 Close matches (corrected): {stats['close']}\n"
            f"⚠️ Loose matches: {stats['loose']}\n"
            f"❌ No match (needs review): {stats['unverified']}")

    # ========== QUALITY IMPROVEMENTS ==========
    
    def _fuzzy_match(self, term: str, candidates: List[str], threshold: float = 0.7) -> Tuple[str, float]:
        """
        Fuzzy matching fallback using difflib.
        Returns (best_match, similarity_score).
        """
        if not candidates:
            return "", 0.0
        
        term_upper = term.upper().strip()
        best_match = ""
        best_score = 0.0
        
        try:
            # Use difflib for fuzzy matching
            matches = difflib.get_close_matches(term_upper, 
                                                 [c.upper() for c in candidates], 
                                                 n=1, 
                                                 cutoff=threshold)
            if matches:
                # Find original case version
                match_upper = matches[0]
                for c in candidates:
                    if c.upper() == match_upper:
                        best_match = c
                        break
                best_score = difflib.SequenceMatcher(None, term_upper, match_upper).ratio()
        except Exception as e:
            logger.error(f"Fuzzy match error: {e}")
        
        return best_match, best_score
    
    def _apply_fuzzy_fallback(self) -> int:
        """Apply fuzzy matching to items with no LLM match."""
        if not hasattr(self, 'conn') or not self.conn:
            return 0
        
        logger.info("Applying fuzzy matching fallback...")
        
        # Get unmatched items
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT DISTINCT original 
            FROM processed_courses 
            WHERE score < 30 OR score IS NULL
        """)
        unmatched = [row[0] for row in cursor.fetchall() if row[0]]
        
        if not unmatched:
            return 0
        
        # Get standards for matching
        standards = list(self.standard_courses) if hasattr(self, 'standard_courses') else []
        if not standards:
            return 0
        
        fuzzy_matched = 0
        for term in unmatched:  # Process ALL unmatched - no limit
            match, score = self._fuzzy_match(term, standards)
            if match and score >= 0.7:
                cursor.execute("""
                    UPDATE processed_courses 
                    SET suggested = ?, score = ?, status = 'Fuzzy Match'
                    WHERE UPPER(TRIM(original)) = ?
                """, (match, int(score * 100), term.upper().strip()))
                fuzzy_matched += cursor.rowcount
        
        self.conn.commit()
        logger.info(f"Fuzzy matched {fuzzy_matched} items")
        return fuzzy_matched
    
    def _get_confidence_color(self, score: int) -> str:
        """Return color hex code based on confidence score."""
        if score >= 80:
            return "#28a745"  # Green
        elif score >= 60:
            return "#17a2b8"  # Blue
        elif score >= 40:
            return "#ffc107"  # Yellow
        else:
            return "#dc3545"  # Red
    
    def _flag_anomalies(self) -> List[Dict]:
        """Auto-detect and flag anomalies for review."""
        if not hasattr(self, 'conn') or not self.conn:
            return []
        
        anomalies = []
        cursor = self.conn.cursor()
        
        # Anomaly 1: Very short normalizations (suspicious)
        cursor.execute("""
            SELECT original, suggested, score 
            FROM processed_courses 
            WHERE LENGTH(suggested) < 3 AND suggested IS NOT NULL AND suggested != ''
        """)
        for row in cursor.fetchall():
            anomalies.append({
                "type": "short_result",
                "original": row[0],
                "suggested": row[1],
                "score": row[2],
                "reason": "Suspiciously short normalized result"
            })
        
        # Anomaly 2: High score but very different from original
        cursor.execute("""
            SELECT original, suggested, score 
            FROM processed_courses 
            WHERE score >= 80 
            AND LENGTH(original) > 10
            AND suggested IS NOT NULL
        """)
        for row in cursor.fetchall():
            orig, sugg, score = row
            if orig and sugg:
                similarity = difflib.SequenceMatcher(None, orig.upper(), sugg.upper()).ratio()
                if similarity < 0.3:  # Very different despite high score
                    anomalies.append({
                        "type": "mismatch",
                        "original": orig,
                        "suggested": sugg,
                        "score": score,
                        "reason": f"High score ({score}) but low similarity ({similarity:.0%})"
                    })
        
        logger.info(f"Found {len(anomalies)} anomalies")
        return anomalies
    
    def show_batch_review(self):
        """Show batch review dialog for uncertain items."""
        if not hasattr(self, 'conn') or not self.conn:
            messagebox.showwarning("No Data", "Load data first.")
            return
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT id, original, suggested, score 
            FROM processed_courses 
            WHERE score >= 40 AND score < 80
            ORDER BY score DESC
            LIMIT 50
        """)
        
        items = cursor.fetchall()
        if not items:
            messagebox.showinfo("No Items", "No items need review!")
            return
        
        # Create review window
        review_win = tk.Toplevel(self.root)
        review_win.title(f"📋 Batch Review ({len(items)} items)")
        review_win.geometry("800x600")
        
        # Create treeview
        tree = ttk.Treeview(review_win, columns=("id", "original", "suggested", "score", "action"), 
                           show="headings", height=20)
        tree.heading("id", text="ID")
        tree.heading("original", text="Original")
        tree.heading("suggested", text="Suggested")
        tree.heading("score", text="Score")
        tree.heading("action", text="Action")
        
        tree.column("id", width=50)
        tree.column("original", width=250)
        tree.column("suggested", width=250)
        tree.column("score", width=60)
        tree.column("action", width=80)
        
        for item in items:
            tree.insert("", "end", values=(item[0], item[1], item[2], item[3], "Pending"))
        
        tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Buttons
        btn_frame = ttk.Frame(review_win)
        btn_frame.pack(fill=tk.X, padx=10, pady=5)
        
        def approve_selected():
            for sel in tree.selection():
                vals = tree.item(sel)["values"]
                if vals:
                    cursor.execute("UPDATE processed_courses SET score = 95, status = 'Approved' WHERE id = ?", (vals[0],))
                    tree.set(sel, "action", "✅ Approved")
            self.conn.commit()
        
        def reject_selected():
            for sel in tree.selection():
                vals = tree.item(sel)["values"]
                if vals:
                    cursor.execute("UPDATE processed_courses SET score = 0, status = 'Rejected' WHERE id = ?", (vals[0],))
                    tree.set(sel, "action", "❌ Rejected")
            self.conn.commit()
        
        ttk.Button(btn_frame, text="✅ Approve Selected", command=approve_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="❌ Reject Selected", command=reject_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Close", command=review_win.destroy).pack(side=tk.RIGHT, padx=5)
    
    def show_progress_details(self):
        """Show detailed progress popup."""
        details_win = tk.Toplevel(self.root)
        details_win.title("📊 Processing Details")
        details_win.geometry("500x400")
        
        # Stats
        stats_text = tk.Text(details_win, wrap=tk.WORD, height=20)
        stats_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Gather stats
        stats_content = f"""
=== 🧠 AI PROCESSING STATISTICS ===

📦 Cache:
  • Cached normalizations: {len(self.llm_cache):,}
  • Learned patterns: {len(self.learned_patterns):,}
  • Corrections recorded: {len(self.correction_history):,}

⚙️ Configuration:
  • Batch size: {self.batch_size_llm} terms/call
  • Chunk size: {self.chunk_size:,} records
  • Page size: {self.page_size:,} rows

📊 Adaptive Thresholds:
  • Auto-match: {self.adaptive_thresholds['auto_match']:.0%}
  • Possible: {self.adaptive_thresholds['possible']:.0%}
  • Reject: {self.adaptive_thresholds['reject']:.0%}

🔄 Processing State:
  • Is running: {self.processing_state.get('is_running', False)}
  • Current chunk: {self.processing_state.get('current_chunk', 0)}
  • Pending terms: {len(self.processing_state.get('pending_terms', []))}

⏱️ Performance:
  • Items/second: {self.items_per_second:.2f}
"""
        
        if hasattr(self, 'conn') and self.conn:
            cursor = self.conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM processed_courses")
            total = cursor.fetchone()[0] or 0
            cursor.execute("SELECT COUNT(*) FROM processed_courses WHERE score >= 80")
            confident = cursor.fetchone()[0] or 0
            stats_content += f"""
📈 Database:
  • Total records: {total:,}
  • Confident (≥80): {confident:,} ({confident/total*100:.1f}% if total > 0 else 0)
"""
        
        stats_text.insert("1.0", stats_content)
        stats_text.config(state=tk.DISABLED)
        
        ttk.Button(details_win, text="Close", command=details_win.destroy).pack(pady=10)


if __name__ == "__main__":
    root = tk.Tk()
    app = AgenticApp(root)
    root.mainloop()
