"""
LLM Performance Tracker

Tracks model performance metrics for smart model selection and adaptive batch sizing.
Metrics persist to SQLite for cross-session learning.
"""

import sqlite3
import time
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from contextlib import contextmanager
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class ModelStats:
    """Performance statistics for a single LLM model."""
    model_name: str
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    total_response_time: float = 0.0
    tokens_used: int = 0
    guardian_approved: int = 0
    guardian_rejected: int = 0
    rate_limit_errors: int = 0
    timeout_errors: int = 0
    parse_errors: int = 0
    last_success: Optional[float] = None
    last_failure: Optional[float] = None
    # Confidence calibration fields
    total_reported_confidence: float = 0.0  # Sum of all reported confidence scores
    confidence_count: int = 0  # Number of confidence scores recorded
    
    @property
    def avg_reported_confidence(self) -> float:
        """Average confidence score reported by this model."""
        return self.total_reported_confidence / max(self.confidence_count, 1)
    
    @property
    def success_rate(self) -> float:
        """API call success rate (0-1)."""
        return self.successful_calls / max(self.total_calls, 1)
    
    @property
    def avg_response_time(self) -> float:
        """Average response time in seconds."""
        return self.total_response_time / max(self.successful_calls, 1)
    
    @property
    def match_accuracy(self) -> float:
        """Guardian approval rate (0-1)."""
        total = self.guardian_approved + self.guardian_rejected
        return self.guardian_approved / max(total, 1)
    
    @property
    def reliability_score(self) -> float:
        """Combined reliability score (0-1) for model ranking."""
        # Weights: 40% success, 30% accuracy, 20% response time, 10% rate limits
        success_score = self.success_rate
        accuracy_score = self.match_accuracy
        
        # Response time: score decreases as time increases (target: 10s)
        time_score = max(0, 1 - (self.avg_response_time / 30))
        
        # Rate limit penalty
        rate_limit_ratio = self.rate_limit_errors / max(self.total_calls, 1)
        rate_limit_score = 1 - min(rate_limit_ratio * 5, 1)  # Penalty scales up
        
        return (
            0.40 * success_score +
            0.30 * accuracy_score +
            0.20 * time_score +
            0.10 * rate_limit_score
        )


class LLMPerformanceTracker:
    """
    SQLite-backed performance tracker for LLM models.
    
    Features:
    - Persistent storage across sessions
    - Per-model statistics
    - Real-time updates
    - Smart model ranking
    """
    
    def __init__(self, db_path: str = 'data/sqlite/llm_performance.db'):
        self.db_path = db_path
        self._init_db()
        self._stats_cache: Dict[str, ModelStats] = {}
        self._load_stats()
    
    def _init_db(self):
        """Initialize database schema."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS model_stats (
                model_name TEXT PRIMARY KEY,
                total_calls INTEGER DEFAULT 0,
                successful_calls INTEGER DEFAULT 0,
                failed_calls INTEGER DEFAULT 0,
                total_response_time REAL DEFAULT 0.0,
                tokens_used INTEGER DEFAULT 0,
                guardian_approved INTEGER DEFAULT 0,
                guardian_rejected INTEGER DEFAULT 0,
                rate_limit_errors INTEGER DEFAULT 0,
                timeout_errors INTEGER DEFAULT 0,
                parse_errors INTEGER DEFAULT 0,
                last_success REAL,
                last_failure REAL,
                updated_at REAL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS call_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT,
                timestamp REAL,
                success INTEGER,
                response_time REAL,
                tokens INTEGER,
                error_type TEXT,
                batch_size INTEGER
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_call_log_model ON call_log(model_name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_call_log_timestamp ON call_log(timestamp)")
        conn.commit()
        conn.close()
    
    @contextmanager
    def _get_conn(self):
        """Get a database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _load_stats(self):
        """Load stats from database into cache."""
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT * FROM model_stats")
            for row in cursor.fetchall():
                self._stats_cache[row['model_name']] = ModelStats(
                    model_name=row['model_name'],
                    total_calls=row['total_calls'],
                    successful_calls=row['successful_calls'],
                    failed_calls=row['failed_calls'],
                    total_response_time=row['total_response_time'],
                    tokens_used=row['tokens_used'],
                    guardian_approved=row['guardian_approved'],
                    guardian_rejected=row['guardian_rejected'],
                    rate_limit_errors=row['rate_limit_errors'],
                    timeout_errors=row['timeout_errors'],
                    parse_errors=row['parse_errors'],
                    last_success=row['last_success'],
                    last_failure=row['last_failure'],
                )
    
    def _get_or_create_stats(self, model: str) -> ModelStats:
        """Get stats for a model, creating if needed."""
        if model not in self._stats_cache:
            self._stats_cache[model] = ModelStats(model_name=model)
        return self._stats_cache[model]
    
    def _save_stats(self, stats: ModelStats):
        """Persist stats to database."""
        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO model_stats 
                (model_name, total_calls, successful_calls, failed_calls,
                 total_response_time, tokens_used, guardian_approved, 
                 guardian_rejected, rate_limit_errors, timeout_errors,
                 parse_errors, last_success, last_failure, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                stats.model_name, stats.total_calls, stats.successful_calls,
                stats.failed_calls, stats.total_response_time, stats.tokens_used,
                stats.guardian_approved, stats.guardian_rejected,
                stats.rate_limit_errors, stats.timeout_errors, stats.parse_errors,
                stats.last_success, stats.last_failure, time.time()
            ))
            conn.commit()
    
    def record_call(
        self,
        model: str,
        success: bool,
        response_time: float,
        tokens: int = 0,
        error_type: Optional[str] = None,
        batch_size: int = 1,
    ):
        """
        Record an LLM API call result.
        
        Args:
            model: Model name
            success: Whether the call succeeded
            response_time: Time in seconds
            tokens: Tokens used (if available)
            error_type: 'rate_limit', 'timeout', 'parse', or None
            batch_size: Number of records in the batch
        """
        stats = self._get_or_create_stats(model)
        
        stats.total_calls += 1
        if success:
            stats.successful_calls += 1
            stats.total_response_time += response_time
            stats.last_success = time.time()
        else:
            stats.failed_calls += 1
            stats.last_failure = time.time()
            
            if error_type == 'rate_limit':
                stats.rate_limit_errors += 1
            elif error_type == 'timeout':
                stats.timeout_errors += 1
            elif error_type == 'parse':
                stats.parse_errors += 1
        
        stats.tokens_used += tokens
        
        # Save to database
        self._save_stats(stats)
        
        # Log individual call
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO call_log 
                (model_name, timestamp, success, response_time, tokens, error_type, batch_size)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (model, time.time(), 1 if success else 0, response_time, tokens, error_type, batch_size))
            conn.commit()
    
    def record_guardian_result(self, model: str, approved: bool):
        """
        Record Guardian validation result for a model's match.
        
        Args:
            model: Model that produced the match
            approved: Whether Guardian approved the match
        """
        stats = self._get_or_create_stats(model)
        
        if approved:
            stats.guardian_approved += 1
        else:
            stats.guardian_rejected += 1
        
        self._save_stats(stats)
    
    def record_confidence(self, model: str, confidence: float):
        """
        Record a reported confidence score from the model.
        
        Args:
            model: Model name
            confidence: Reported confidence score (0-1)
        """
        stats = self._get_or_create_stats(model)
        stats.total_reported_confidence += confidence
        stats.confidence_count += 1
        # Don't save immediately - this is called frequently, let record_call save it
    
    def calibrate_confidence(self, model: str, raw_confidence: float, min_samples: int = 50) -> float:
        """
        Calibrate LLM confidence based on historical accuracy.
        
        If a model consistently overestimates (claims 95% but Guardian approves 80%),
        we scale down its confidence. If it underestimates, we scale up.
        
        Args:
            model: Model name
            raw_confidence: Raw confidence score from LLM (0-1)
            min_samples: Minimum Guardian samples before calibrating
            
        Returns:
            Calibrated confidence score (0-1)
        """
        stats = self._stats_cache.get(model)
        
        # Not enough data - return raw
        if not stats:
            return raw_confidence
        
        # Need sufficient Guardian data
        guardian_samples = stats.guardian_approved + stats.guardian_rejected
        if guardian_samples < min_samples:
            return raw_confidence
        
        # Need confidence history
        if stats.confidence_count < min_samples:
            return raw_confidence
        
        # Calculate calibration factor
        # If model claims 0.9 avg but Guardian approves 0.7, factor = 0.7/0.9 = 0.78
        actual_accuracy = stats.match_accuracy
        reported_avg = stats.avg_reported_confidence
        
        if reported_avg < 0.3:
            # Model reports very low confidence - don't calibrate
            return raw_confidence
        
        calibration_factor = actual_accuracy / reported_avg
        
        # Clamp calibration factor to reasonable range [0.5, 1.5]
        calibration_factor = max(0.5, min(1.5, calibration_factor))
        
        # Apply calibration
        calibrated = raw_confidence * calibration_factor
        
        # Clamp to [0, 1]
        return max(0.0, min(1.0, calibrated))
    
    def get_stats(self, model: str) -> Optional[ModelStats]:
        """Get current stats for a model."""
        return self._stats_cache.get(model)
    
    def get_all_stats(self) -> Dict[str, ModelStats]:
        """Get stats for all tracked models."""
        return dict(self._stats_cache)
    
    def get_ranked_models(self, models: List[str]) -> List[str]:
        """
        Rank models by reliability score.
        
        Args:
            models: List of model names to rank
            
        Returns:
            Models sorted by reliability (best first)
        """
        def get_score(model: str) -> float:
            stats = self._stats_cache.get(model)
            if not stats or stats.total_calls < 5:
                return 0.5  # Default score for new models
            return stats.reliability_score
        
        return sorted(models, key=get_score, reverse=True)
    
    def get_recommended_batch_size(self, model: str, default: int = 20) -> int:
        """
        Get recommended batch size based on model's error rate.
        
        High error rate → smaller batches
        Low error rate → larger batches
        """
        stats = self._stats_cache.get(model)
        if not stats or stats.total_calls < 10:
            return default
        
        error_rate = 1 - stats.success_rate
        
        if error_rate > 0.5:
            return max(5, default // 4)  # Very high errors
        elif error_rate > 0.3:
            return max(10, default // 2)  # High errors
        elif error_rate > 0.1:
            return default  # Moderate
        else:
            return min(50, int(default * 1.5))  # Low errors - can increase
    
    def is_healthy(self, model: str, lookback_minutes: int = 30) -> bool:
        """
        Check if a model is healthy (recent success).
        
        A model is considered unhealthy if:
        - No recent success AND recent failure
        - More than 5 consecutive failures
        """
        stats = self._stats_cache.get(model)
        if not stats:
            return True  # Unknown = assume healthy
        
        now = time.time()
        lookback = lookback_minutes * 60
        
        # Check recent success
        if stats.last_success and (now - stats.last_success) < lookback:
            return True
        
        # Check recent failure
        if stats.last_failure and (now - stats.last_failure) < lookback:
            # Had recent failure but no recent success
            if not stats.last_success or stats.last_failure > stats.last_success:
                return False
        
        return True
    
    def print_summary(self):
        """Print performance summary to console."""
        from rich.console import Console
        from rich.table import Table
        
        console = Console()
        table = Table(title="📊 LLM Performance Summary", show_header=True)
        table.add_column("Model", style="cyan", width=35)
        table.add_column("Calls", justify="right")
        table.add_column("Success", justify="right")
        table.add_column("Accuracy", justify="right")
        table.add_column("Avg Time", justify="right")
        table.add_column("Score", justify="right")
        
        for model, stats in sorted(self._stats_cache.items(), key=lambda x: -x[1].reliability_score):
            table.add_row(
                model.split('/')[-1][:30],
                str(stats.total_calls),
                f"{stats.success_rate:.0%}",
                f"{stats.match_accuracy:.0%}",
                f"{stats.avg_response_time:.1f}s",
                f"{stats.reliability_score:.2f}",
            )
        
        console.print(table)


class SmartRetryQueue:
    """
    Smart retry model selection with cooldowns and exponential backoff.
    
    Features:
    - Respects rate limit cooldowns per model
    - Exponential backoff after failures
    - Ranks available models by performance
    - Integrates with LLMPerformanceTracker
    """
    
    def __init__(self, tracker: LLMPerformanceTracker = None):
        self.tracker = tracker or get_performance_tracker()
        self.model_cooldowns: Dict[str, float] = {}  # model -> timestamp when available
        self.backoff_factors: Dict[str, int] = {}  # model -> current backoff multiplier
        self.consecutive_failures: Dict[str, int] = {}  # model -> failure count
    
    def get_next_model(
        self,
        available_models: List[str],
        tried_models: set = None,
    ) -> Optional[str]:
        """
        Get best available model, respecting cooldowns and ranking by performance.
        
        Args:
            available_models: List of all models that could be used
            tried_models: Models already tried for this batch (exclude these)
            
        Returns:
            Best available model name, or None if all are on cooldown
        """
        tried_models = tried_models or set()
        now = time.time()
        
        # Filter to available models (not tried, not on cooldown)
        available = [
            m for m in available_models
            if m not in tried_models
            and self.model_cooldowns.get(m, 0) < now
        ]
        
        if not available:
            # All on cooldown - return model with soonest availability
            untried = [m for m in available_models if m not in tried_models]
            if untried:
                return min(untried, key=lambda m: self.model_cooldowns.get(m, 0))
            return None
        
        # Rank by performance
        ranked = self.tracker.get_ranked_models(available)
        return ranked[0] if ranked else available[0]
    
    def on_success(self, model: str):
        """Record successful call - reduce backoff."""
        # Reset consecutive failures
        self.consecutive_failures[model] = 0
        # Reduce backoff factor
        if model in self.backoff_factors:
            self.backoff_factors[model] = max(1, self.backoff_factors[model] // 2)
    
    def on_rate_limit(self, model: str, base_wait: float = 5.0):
        """Apply exponential backoff after rate limit."""
        factor = self.backoff_factors.get(model, 1)
        wait_time = base_wait * factor
        self.model_cooldowns[model] = time.time() + wait_time
        self.backoff_factors[model] = min(factor * 2, 32)  # Max 160s wait
        self.consecutive_failures[model] = self.consecutive_failures.get(model, 0) + 1
        
        logger.info(f"Model {model} on cooldown for {wait_time:.1f}s (backoff factor: {factor})")
    
    def on_timeout(self, model: str, base_wait: float = 10.0):
        """Apply moderate backoff after timeout."""
        factor = self.backoff_factors.get(model, 1)
        wait_time = base_wait * factor
        self.model_cooldowns[model] = time.time() + wait_time
        self.backoff_factors[model] = min(factor + 1, 8)  # Max 80s wait
        self.consecutive_failures[model] = self.consecutive_failures.get(model, 0) + 1
    
    def on_error(self, model: str, error_type: Optional[str] = None):
        """Handle error based on type."""
        if error_type == 'rate_limit':
            self.on_rate_limit(model)
        elif error_type == 'timeout':
            self.on_timeout(model)
        else:
            # Generic error - small cooldown
            self.model_cooldowns[model] = time.time() + 2
            self.consecutive_failures[model] = self.consecutive_failures.get(model, 0) + 1
    
    def is_healthy(self, model: str, max_consecutive_failures: int = 5) -> bool:
        """Check if model is healthy (not too many consecutive failures)."""
        return self.consecutive_failures.get(model, 0) < max_consecutive_failures
    
    def get_healthy_models(self, models: List[str]) -> List[str]:
        """Filter to only healthy models."""
        return [m for m in models if self.is_healthy(m)]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current retry queue state."""
        now = time.time()
        return {
            'models_on_cooldown': sum(1 for t in self.model_cooldowns.values() if t > now),
            'backoff_factors': dict(self.backoff_factors),
            'consecutive_failures': dict(self.consecutive_failures),
        }


class CircuitBreaker:
    """
    Circuit breaker pattern for auto-disabling failing models.
    
    A model is "tripped" (disabled) after too many consecutive failures.
    It auto-recovers after a cooldown period.
    
    States:
    - CLOSED: Normal operation, requests allowed
    - OPEN: Tripped, requests blocked
    - HALF_OPEN: Testing if model recovered
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 300.0,  # 5 minutes
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures: Dict[str, int] = {}  # model -> consecutive failure count
        self.tripped_at: Dict[str, float] = {}  # model -> timestamp when tripped
        self.state: Dict[str, str] = {}  # model -> 'closed'|'open'|'half_open'
    
    def is_available(self, model: str) -> bool:
        """Check if a model is available (circuit not open)."""
        state = self.state.get(model, 'closed')
        
        if state == 'closed':
            return True
        
        if state == 'open':
            # Check if recovery timeout has passed
            tripped_time = self.tripped_at.get(model, 0)
            if time.time() - tripped_time > self.recovery_timeout:
                # Move to half-open for testing
                self.state[model] = 'half_open'
                return True
            return False
        
        if state == 'half_open':
            return True  # Allow test request
        
        return True
    
    def record_success(self, model: str):
        """Record successful call - reset failures and close circuit."""
        self.failures[model] = 0
        self.state[model] = 'closed'
    
    def record_failure(self, model: str):
        """Record failure - potentially trip circuit."""
        self.failures[model] = self.failures.get(model, 0) + 1
        
        if self.failures[model] >= self.failure_threshold:
            self.state[model] = 'open'
            self.tripped_at[model] = time.time()
            logger.warning(f"Circuit OPEN for {model} after {self.failures[model]} failures")
    
    def get_available_models(self, models: List[str]) -> List[str]:
        """Filter to only available models."""
        return [m for m in models if self.is_available(m)]
    
    def get_status(self) -> Dict[str, Any]:
        """Get circuit breaker status."""
        now = time.time()
        return {
            model: {
                'state': self.state.get(model, 'closed'),
                'failures': self.failures.get(model, 0),
                'recovery_in': max(0, self.recovery_timeout - (now - self.tripped_at.get(model, 0)))
                    if self.state.get(model) == 'open' else 0
            }
            for model in set(list(self.failures.keys()) + list(self.state.keys()))
        }


class CostTracker:
    """
    Token usage and cost tracking for LLM API calls.
    
    Tracks tokens per model per run and estimates costs.
    """
    
    def __init__(self):
        self.session_tokens: Dict[str, Dict[str, int]] = {}  # model -> {prompt, completion}
        self.all_time_tokens: Dict[str, Dict[str, int]] = {}
        self.run_start: Optional[float] = None
    
    def start_run(self):
        """Start a new run (resets session counters)."""
        self.session_tokens = {}
        self.run_start = time.time()
    
    def record_usage(self, model: str, prompt_tokens: int = 0, completion_tokens: int = 0):
        """Record token usage for a model."""
        if model not in self.session_tokens:
            self.session_tokens[model] = {'prompt': 0, 'completion': 0}
        if model not in self.all_time_tokens:
            self.all_time_tokens[model] = {'prompt': 0, 'completion': 0}
        
        self.session_tokens[model]['prompt'] += prompt_tokens
        self.session_tokens[model]['completion'] += completion_tokens
        self.all_time_tokens[model]['prompt'] += prompt_tokens
        self.all_time_tokens[model]['completion'] += completion_tokens
    
    def get_session_summary(self) -> Dict[str, Any]:
        """Get token usage summary for current session."""
        total_prompt = sum(m['prompt'] for m in self.session_tokens.values())
        total_completion = sum(m['completion'] for m in self.session_tokens.values())
        
        return {
            'duration_seconds': time.time() - self.run_start if self.run_start else 0,
            'total_prompt_tokens': total_prompt,
            'total_completion_tokens': total_completion,
            'total_tokens': total_prompt + total_completion,
            'per_model': dict(self.session_tokens),
        }
    
    def print_summary(self):
        """Print cost summary to console."""
        from rich.console import Console
        from rich.table import Table
        
        console = Console()
        summary = self.get_session_summary()
        
        table = Table(title="💰 Token Usage Summary", show_header=True)
        table.add_column("Model", style="cyan", width=35)
        table.add_column("Prompt", justify="right")
        table.add_column("Completion", justify="right")
        table.add_column("Total", justify="right")
        
        for model, usage in self.session_tokens.items():
            table.add_row(
                model.split('/')[-1][:30],
                f"{usage['prompt']:,}",
                f"{usage['completion']:,}",
                f"{usage['prompt'] + usage['completion']:,}",
            )
        
        table.add_row(
            "[bold]TOTAL[/bold]",
            f"[bold]{summary['total_prompt_tokens']:,}[/bold]",
            f"[bold]{summary['total_completion_tokens']:,}[/bold]",
            f"[bold]{summary['total_tokens']:,}[/bold]",
        )
        
        console.print(table)
        console.print(f"[dim]Duration: {summary['duration_seconds']:.1f}s[/dim]")


def health_check_models(models: List[str], client, timeout: float = 10.0) -> Dict[str, bool]:
    """
    Pre-batch health check for model availability.
    
    Sends a minimal request to each model to verify it's responding.
    
    Args:
        models: List of model names to check
        client: OpenRouterClient instance
        timeout: Timeout per model check
        
    Returns:
        Dict mapping model name -> is_healthy (bool)
    """
    results = {}
    
    for model in models:
        try:
            response = client.complete(
                messages=[{"role": "user", "content": "Hi"}],
                model=model,
                temperature=0.0,
                max_tokens=5,
                timeout=timeout,
            )
            results[model] = True
            logger.debug(f"Health check passed: {model}")
        except Exception as e:
            results[model] = False
            logger.warning(f"Health check failed: {model} - {e}")
    
    return results


# Singleton instances
_tracker: Optional[LLMPerformanceTracker] = None
_retry_queue: Optional[SmartRetryQueue] = None
_circuit_breaker: Optional[CircuitBreaker] = None
_cost_tracker: Optional[CostTracker] = None


def get_performance_tracker(db_path: str = 'data/sqlite/llm_performance.db') -> LLMPerformanceTracker:
    """Get or create singleton performance tracker."""
    global _tracker
    if _tracker is None:
        _tracker = LLMPerformanceTracker(db_path)
    return _tracker


def get_retry_queue() -> SmartRetryQueue:
    """Get or create singleton retry queue."""
    global _retry_queue
    if _retry_queue is None:
        _retry_queue = SmartRetryQueue()
    return _retry_queue


def get_circuit_breaker() -> CircuitBreaker:
    """Get or create singleton circuit breaker."""
    global _circuit_breaker
    if _circuit_breaker is None:
        _circuit_breaker = CircuitBreaker()
    return _circuit_breaker


def get_cost_tracker() -> CostTracker:
    """Get or create singleton cost tracker."""
    global _cost_tracker
    if _cost_tracker is None:
        _cost_tracker = CostTracker()
    return _cost_tracker
