#!/usr/bin/env python3
"""
AGENTIC LLM VERIFIER - ROBUST VERSION
Multi-model council verification with immediate parallel fallback.

Architecture (based on agentic_matcher.py patterns):
- MODEL_CONFIG: Per-model token limits and priority tiers
- Immediate Parallel Fallback: Failed batches retry INSTANTLY on different model
- Failed Queue: Track and re-dispatch failed batches
- Max 5 attempts per batch before giving up
- Exponential backoff for rate limits

All 9+ models are FREE tier from OpenRouter.
"""

import json
import sqlite3
import logging
import yaml
import time
import queue
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from openrouter_client import OpenRouterClient

logger = logging.getLogger(__name__)
console = Console()


class VerificationVerdict(Enum):
    """Verification verdict from LLM council."""
    APPROVE = "approve"
    REJECT = "reject"
    UNCERTAIN = "uncertain"


@dataclass
class VerificationRecord:
    """A record to verify."""
    record_id: str
    seat_college_name: str
    seat_state: str
    seat_address: Optional[str]
    seat_course_type: Optional[str]
    master_college_id: str
    master_name: str
    master_state: str
    master_address: Optional[str]
    match_score: float
    match_method: Optional[str]
    # Grouping key for batch processing
    group_key: Optional[str] = None
    # For multi-campus conflicts: list of (master_id, master_address) options
    multi_master_options: Optional[List[Tuple[str, str]]] = None


@dataclass
class ModelVote:
    """A vote from a single model."""
    model_name: str
    verdict: VerificationVerdict
    confidence: float
    reason: str
    response_time: float


@dataclass
class VerificationResult:
    """Final verification result with all votes."""
    record_id: str
    final_verdict: VerificationVerdict
    votes: List[ModelVote]
    approve_count: int
    reject_count: int
    group_key: Optional[str] = None


# =====================
# MODEL CONFIGURATION
# =====================
# Per-model configuration with flexible batch sizes and output limits
# Based on OpenRouter research and testing
MODEL_CONFIG = {
    # Priority 0: BEST REASONING - Primary models
    "tngtech/deepseek-r1t-chimera:free": {
        "max_tokens": 16384,
        "batch_size": 10,
        "timeout": 120,
        "priority": 0,
        "description": "DeepSeek R1T - Best o1-level reasoning"
    },
    "allenai/olmo-3-32b-think:free": {
        "max_tokens": 65536,
        "batch_size": 5,
        "timeout": 300,
        "priority": 0,
        "description": "OLMo Think - Deep reasoning model"
    },
    "openai/gpt-oss-120b:free": {
        "max_tokens": 8192,
        "batch_size": 15,
        "timeout": 120,
        "priority": 0,
        "description": "GPT OSS 120B - High quality"
    },
    "qwen/qwen3-235b-a22b:free": {
        "max_tokens": 8000,
        "batch_size": 6,
        "timeout": 120,
        "priority": 0,
        "description": "Qwen3 235B - Massive model"
    },
    
    # Priority 1: QUALITY - Fallback tier 1
    "google/gemini-2.0-flash-exp:free": {
        "max_tokens": 8000,
        "batch_size": 10,
        "timeout": 90,
        "priority": 1,
        "description": "Gemini 2.0 Flash - Google quality"
    },
    "kwaipilot/kat-coder-pro:free": {
        "max_tokens": 32768,
        "batch_size": 12,
        "timeout": 90,
        "priority": 1,
        "description": "Kat Coder Pro - Strong coder"
    },
    "openai/gpt-oss-20b:free": {
        "max_tokens": 8192,
        "batch_size": 8,
        "timeout": 60,
        "priority": 1,
        "description": "GPT OSS 20B - Quality"
    },
    "meta-llama/llama-3.3-70b-instruct:free": {
        "max_tokens": 8192,
        "batch_size": 15,
        "timeout": 90,
        "priority": 1,
        "description": "Llama 3.3 70B - Fast and quality"
    },
    
    # Priority 2: CAPACITY - Fallback tier 2
    "qwen/qwen3-coder:free": {
        "max_tokens": 65536,
        "batch_size": 12,
        "timeout": 120,
        "priority": 2,
        "description": "Qwen3 Coder - Code specialist"
    },
    "amazon/nova-2-lite-v1:free": {
        "max_tokens": 65536,
        "batch_size": 15,
        "timeout": 120,
        "priority": 2,
        "description": "Nova 2 Lite - High capacity"
    },
    "mistralai/mistral-small-3.1-24b-instruct:free": {
        "max_tokens": 16384,
        "batch_size": 8,
        "timeout": 90,
        "priority": 2,
        "description": "Mistral Small - Fast fallback"
    },
    "z-ai/glm-4.5-air:free": {
        "max_tokens": 8192,
        "batch_size": 6,
        "timeout": 60,
        "priority": 2,
        "description": "GLM 4.5 Air - Last fallback"
    },
}

# Default settings (can be overridden by config.yaml)
DEFAULT_VERIFIER_CONFIG = {
    "default_batch_size": 20,       # Groups per batch (increased from 10 to 20)
    "default_timeout": 60,          # Seconds
    "max_retries": 3,               # Retries per batch
    "rate_limit_delay": 2.0,        # Base delay for 429 errors (exponential backoff)
    "parallel_workers": 22,         # Number of parallel API clients (match API keys)
    "parallel_pipelines": 7,        # Number of consensus pipelines to run in parallel
    "models_per_pipeline": 3,       # Models voting per pipeline
}

# Ordered list of models by priority
WORKER_MODELS = sorted(MODEL_CONFIG.keys(), key=lambda m: MODEL_CONFIG[m]["priority"])


class AgenticVerifier:
    """
    Agentic LLM Verifier with robust parallel processing.
    
    Features:
    - Immediate parallel fallback on failure
    - Model-specific token limits
    - Failed batch queue with instant retry
    - Max 5 attempts per record before giving up
    - Exponential backoff for rate limits
    """
    
    SYSTEM_PROMPT = """You are an expert match verification specialist for Indian medical/dental colleges.

Your task: VERIFY if a matched pair (seat record → master college) is CORRECT.

VERIFICATION CHECKLIST:
1. CONSIDER NAME + ADDRESS TOGETHER: The complete institution name may be split across college_name and address fields
   (e.g., "SETH GS MEDICAL COLLEGE" + address "AND KEM HOSPITAL" = "SETH GS MEDICAL COLLEGE AND KEM HOSPITAL")
2. STATE MATCH: Seat state must match master college state (ORISSA=ODISHA, CHATTISGARH=CHHATTISGARH are same)
3. NAME SIMILARITY: College names should be similar (ignore minor variations, abbreviations)
4. STREAM MATCH: Medical courses → Medical colleges, Dental → Dental

RESPOND WITH EXACTLY THIS JSON FORMAT:
{
  "verdict": "APPROVE" or "REJECT",
  "confidence": 0.0 to 1.0,
  "reason": "Brief explanation"
}

RULES:
- APPROVE if this is fundamentally THE SAME institution (even if name was split across fields)
- APPROVE only if 90%+ confident
- REJECT only if clearly DIFFERENT institutions
- Always respond with valid JSON"""

    # Batch verification prompt for multiple groups in one call
    BATCH_SYSTEM_PROMPT = """You are an expert match verification specialist for Indian medical/dental colleges.

Your task: VERIFY if each matched pair (seat record → master college) is CORRECT.

VERIFICATION CHECKLIST (apply to each):
1. CONSIDER NAME + ADDRESS TOGETHER: The complete name may be split across fields
   (e.g., "SETH GS MEDICAL COLLEGE" + address "AND KEM HOSPITAL" = same as "SETH GS MEDICAL COLLEGE AND KEM HOSPITAL")
2. STATE MATCH: States must match (ORISSA=ODISHA, CHATTISGARH=CHHATTISGARH are same)
3. NAME SIMILARITY: Ignore minor variations, abbreviations (GOVT=GOVERNMENT, HOSP=HOSPITAL)
4. STREAM MATCH: Medical courses → Medical colleges, Dental → Dental

RESPOND WITH A JSON ARRAY - one object per group:
[
  {"group_id": "GROUP_001", "verdict": "APPROVE", "confidence": 0.95, "reason": "States match, name+address = master name"},
  {"group_id": "GROUP_002", "verdict": "REJECT", "confidence": 0.3, "reason": "Different institution"},
  ...
]

RULES:
- APPROVE if this is fundamentally THE SAME institution
- APPROVE only if 90%+ confident
- REJECT only if clearly DIFFERENT institutions
- Return verdict for EVERY group in the input"""

    def __init__(
        self,
        seat_db_path: str = 'data/sqlite/seat_data.db',
        master_db_path: str = 'data/sqlite/master_data.db',
        config_path: str = 'config.yaml',
        api_keys: Optional[List[str]] = None,
        timeout: Optional[float] = None,  # None = use config
    ):
        self.seat_db_path = seat_db_path
        self.master_db_path = master_db_path
        
        # Load verifier config from config.yaml (or use defaults)
        self.config = self._load_verifier_config(config_path)
        self.timeout = timeout or self.config.get('default_timeout', DEFAULT_VERIFIER_CONFIG['default_timeout'])
        self.default_batch_size = self.config.get('default_batch_size', DEFAULT_VERIFIER_CONFIG['default_batch_size'])
        self.max_retries = self.config.get('max_retries', DEFAULT_VERIFIER_CONFIG['max_retries'])
        self.rate_limit_delay = self.config.get('rate_limit_delay', DEFAULT_VERIFIER_CONFIG['rate_limit_delay'])
        
        # Load API keys from config.yaml
        self.api_keys = api_keys or self._load_api_keys(config_path)
        
        if not self.api_keys:
            raise ValueError("No API keys found. Set in config.yaml under agentic_matcher.api_keys")
        
        # Create clients for parallel processing (one per API key)
        self.clients = []
        for key in self.api_keys:
            try:
                self.clients.append(OpenRouterClient(api_key=key, timeout=self.timeout))
            except Exception as e:
                logger.warning(f"Failed to create client: {e}")
        
        console.print(f"[green]✅ Initialized {len(self.clients)} API clients[/green]")
        
        # Stats
        self.stats = {
            'verified': 0,
            'approved': 0,
            'rejected': 0,
            'model_calls': 0,
            'model_failures': 0,
            'retries': 0,
        }
    
    def _load_api_keys(self, config_path: str) -> List[str]:
        """Load API keys from config.yaml."""
        try:
            with open(config_path) as f:
                config = yaml.safe_load(f)
                return config.get('agentic_matcher', {}).get('api_keys', [])
        except:
            return []
    
    def _load_verifier_config(self, config_path: str) -> Dict[str, Any]:
        """Load verifier configuration from config.yaml.
        
        Expected config.yaml section:
        agentic_verifier:
          defaults:
            timeout: 60
            max_retries: 3
            rate_limit_delay: 2.0
            parallel_workers: 11
          models:
            google/gemini-2.0-flash-exp:free:
              batch_size: 5
              timeout: 60
          batch_optimization:
            default_batch_size: 5
            min_batch_size: 3
            max_batch_size: 20
        """
        try:
            with open(config_path) as f:
                config = yaml.safe_load(f)
                verifier_config = config.get('agentic_verifier', {})
                
                # Merge model-specific configs from yaml into MODEL_CONFIG
                yaml_models = verifier_config.get('models', {})
                for model_name, model_cfg in yaml_models.items():
                    if model_name in MODEL_CONFIG:
                        # Update existing model config
                        MODEL_CONFIG[model_name].update(model_cfg)
                    else:
                        # Add new model config
                        MODEL_CONFIG[model_name] = model_cfg
                
                return verifier_config
        except Exception:
            return {}
    
    def _build_verification_prompt(self, record: VerificationRecord) -> str:
        """Build the verification prompt for a single record."""
        return f"""VERIFY THIS MATCH:

SEAT RECORD (Source):
- College Name: {record.seat_college_name}
- State: {record.seat_state}
- Address: {record.seat_address or 'N/A'}
- Course Type: {record.seat_course_type or 'N/A'}

MATCHED TO MASTER ({record.master_college_id}):
- College Name: {record.master_name}
- State: {record.master_state}
- Address: {record.master_address or 'N/A'}

MATCH INFO:
- Score: {record.match_score:.2f}
- Method: {record.match_method or 'N/A'}

IMPORTANT RULES:
1. Consider COLLEGE NAME + ADDRESS TOGETHER as the complete institution name
   (e.g., "SETH GS MEDICAL COLLEGE" + address "AND KEM HOSPITAL" = "SETH GS MEDICAL COLLEGE AND KEM HOSPITAL")
2. State spelling variations are OK (ORISSA=ODISHA, CHATTISGARH=CHHATTISGARH)
3. Minor abbreviation differences are OK (GOVT=GOVERNMENT, HOSP=HOSPITAL)
4. Focus on whether this is fundamentally THE SAME institution

Is this match CORRECT? Analyze step-by-step considering name+address, then respond with JSON."""

    def _parse_verdict(self, content: str) -> Tuple[VerificationVerdict, float, str]:
        """Parse LLM response into verdict."""
        try:
            # Extract JSON from response
            import re
            
            # Try multiple patterns to find JSON
            patterns = [
                r'```json\s*(.*?)\s*```',
                r'```\s*(.*?)\s*```',
                r'\{[^{}]*"verdict"[^{}]*\}',
            ]
            
            json_str = None
            for pattern in patterns:
                match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
                if match:
                    json_str = match.group(1) if '```' in pattern else match.group()
                    break
            
            if not json_str:
                # Try to parse the whole content as JSON
                json_str = content.strip()
            
            data = json.loads(json_str)
            
            verdict_str = data.get('verdict', 'REJECT').upper()
            if verdict_str == 'APPROVE':
                verdict = VerificationVerdict.APPROVE
            elif verdict_str == 'UNCERTAIN':
                verdict = VerificationVerdict.UNCERTAIN
            else:
                verdict = VerificationVerdict.REJECT
            
            confidence = float(data.get('confidence', 0.5))
            reason = data.get('reason', 'No reason provided')
            
            return verdict, confidence, reason
            
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.debug(f"Parse error: {e}, content: {content[:100]}")
            # Default to REJECT if parsing fails (conservative)
            return VerificationVerdict.REJECT, 0.5, f"Parse error"
    
    def _verify_single_record(
        self, 
        record: VerificationRecord, 
        model: str,
        client_idx: int,
    ) -> Tuple[VerificationResult, Dict]:
        """
        Verify a single record with ONE model.
        Returns (result, info) where info contains success/error status.
        """
        model_config = MODEL_CONFIG.get(model, {"max_tokens": 4096})
        max_tokens = min(model_config.get("max_tokens", 4096), 4096)  # Cap at 4K for verification
        
        start_time = time.time()
        
        try:
            client = self.clients[client_idx % len(self.clients)]
            prompt = self._build_verification_prompt(record)
            
            response = client.complete(
                messages=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                model=model,
                temperature=0.1,
                max_tokens=max_tokens,
            )
            
            self.stats['model_calls'] += 1
            verdict, confidence, reason = self._parse_verdict(response.content)
            response_time = time.time() - start_time
            
            vote = ModelVote(
                model_name=model.split('/')[-1].split(':')[0],
                verdict=verdict,
                confidence=confidence,
                reason=reason,
                response_time=response_time,
            )
            
            result = VerificationResult(
                record_id=record.record_id,
                final_verdict=verdict,
                votes=[vote],
                approve_count=1 if verdict == VerificationVerdict.APPROVE else 0,
                reject_count=1 if verdict == VerificationVerdict.REJECT else 0,
                group_key=record.group_key,
            )
            
            return result, {"model": model, "success": True}
            
        except Exception as e:
            self.stats['model_failures'] += 1
            error_str = str(e)
            
            # Categorize error for smart retry
            if "429" in error_str:
                error_code = "429"
            elif "401" in error_str:
                error_code = "401"
            elif "503" in error_str:
                error_code = "503"
            elif "timeout" in error_str.lower():
                error_code = "timeout"
            else:
                error_code = "error"
            
            logger.debug(f"Model {model} failed ({error_code}): {error_str[:50]}")
            
            # Return None result to signal failure
            return None, {"model": model, "success": False, "error": error_code}
    
    def verify_batch_parallel(
        self,
        records: List[VerificationRecord],
        max_attempts: int = 5,  # Try up to 5 different models per record
    ) -> List[VerificationResult]:
        """
        Verify records using immediate parallel fallback pattern.
        
        Pattern from agentic_matcher.py:
        - Submit all records to parallel workers
        - Failed records immediately retry with different model
        - Max 5 attempts per record before giving up
        """
        if not records:
            return []
        
        num_workers = min(len(self.clients), len(records))
        
        console.print(Panel.fit(
            f"[bold cyan]🤖 AGENTIC LLM VERIFIER[/bold cyan]\n"
            f"Records to verify: {len(records)}\n"
            f"Models available: {len(WORKER_MODELS)}\n"
            f"Parallel workers: {num_workers}\n"
            f"Max attempts/record: {max_attempts}",
            border_style="cyan"
        ))
        
        results: Dict[str, VerificationResult] = {}
        models_tried: Dict[str, Set[str]] = {r.record_id: set() for r in records}
        invalid_clients: Set[int] = set()  # Track clients with 401 errors
        pending_records = list(records)
        
        console.print(f"\n[green]🔄 Using PARALLEL FALLBACK with rate limit handling[/green]")
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
            console=console,
        ) as progress:
            task = progress.add_task("Verifying...", total=len(records))
            
            with ThreadPoolExecutor(max_workers=num_workers) as executor:
                # Submit initial jobs with small stagger to avoid immediate rate limit
                futures = {}
                for i, record in enumerate(pending_records):
                    model = WORKER_MODELS[i % len(WORKER_MODELS)]
                    client_idx = i % len(self.clients)
                    
                    # Skip invalid clients
                    while client_idx in invalid_clients and len(invalid_clients) < len(self.clients):
                        client_idx = (client_idx + 1) % len(self.clients)
                    
                    models_tried[record.record_id].add(model)
                    future = executor.submit(
                        self._verify_single_record, 
                        record, 
                        model, 
                        client_idx
                    )
                    futures[future] = (record, client_idx)
                    
                    # Small stagger to avoid rate limit burst
                    if i > 0 and i % 5 == 0:
                        time.sleep(0.2)
                
                while futures:
                    done_futures = []
                    
                    for future in as_completed(futures):
                        record, used_client_idx = futures[future]
                        result, info = future.result()
                        
                        if info.get("success") and result:
                            # Success! Store result
                            results[record.record_id] = result
                            progress.advance(task)
                            
                            emoji = "✅" if result.final_verdict == VerificationVerdict.APPROVE else "❌"
                            model_short = info["model"].split("/")[-1].split(":")[0][:12]
                            console.print(f"   {emoji} {record.record_id[:20]}: {result.final_verdict.value} ({model_short})")
                        else:
                            # Track 401 invalid clients
                            error_code = info.get("error", "?")
                            if error_code == "401":
                                invalid_clients.add(used_client_idx)
                                console.print(f"   [red]⚠ Client {used_client_idx} invalid (401), skipping[/red]")
                            
                            # Failed - find next untried model
                            tried = models_tried[record.record_id]
                            next_model = None
                            
                            for m in WORKER_MODELS:
                                if m not in tried and len(tried) < max_attempts:
                                    next_model = m
                                    break
                            
                            if next_model:
                                # Add delay for rate limit errors (exponential backoff)
                                error_code = info.get("error", "?")
                                if error_code == "429":
                                    delay = min(2 ** (len(tried) - 1), 8)  # 1, 2, 4, 8 seconds max
                                    time.sleep(delay)
                                elif error_code == "timeout":
                                    time.sleep(1)  # Brief delay for timeouts
                                
                                # RETRY with different model, skip invalid clients
                                self.stats['retries'] += 1
                                models_tried[record.record_id].add(next_model)
                                
                                # Pick valid client
                                new_client_idx = len(tried) % len(self.clients)
                                while new_client_idx in invalid_clients and len(invalid_clients) < len(self.clients):
                                    new_client_idx = (new_client_idx + 1) % len(self.clients)
                                
                                new_future = executor.submit(
                                    self._verify_single_record,
                                    record,
                                    next_model,
                                    new_client_idx
                                )
                                futures[new_future] = (record, new_client_idx)
                                
                                console.print(f"   [yellow]↻ {record.record_id[:20]}: retry {len(tried)+1}/{max_attempts} ({error_code})[/yellow]")
                            else:
                                # Exhausted all attempts - mark as REJECT (conservative)
                                results[record.record_id] = VerificationResult(
                                    record_id=record.record_id,
                                    final_verdict=VerificationVerdict.REJECT,
                                    votes=[],
                                    approve_count=0,
                                    reject_count=1,
                                    group_key=record.group_key,
                                )
                                progress.advance(task)
                                console.print(f"   [red]✗ {record.record_id[:20]}: All {max_attempts} models failed[/red]")
                        
                        done_futures.append(future)
                    
                    # Remove completed futures
                    for f in done_futures:
                        del futures[f]
        
        # Compile final results
        final_results = [results[r.record_id] for r in records if r.record_id in results]
        
        # Update stats
        for r in final_results:
            self.stats['verified'] += 1
            if r.final_verdict == VerificationVerdict.APPROVE:
                self.stats['approved'] += 1
            else:
                self.stats['rejected'] += 1
        
        # Print summary
        self._print_summary(final_results)
        
        return final_results
    
    def verify_batch_groups(
        self,
        records: List[VerificationRecord],
        groups_per_batch: Optional[int] = None,  # None = use config
        max_attempts: Optional[int] = None,      # None = use config
    ) -> List[VerificationResult]:
        """
        Verify groups in batches - multiple groups per API call.
        
        Uses flexible configuration from config.yaml:
        - groups_per_batch: defaults from self.default_batch_size (or MODEL_CONFIG)
        - max_attempts: defaults from self.max_retries
        - timeout: model-specific from MODEL_CONFIG
        """
        if not records:
            return []
        
        # Use instance defaults if not specified
        batch_size = groups_per_batch or self.default_batch_size
        retries = max_attempts or self.max_retries
        
        num_batches = (len(records) + batch_size - 1) // batch_size
        
        console.print(Panel.fit(
            f"[bold cyan]🤖 BATCHED GROUP VERIFIER[/bold cyan]\n"
            f"Groups to verify: {len(records)}\n"
            f"Batch size: {batch_size}\n"
            f"Total batches: {num_batches}\n"
            f"Max attempts/batch: {retries}\n"
            f"Timeout: {self.timeout}s",
            border_style="cyan"
        ))
        
        results: Dict[str, VerificationResult] = {}
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
            console=console,
        ) as progress:
            task = progress.add_task("Verifying batches...", total=num_batches)
            
            for batch_idx in range(num_batches):
                start = batch_idx * batch_size
                end = min(start + batch_size, len(records))
                batch = records[start:end]
                
                # Try batch verification with flexible retries
                batch_results = self._verify_batch_once(batch, retries)
                
                for record_id, result in batch_results.items():
                    results[record_id] = result
                    
                    emoji = "✅" if result.final_verdict == VerificationVerdict.APPROVE else "❌"
                    console.print(f"   {emoji} {record_id}: {result.final_verdict.value}")
                
                progress.advance(task)
        
        final_results = [results[r.record_id] for r in records if r.record_id in results]
        
        # Fallback for any missed records
        for r in records:
            if r.record_id not in results:
                final_results.append(VerificationResult(
                    record_id=r.record_id,
                    final_verdict=VerificationVerdict.REJECT,
                    votes=[],
                    approve_count=0,
                    reject_count=1,
                    group_key=r.group_key,
                ))
        
        self._print_summary(final_results)
        return final_results
    
    def verify_with_consensus(
        self,
        records: List[VerificationRecord],
        required_votes: int = 3,
        groups_per_batch: Optional[int] = None,
    ) -> List[VerificationResult]:
        """
        Multi-model consensus verification with PARALLEL execution.
        
        Gets votes from MULTIPLE DIFFERENT models for each group IN PARALLEL.
        Uses majority voting (2/3 agree) to decide final verdict.
        
        Args:
            records: Groups to verify
            required_votes: Number of model votes needed (default 3)
            groups_per_batch: Groups per API call
            
        Returns:
            List of VerificationResult with consensus verdicts
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import random
        
        if not records:
            return []
        
        batch_size = groups_per_batch or self.default_batch_size
        
        # Select models for consensus (pick top N by priority)
        available_models = list(WORKER_MODELS)
        random.shuffle(available_models)  # Randomize to distribute load
        selected_models = available_models[:required_votes + 2]  # Extra for fallback
        
        console.print(Panel.fit(
            f"[bold magenta]🤝 PARALLEL MULTI-MODEL CONSENSUS[/bold magenta]\n"
            f"Groups to verify: {len(records)}\n"
            f"Models voting in parallel: {required_votes}\n"
            f"Selected models: {', '.join(m.split('/')[-1][:15] for m in selected_models[:required_votes])}\n"
            f"Batch size: {batch_size}",
            border_style="magenta"
        ))
        
        # Track votes per group
        group_votes: Dict[str, List[ModelVote]] = {r.record_id: [] for r in records}
        
        def verify_with_model(model: str) -> Dict[str, VerificationResult]:
            """Worker function to verify all records with one model."""
            return self._verify_batch_with_model(records, model, batch_size)
        
        # Run all models in PARALLEL
        console.print(f"  [cyan]⚡ Running {required_votes} models in parallel...[/cyan]")
        
        with ThreadPoolExecutor(max_workers=min(required_votes, len(self.clients))) as executor:
            # Submit all model verification tasks
            futures = {}
            for i, model in enumerate(selected_models[:required_votes]):
                future = executor.submit(verify_with_model, model)
                futures[future] = model
            
            # Collect results as they complete
            completed = 0
            for future in as_completed(futures):
                model = futures[future]
                model_short = model.split('/')[-1][:20]
                try:
                    results = future.result()
                    completed += 1
                    
                    if results:
                        # Collect votes from this model
                        for record_id, result in results.items():
                            if result.votes:
                                vote = result.votes[0]
                                group_votes[record_id].append(vote)
                        
                        console.print(f"    ✓ Model {completed}/{required_votes}: [green]{model_short}[/green] → {len(results)} votes")
                    else:
                        console.print(f"    ✗ Model {completed}/{required_votes}: [yellow]{model_short}[/yellow] → Failed/empty")
                        
                except Exception as e:
                    completed += 1
                    console.print(f"    ✗ Model {completed}/{required_votes}: [red]{model_short}[/red] → Error: {str(e)[:50]}")
        
        # Check if we need more votes (fallback for failed models)
        groups_needing_votes = [r for r in records if len(group_votes[r.record_id]) < required_votes]
        models_already_used = set(selected_models[:required_votes])  # Track used models
        
        # Use ALL remaining models as fallback - keep trying until 3 votes achieved
        all_fallback_models = [m for m in WORKER_MODELS if m not in models_already_used]
        
        if groups_needing_votes:
            console.print(f"  [yellow]⚠ {len(groups_needing_votes)} groups need more votes, running fallback...[/yellow]")
            console.print(f"    Available fallback models: {len(all_fallback_models)}")
            
            for fallback_model in all_fallback_models:
                # Check if any groups still need votes
                groups_needing_votes = [r for r in records if len(group_votes[r.record_id]) < required_votes]
                
                if not groups_needing_votes:
                    console.print(f"    [green]✓ All groups have {required_votes} votes, stopping fallback[/green]")
                    break
                    
                model_short = fallback_model.split('/')[-1][:20]
                console.print(f"    → Fallback: {model_short} ({len(groups_needing_votes)} groups need votes)")
                
                results = self._verify_batch_with_model(groups_needing_votes, fallback_model, batch_size)
                
                votes_collected = 0
                for record_id, result in results.items():
                    if result.votes:
                        group_votes[record_id].append(result.votes[0])
                        votes_collected += 1
                
                if votes_collected > 0:
                    console.print(f"      ✓ Got {votes_collected} votes from {model_short}")
                else:
                    console.print(f"      ✗ {model_short} returned no votes")
                
                models_already_used.add(fallback_model)
        
        # Final check - log how many votes each group got
        vote_counts = [len(group_votes[r.record_id]) for r in records]
        min_votes = min(vote_counts) if vote_counts else 0
        max_votes = max(vote_counts) if vote_counts else 0
        avg_votes = sum(vote_counts) / len(vote_counts) if vote_counts else 0
        console.print(f"  Vote stats: min={min_votes}, max={max_votes}, avg={avg_votes:.1f}")
        
        # Calculate consensus for each group
        final_results = []
        for record in records:
            votes = group_votes[record.record_id]
            approve_count = sum(1 for v in votes if v.verdict == VerificationVerdict.APPROVE)
            reject_count = sum(1 for v in votes if v.verdict == VerificationVerdict.REJECT)
            
            # Majority voting with proper no-vote handling
            if len(votes) == 0:
                # No votes - default to REJECT (conservative)
                final_verdict = VerificationVerdict.REJECT
                console.print(f"   ⚠️ {record.record_id}: No votes received - defaulting to REJECT")
            elif approve_count > reject_count:
                final_verdict = VerificationVerdict.APPROVE
            elif reject_count > approve_count:
                final_verdict = VerificationVerdict.REJECT
            else:
                # Tie - default to APPROVE (benefit of doubt)
                final_verdict = VerificationVerdict.APPROVE
            
            final_results.append(VerificationResult(
                record_id=record.record_id,
                final_verdict=final_verdict,
                votes=votes,
                approve_count=approve_count,
                reject_count=reject_count,
                group_key=record.group_key,
            ))
            
            # Show vote breakdown
            emoji = "✅" if final_verdict == VerificationVerdict.APPROVE else "❌"
            vote_str = f"[{approve_count}A/{reject_count}R]"
            console.print(f"   {emoji} {record.record_id}: {final_verdict.value} {vote_str}")
        
        self._print_consensus_summary(final_results)
        return final_results
    
    def verify_with_super_parallel(
        self,
        records: List[VerificationRecord],
        required_votes: int = 3,
        groups_per_batch: int = 10,
        parallel_pipelines: int = 7,
    ) -> List[VerificationResult]:
        """
        SUPER-PARALLEL Multi-model consensus verification.
        
        Runs MULTIPLE consensus pipelines IN PARALLEL, each processing different batches.
        With 22 API keys and 3 models per pipeline, we can run 7 parallel pipelines.
        
        Architecture:
        - Split records into batches of `groups_per_batch` (default 10)
        - Run `parallel_pipelines` (default 7) consensus sessions simultaneously
        - Each session uses `required_votes` (default 3) models to vote
        - Majority voting (2/3) determines final verdict
        
        Speedup: ~14x faster than sequential (7 parallel × 2 from larger batches)
        
        Args:
            records: Groups to verify
            required_votes: Number of model votes per group (default 3)
            groups_per_batch: Groups per API call (default 10)
            parallel_pipelines: Number of parallel consensus sessions (default 7)
            
        Returns:
            List of VerificationResult with consensus verdicts
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import random
        import math
        
        if not records:
            return []
        
        # Split records into batches
        batches = []
        for i in range(0, len(records), groups_per_batch):
            batches.append(records[i:i + groups_per_batch])
        
        num_batches = len(batches)
        
        # Available models (shuffled to distribute load)
        available_models = list(WORKER_MODELS)
        random.shuffle(available_models)
        
        console.print(Panel.fit(
            f"[bold magenta]⚡ SUPER-PARALLEL MULTI-MODEL CONSENSUS ⚡[/bold magenta]\n"
            f"Groups to verify: {len(records)}\n"
            f"Batch size: {groups_per_batch} groups/batch\n"
            f"Total batches: {num_batches}\n"
            f"Parallel pipelines: {parallel_pipelines}\n"
            f"Models per pipeline: {required_votes}\n"
            f"Expected rounds: {math.ceil(num_batches / parallel_pipelines)}",
            border_style="magenta"
        ))
        
        # Track votes per group (thread-safe via immutable key access)
        group_votes: Dict[str, List[ModelVote]] = {r.record_id: [] for r in records}
        votes_lock = threading.Lock()
        
        def process_batch_with_consensus(batch_idx: int, batch: List[VerificationRecord]) -> Dict[str, List[ModelVote]]:
            """
            Process a single batch with multi-model consensus.
            Returns dict of record_id -> list of ModelVote.
            
            ENHANCED: Tries up to 6 models (required_votes + 3 fallback) to ensure
            each group gets sufficient votes, rather than only trying 3 models.
            """
            batch_votes: Dict[str, List[ModelVote]] = {r.record_id: [] for r in batch}
            
            # Calculate how many models we need to try (primary + fallback)
            max_models_to_try = required_votes + 3  # Try up to 6 models per batch
            
            # Select models for this batch (rotate through available)
            start_model_idx = (batch_idx * required_votes) % len(available_models)
            models_to_try = []
            for i in range(max_models_to_try):
                model_idx = (start_model_idx + i) % len(available_models)
                models_to_try.append(available_models[model_idx])
            
            # Track how many votes we've collected
            votes_collected = 0
            models_tried = 0
            
            # Keep trying models until we have enough votes or run out of models
            for model in models_to_try:
                if votes_collected >= required_votes:
                    break  # Got enough votes, stop
                
                models_tried += 1
                
                try:
                    results = self._verify_batch_with_model(batch, model, groups_per_batch)
                    
                    # Count how many new votes we got from this model
                    new_votes = 0
                    for record_id, result in results.items():
                        if result.votes and record_id in batch_votes:
                            batch_votes[record_id].append(result.votes[0])
                            new_votes += 1
                    
                    if new_votes > 0:
                        votes_collected += 1  # This model contributed votes
                        
                except Exception as e:
                    logger.debug(f"Batch {batch_idx} model {model} failed: {e}")
                    continue
            
            return batch_votes
        
        # Process all batches in parallel pipelines
        console.print(f"  [cyan]⚡ Processing {num_batches} batches with {parallel_pipelines} parallel pipelines...[/cyan]")
        
        all_batch_votes: Dict[str, List[ModelVote]] = {}
        completed_batches = 0
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total}"),
            console=console,
        ) as progress:
            task = progress.add_task("Consensus voting...", total=num_batches)
            
            with ThreadPoolExecutor(max_workers=parallel_pipelines) as executor:
                # Submit all batches
                futures = {}
                for batch_idx, batch in enumerate(batches):
                    future = executor.submit(process_batch_with_consensus, batch_idx, batch)
                    futures[future] = batch_idx
                
                # Collect results as they complete
                for future in as_completed(futures):
                    batch_idx = futures[future]
                    try:
                        batch_votes = future.result()
                        
                        # Merge votes into global tracker
                        with votes_lock:
                            for record_id, votes in batch_votes.items():
                                if record_id in group_votes:
                                    group_votes[record_id].extend(votes)
                        
                        completed_batches += 1
                        progress.advance(task)
                        
                    except Exception as e:
                        logger.error(f"Batch {batch_idx} failed: {e}")
                        progress.advance(task)
        
        # Report vote statistics
        vote_counts = [len(group_votes[r.record_id]) for r in records]
        min_votes = min(vote_counts) if vote_counts else 0
        max_votes = max(vote_counts) if vote_counts else 0
        avg_votes = sum(vote_counts) / len(vote_counts) if vote_counts else 0
        groups_with_3_votes = sum(1 for c in vote_counts if c >= required_votes)
        
        console.print(f"  [green]✓ Completed {completed_batches}/{num_batches} batches[/green]")
        console.print(f"  Vote stats: min={min_votes}, max={max_votes}, avg={avg_votes:.1f}, with_3+={groups_with_3_votes}")
        
        # Fallback: Groups that didn't get enough votes
        groups_needing_votes = [r for r in records if len(group_votes[r.record_id]) < required_votes]
        
        if groups_needing_votes:
            console.print(f"  [yellow]⚠ {len(groups_needing_votes)} groups need fallback votes...[/yellow]")
            
            # Use remaining models as fallback
            used_models = set()
            for r in records:
                for vote in group_votes[r.record_id]:
                    used_models.add(vote.model_name)
            
            fallback_models = [m for m in available_models if m.split('/')[-1][:20] not in used_models]
            
            # PARALLELIZED FALLBACK: Process batches in parallel across multiple models
            # Split groups into batches for parallel processing
            fallback_batch_size = groups_per_batch * 3  # Larger batches for efficiency (30 groups per batch)
            fallback_batches = []
            for i in range(0, len(groups_needing_votes), fallback_batch_size):
                fallback_batches.append(groups_needing_votes[i:i + fallback_batch_size])
            
            console.print(f"    → Parallel fallback: {len(fallback_batches)} batches × {min(len(fallback_models), parallel_pipelines)} workers")
            
            def process_fallback_batch(batch_idx: int, batch: List, model: str) -> Dict:
                """Process a fallback batch with a specific model."""
                results = {}
                try:
                    batch_results = self._verify_batch_with_model(batch, model, groups_per_batch)
                    for record_id, result in batch_results.items():
                        if result.votes:
                            results[record_id] = result.votes[0]
                except Exception as e:
                    logger.debug(f"Fallback batch {batch_idx} with {model} failed: {e}")
                return results
            
            # Process fallback batches in parallel with progress bar
            fallback_completed = 0
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("{task.completed}/{task.total}"),
                console=console,
            ) as progress:
                fallback_task = progress.add_task("Fallback voting...", total=len(fallback_batches))
                
                with ThreadPoolExecutor(max_workers=min(parallel_pipelines, len(self.clients))) as executor:
                    futures = {}
                    for batch_idx, batch in enumerate(fallback_batches):
                        # Rotate through fallback models
                        model = fallback_models[batch_idx % len(fallback_models)] if fallback_models else available_models[0]
                        future = executor.submit(process_fallback_batch, batch_idx, batch, model)
                        futures[future] = batch_idx
                    
                    for future in as_completed(futures):
                        batch_idx = futures[future]
                        try:
                            batch_votes_result = future.result()
                            # Merge votes into global tracker
                            with votes_lock:
                                for record_id, vote in batch_votes_result.items():
                                    if record_id in group_votes:
                                        group_votes[record_id].append(vote)
                            fallback_completed += 1
                        except Exception as e:
                            logger.debug(f"Fallback batch {batch_idx} failed: {e}")
                        progress.advance(fallback_task)
            
            # Report final fallback stats
            final_needing = sum(1 for r in groups_needing_votes if len(group_votes[r.record_id]) < required_votes)
            console.print(f"    [green]✓ Fallback complete: {len(groups_needing_votes) - final_needing}/{len(groups_needing_votes)} groups got votes[/green]")
        
        # Calculate consensus for each group
        console.print(f"\n  [cyan]📊 Calculating consensus verdicts...[/cyan]")
        final_results = []
        approve_total = 0
        reject_total = 0
        hybrid_fallback_count = 0
        
        for record in records:
            votes = group_votes[record.record_id]
            approve_count = sum(1 for v in votes if v.verdict == VerificationVerdict.APPROVE)
            reject_count = sum(1 for v in votes if v.verdict == VerificationVerdict.REJECT)
            
            # Majority voting with HYBRID SCORING FALLBACK
            if len(votes) == 0:
                # FALLBACK: Use hybrid scoring when LLM fails
                fallback_result = self._hybrid_scoring_fallback(record)
                final_verdict = fallback_result['verdict']
                hybrid_fallback_count += 1
                
                # Create synthetic vote for audit trail
                fallback_vote = ModelVote(
                    model_name='hybrid_scoring_fallback',
                    verdict=final_verdict,
                    confidence=fallback_result['confidence'],
                    reason=fallback_result['reason'],
                    response_time=0.0,
                )
                votes = [fallback_vote]
                approve_count = 1 if final_verdict == VerificationVerdict.APPROVE else 0
                reject_count = 1 if final_verdict == VerificationVerdict.REJECT else 0
                
                if final_verdict == VerificationVerdict.APPROVE:
                    approve_total += 1
                else:
                    reject_total += 1
                    
            elif approve_count > reject_count:
                final_verdict = VerificationVerdict.APPROVE
                approve_total += 1
            elif reject_count > approve_count:
                final_verdict = VerificationVerdict.REJECT
                reject_total += 1
            else:
                # Tie - benefit of doubt
                final_verdict = VerificationVerdict.APPROVE
                approve_total += 1
            
            final_results.append(VerificationResult(
                record_id=record.record_id,
                final_verdict=final_verdict,
                votes=votes,
                approve_count=approve_count,
                reject_count=reject_count,
                group_key=record.group_key,
            ))
        
        # Print summary with fallback stats
        console.print(f"\n  [bold green]✅ APPROVED: {approve_total}[/bold green] | [bold red]❌ REJECTED: {reject_total}[/bold red]")
        if hybrid_fallback_count > 0:
            console.print(f"  [yellow]⚠️ {hybrid_fallback_count} groups used hybrid scoring fallback (0 LLM votes)[/yellow]")
        
        self._print_consensus_summary(final_results)
        return final_results
    
    def _hybrid_scoring_fallback(self, record: VerificationRecord) -> Dict:
        """
        Use hybrid scoring as fallback when LLM verification fails.
        
        Thresholds:
        - hybrid_score >= 85 → APPROVE (strong match)
        - hybrid_score >= 60 AND match_score >= 0.90 → APPROVE (moderate confidence)
        - Otherwise → REJECT
        
        Returns dict with verdict, confidence, and reason.
        """
        try:
            # Calculate hybrid score using fuzzy matching
            from rapidfuzz import fuzz
            
            # Factor 1: Name similarity (40%)
            name_score = fuzz.token_set_ratio(
                (record.seat_college_name or '').upper(),
                (record.master_name or '').upper()
            )
            
            # Factor 2: State match (25%)
            seat_state = (record.seat_state or '').upper().strip()
            master_state = (record.master_state or '').upper().strip()
            state_score = 100 if seat_state == master_state else 0
            
            # Handle state aliases
            state_aliases = {
                'NEW DELHI': 'DELHI (NCT)', 'DELHI': 'DELHI (NCT)',
                'ORISSA': 'ODISHA', 'PONDICHERRY': 'PUDUCHERRY',
            }
            if state_aliases.get(seat_state) == state_aliases.get(master_state, master_state):
                state_score = 100
            
            # Factor 3: Address overlap (20%)
            seat_addr = set((record.seat_address or '').upper().split())
            master_addr = set((record.master_address or '').upper().split())
            stopwords = {'THE', 'OF', 'AND', 'IN', 'AT', 'TO', 'FOR'}
            seat_addr -= stopwords
            master_addr -= stopwords
            if seat_addr and master_addr:
                overlap = len(seat_addr & master_addr) / max(len(seat_addr), len(master_addr))
                addr_score = overlap * 100
            else:
                addr_score = 50  # Neutral if no address
            
            # Factor 4: Match score from orchestrator (15%)
            orchestrator_score = (record.match_score or 0) * 100
            
            # Weighted hybrid score
            hybrid_score = (
                name_score * 0.40 +
                state_score * 0.25 +
                addr_score * 0.20 +
                orchestrator_score * 0.15
            )
            
            # Decision logic
            if hybrid_score >= 85:
                return {
                    'verdict': VerificationVerdict.APPROVE,
                    'confidence': hybrid_score / 100,
                    'reason': f'Hybrid fallback: strong match ({hybrid_score:.1f}/100)'
                }
            elif hybrid_score >= 60 and record.match_score >= 0.90:
                return {
                    'verdict': VerificationVerdict.APPROVE,
                    'confidence': hybrid_score / 100,
                    'reason': f'Hybrid fallback: moderate match ({hybrid_score:.1f}/100) + high orchestrator score ({record.match_score:.2f})'
                }
            else:
                return {
                    'verdict': VerificationVerdict.REJECT,
                    'confidence': (100 - hybrid_score) / 100,
                    'reason': f'Hybrid fallback: weak match ({hybrid_score:.1f}/100)'
                }
                
        except Exception as e:
            logger.warning(f"Hybrid fallback failed for {record.record_id}: {e}")
            # Conservative fallback
            return {
                'verdict': VerificationVerdict.REJECT,
                'confidence': 0.5,
                'reason': f'Hybrid fallback error: {str(e)[:50]}'
            }
    
    def _verify_batch_with_model(
        self,
        records: List[VerificationRecord],
        model: str,
        batch_size: int,
    ) -> Dict[str, VerificationResult]:
        """
        Verify records with a SPECIFIC model, properly splitting into batches.
        
        FIXED: Now actually uses batch_size to split records into chunks,
        preventing hallucinations from oversized prompts.
        """
        all_results: Dict[str, VerificationResult] = {}
        
        # Get model config
        model_config = MODEL_CONFIG.get(model, {})
        model_timeout = model_config.get("timeout", self.timeout)
        
        # Split records into proper batches
        batches = []
        for i in range(0, len(records), batch_size):
            batches.append(records[i:i + batch_size])
        
        # Process each batch
        for batch_idx, batch in enumerate(batches):
            # Build index to record_id mapping for THIS batch
            idx_to_record_id = {i: r.record_id for i, r in enumerate(batch)}
            
            # Find a working client
            client_idx = batch_idx % len(self.clients)
            client = self.clients[client_idx]
            
            try:
                # Build batch prompt with consistent GROUP_XXX format
                prompt_parts = ["VERIFY THESE MATCHES:\n"]
                for i, record in enumerate(batch):
                    group_label = f"GROUP_{i:03d}"
                    prompt_parts.append(f"""
{group_label}:
- Seat: {record.seat_college_name}
- Seat State: {record.seat_state}
- Seat Address: {record.seat_address or 'N/A'}
- Master: {record.master_name}
- Master State: {record.master_state}  
- Master Address: {record.master_address or 'N/A'}
- Score: {record.match_score:.2f}
""")
                prompt_parts.append("""
IMPORTANT: Consider name+address together as complete institution name. 
State spelling variations are OK (ORISSA=ODISHA).
Return JSON array with verdict for EACH group.""")
                prompt = "".join(prompt_parts)
                
                # Make API call
                response = client.complete(
                    messages=[
                        {"role": "system", "content": self.BATCH_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    model=model,
                    max_tokens=model_config.get("max_tokens", 8000),
                    temperature=0.1,
                    timeout=model_timeout,
                )
                
                if response and hasattr(response, 'content') and response.content:
                    # Parse batch response
                    parsed = self._parse_batch_response(response.content, batch, idx_to_record_id)
                    
                    for record_id, (verdict, conf, reason) in parsed.items():
                        all_results[record_id] = VerificationResult(
                            record_id=record_id,
                            final_verdict=verdict,
                            votes=[ModelVote(
                                model_name=model,
                                verdict=verdict,
                                confidence=conf,
                                reason=reason,
                                response_time=0.0,
                            )],
                            approve_count=1 if verdict == VerificationVerdict.APPROVE else 0,
                            reject_count=1 if verdict == VerificationVerdict.REJECT else 0,
                        )
                        
            except Exception as e:
                logger.debug(f"Model {model} batch {batch_idx} failed: {e}")
                continue
        
        if all_results:
            console.print(f"    → Got {len(all_results)} votes from model")
        
        return all_results
    
    def _parse_batch_response(
        self,
        content: str,
        records: List[VerificationRecord],
        idx_to_record_id: Optional[Dict[int, str]] = None,
    ) -> Dict[str, Tuple[VerificationVerdict, float, str]]:
        """Parse batch JSON response with improved handling."""
        import re
        import json
        
        results = {}
        idx_to_record_id = idx_to_record_id or {i: r.record_id for i, r in enumerate(records)}
        
        try:
            # Try to find JSON array - handle various formats
            json_str = None
            
            # Pattern 1: ```json [...] ```
            match = re.search(r'```json\s*(\[.*?\])\s*```', content, re.DOTALL)
            if match:
                json_str = match.group(1)
            
            # Pattern 2: ``` [...] ```
            if not json_str:
                match = re.search(r'```\s*(\[.*?\])\s*```', content, re.DOTALL)
                if match:
                    json_str = match.group(1)
            
            # Pattern 3: Raw JSON array
            if not json_str:
                match = re.search(r'\[\s*\{.*?\}\s*(?:,\s*\{.*?\}\s*)*\]', content, re.DOTALL)
                if match:
                    json_str = match.group(0)
            
            if json_str:
                # Clean up JSON string
                json_str = json_str.strip()
                data = json.loads(json_str)
                
                if isinstance(data, list):
                    for i, item in enumerate(data):
                        # Extract group_id - try multiple formats
                        group_id = item.get("group_id", "")
                        
                        # Try to match GROUP_XXX format
                        if group_id.startswith("GROUP_"):
                            # Extract index from GROUP_XXX
                            try:
                                idx = int(group_id.split("_")[1])
                                record_id = idx_to_record_id.get(idx, group_id)
                            except:
                                record_id = group_id
                        else:
                            # Use positional matching
                            record_id = idx_to_record_id.get(i, f"GROUP_{i:03d}")
                        
                        verdict_str = str(item.get("verdict", "reject")).lower()
                        confidence = float(item.get("confidence", 0.8))
                        reason = item.get("reason", "")
                        
                        verdict = VerificationVerdict.APPROVE if "approv" in verdict_str else VerificationVerdict.REJECT
                        results[record_id] = (verdict, confidence, reason)
                        
        except Exception as e:
            logger.debug(f"JSON parse error: {e}")
        
        # Fallback: Pattern matching for each record
        if not results:
            for i, record in enumerate(records):
                record_id = record.record_id
                
                # Look for approve/reject mentions near the record
                group_pattern = f"GROUP_{i:03d}"
                
                # Check if this group is mentioned with approve
                if re.search(rf'{group_pattern}[^}}]*approve', content, re.IGNORECASE):
                    results[record_id] = (VerificationVerdict.APPROVE, 0.7, "Pattern match")
                elif re.search(rf'{group_pattern}[^}}]*reject', content, re.IGNORECASE):
                    results[record_id] = (VerificationVerdict.REJECT, 0.7, "Pattern match")
                elif "approve" in content.lower():
                    # Default to approve if generally positive
                    results[record_id] = (VerificationVerdict.APPROVE, 0.6, "General approve")
        
        return results
    
    def _print_consensus_summary(self, results: List[VerificationResult]):
        """Print consensus verification summary."""
        approve_count = sum(1 for r in results if r.final_verdict == VerificationVerdict.APPROVE)
        reject_count = len(results) - approve_count
        
        table = Table(title="🤝 Multi-Model Consensus Results")
        table.add_column("Verdict", style="bold")
        table.add_column("Count", justify="right")
        table.add_column("Percentage", justify="right")
        
        total = len(results) or 1
        table.add_row("✅ APPROVED", str(approve_count), f"{100*approve_count/total:.1f}%")
        table.add_row("❌ REJECTED", str(reject_count), f"{100*reject_count/total:.1f}%")
        table.add_row("━" * 15, "━" * 8, "━" * 10)
        table.add_row("Total", str(len(results)), "100%")
        
        console.print(table)
    
    def _verify_batch_once(
        self,
        batch: List[VerificationRecord],
        max_attempts: int = 3,
    ) -> Dict[str, VerificationResult]:
        """Verify a batch of groups in a single API call."""
        # Build batch prompt
        prompt_parts = ["VERIFY THESE MATCHES:\n"]
        for i, record in enumerate(batch, 1):
            prompt_parts.append(f"""
--- GROUP {record.record_id} ---
SEAT RECORD:
- College: {record.seat_college_name}
- State: {record.seat_state}
- Address: {record.seat_address or 'N/A'}
- Course: {record.seat_course_type or 'N/A'}

MASTER ({record.master_college_id}):
- College: {record.master_name}
- State: {record.master_state}
- Address: {record.master_address or 'N/A'}

Score: {record.match_score:.2f}, Method: {record.match_method or 'N/A'}
""")
            # Add multi-campus options if available
            if record.multi_master_options:
                prompt_parts.append("⚠️ MULTI-CAMPUS CONFLICT - CHECK ADDRESS TO SELECT CORRECT ONE:")
                for mid, addr in record.multi_master_options:
                    prompt_parts.append(f"  OPTION {mid}: {addr[:80]}...")
                prompt_parts.append("Compare seat address with campus addresses. APPROVE if current master_college_id is correct for this address. REJECT if wrong campus.")
        
        prompt_parts.append("\nRespond with JSON array of verdicts for each group.")
        prompt = "\n".join(prompt_parts)
        
        results = {}
        
        for attempt in range(max_attempts):
            try:
                client_idx = attempt % len(self.clients)
                model = WORKER_MODELS[attempt % len(WORKER_MODELS)]
                client = self.clients[client_idx]
                
                response = client.complete(
                    messages=[
                        {"role": "system", "content": self.BATCH_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    model=model,
                    temperature=0.1,
                    max_tokens=2048,
                )
                
                self.stats['model_calls'] += 1
                
                # Parse batch response
                import re
                content = response.content
                
                # Try to extract JSON array
                array_match = re.search(r'\[[\s\S]*\]', content)
                if array_match:
                    verdicts = json.loads(array_match.group())
                    
                    for v in verdicts:
                        group_id = v.get('group_id', '')
                        verdict_str = v.get('verdict', 'REJECT').upper()
                        confidence = float(v.get('confidence', 0.5))
                        reason = v.get('reason', '')
                        
                        verdict = VerificationVerdict.APPROVE if verdict_str == 'APPROVE' else VerificationVerdict.REJECT
                        
                        # Find matching record
                        for record in batch:
                            if record.record_id == group_id or group_id in record.record_id:
                                results[record.record_id] = VerificationResult(
                                    record_id=record.record_id,
                                    final_verdict=verdict,
                                    votes=[ModelVote(
                                        model_name=model.split('/')[-1].split(':')[0],
                                        verdict=verdict,
                                        confidence=confidence,
                                        reason=reason,
                                        response_time=0,
                                    )],
                                    approve_count=1 if verdict == VerificationVerdict.APPROVE else 0,
                                    reject_count=0 if verdict == VerificationVerdict.APPROVE else 1,
                                    group_key=record.group_key,
                                )
                    
                    # Check if we got all results
                    if len(results) == len(batch):
                        return results
                
            except Exception as e:
                self.stats['model_failures'] += 1
                self.stats['retries'] += 1
                
                # Delay before retry
                if attempt < max_attempts - 1:
                    time.sleep(2 ** attempt)
        
        # Default REJECT for any missing
        for record in batch:
            if record.record_id not in results:
                results[record.record_id] = VerificationResult(
                    record_id=record.record_id,
                    final_verdict=VerificationVerdict.REJECT,
                    votes=[],
                    approve_count=0,
                    reject_count=1,
                    group_key=record.group_key,
                )
        
        return results
    
    def _print_summary(self, results: List[VerificationResult]):
        """Print verification summary."""
        if not results:
            return
        
        approved = sum(1 for r in results if r.final_verdict == VerificationVerdict.APPROVE)
        rejected = sum(1 for r in results if r.final_verdict == VerificationVerdict.REJECT)
        
        table = Table(title="🤖 LLM Council Verification Results", show_header=True, header_style="bold green")
        table.add_column("Verdict", style="cyan", width=20)
        table.add_column("Count", justify="right", width=15)
        table.add_column("Percentage", justify="right", width=15)
        
        total = len(results)
        table.add_row("✅ APPROVED", f"{approved:,}", f"{approved/total*100:.1f}%")
        table.add_row("❌ REJECTED", f"{rejected:,}", f"{rejected/total*100:.1f}%")
        table.add_row("━" * 15, "━" * 10, "━" * 10)
        table.add_row("Total", f"{total:,}", "100%")
        
        console.print(table)
        
        # Stats
        stats_table = Table(title="📊 Processing Stats", show_header=True, header_style="bold yellow")
        stats_table.add_column("Metric", style="cyan", width=25)
        stats_table.add_column("Value", justify="right", width=15)
        
        stats_table.add_row("Model API calls", f"{self.stats['model_calls']:,}")
        stats_table.add_row("Model failures", f"{self.stats['model_failures']:,}")
        stats_table.add_row("Retries (fallback)", f"{self.stats['retries']:,}")
        
        console.print(stats_table)


def run_verification(
    records: List[Dict],
    api_keys: Optional[List[str]] = None,
) -> List[VerificationResult]:
    """
    Convenience function to verify records.
    
    Args:
        records: List of dicts with record info
        api_keys: Optional API keys (loads from config.yaml if not provided)
    """
    verifier = AgenticVerifier(api_keys=api_keys)
    
    # Convert dicts to VerificationRecord objects
    verification_records = []
    for r in records:
        verification_records.append(VerificationRecord(
            record_id=r['record_id'],
            seat_college_name=r['seat_college_name'],
            seat_state=r['seat_state'],
            seat_address=r.get('seat_address'),
            seat_course_type=r.get('seat_course_type'),
            master_college_id=r['master_college_id'],
            master_name=r['master_name'],
            master_state=r['master_state'],
            master_address=r.get('master_address'),
            match_score=r.get('match_score', 0),
            match_method=r.get('match_method'),
            group_key=r.get('group_key'),
        ))
    
    return verifier.verify_batch_parallel(verification_records)


if __name__ == "__main__":
    # Quick test with sample records
    console.print("[bold]Testing Agentic Verifier with sample record...[/bold]\n")
    
    test_records = [
        {
            "record_id": "test_001",
            "seat_college_name": "ARMED FORCES MEDICAL COLLEGE",
            "seat_state": "MAHARASHTRA",
            "seat_address": "PUNE",
            "seat_course_type": "medical",
            "master_college_id": "MED0361",
            "master_name": "ARMED FORCES MEDICAL COLLEGE PUNE",
            "master_state": "MAHARASHTRA",
            "master_address": "Pune, Maharashtra",
            "match_score": 0.95,
            "match_method": "pass1_stream",
        },
        {
            "record_id": "test_002",
            "seat_college_name": "GOVERNMENT MEDICAL COLLEGE",
            "seat_state": "KARNATAKA",
            "seat_address": "BANGALORE",
            "seat_course_type": "medical",
            "master_college_id": "MED0100",
            "master_name": "GOVERNMENT MEDICAL COLLEGE BANGALORE",
            "master_state": "KARNATAKA",
            "master_address": "Bangalore, Karnataka",
            "match_score": 0.92,
            "match_method": "pass2_fuzzy",
        },
    ]
    
    try:
        results = run_verification(test_records)
        
        console.print(f"\n[bold]Test Results:[/bold]")
        for r in results:
            emoji = "✅" if r.final_verdict == VerificationVerdict.APPROVE else "❌"
            console.print(f"  {emoji} {r.record_id}: {r.final_verdict.value}")
            if r.votes:
                vote = r.votes[0]
                console.print(f"      Model: {vote.model_name}, Confidence: {vote.confidence:.0%}")
                console.print(f"      Reason: {vote.reason[:60]}...")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
