#!/usr/bin/env python3
"""
OpenRouter API Client
Provides async/sync access to OpenRouter LLM models for entity matching.
"""

import os
import json
import logging
import httpx
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class OpenRouterResponse:
    """Wrapper for OpenRouter API response."""
    content: str
    model: str
    usage: Dict[str, int]
    raw: Dict[str, Any]


class OpenRouterClient:
    """
    Client for OpenRouter API with support for free models.
    
    Usage:
        client = OpenRouterClient()  # Uses OPENROUTER_API_KEY env var
        response = client.complete(
            model="google/gemini-2.0-flash-exp:free",
            messages=[{"role": "user", "content": "Hello"}]
        )
    """
    
    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
    
    # Recommended free models for entity matching (sorted by capability)
    MODELS = {
        "primary": "google/gemini-2.0-flash-exp:free",
        "fallback": "qwen/qwen3-235b-a22b:free",
        "secondary": "nousresearch/hermes-3-llama-3.1-405b:free",
        "nova": "amazon/nova-2-lite-v1:free",
        "gpt120b": "openai/gpt-oss-120b:free",
        "fast": "mistralai/mistral-small-3.1-24b-instruct:free",
        "kat": "kwaipilot/kat-coder-pro:free",
        "qwen_coder": "qwen/qwen3-coder:free",
        "deepseek": "tngtech/deepseek-r1t-chimera:free",
        "olmo": "allenai/olmo-3-32b-think:free",
        "llama": "meta-llama/llama-3.3-70b-instruct:free",
        "glm": "z-ai/glm-4.5-air:free",
        "gpt20b": "openai/gpt-oss-20b:free",
    }
    
    def __init__(self, api_key: Optional[str] = None, timeout: float = 120.0):
        """
        Initialize OpenRouter client.
        
        Args:
            api_key: OpenRouter API key. Falls back to OPENROUTER_API_KEY env var.
            timeout: Request timeout in seconds (default 120s for large contexts).
        """
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError(
                "OpenRouter API key required. Set OPENROUTER_API_KEY env var or pass api_key."
            )
        self.timeout = timeout
        self._headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/your-repo",  # Required by OpenRouter
            "X-Title": "CourseStandardizer-AgenticMatcher",
        }
    
    def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.1,
        max_tokens: int = 8192,
        timeout: Optional[float] = None,
        response_format: Optional[Dict] = None,
    ) -> OpenRouterResponse:
        """
        Synchronous completion request.
        
        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Model ID. Defaults to primary (Gemini 2.0 Flash).
            temperature: Sampling temperature (0.0-2.0).
            max_tokens: Maximum response tokens.
            response_format: Optional format spec (e.g., {"type": "json_object"}).
        
        Returns:
            OpenRouterResponse with content and metadata.
        """
        model = model or self.MODELS["primary"]
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        if response_format:
            payload["response_format"] = response_format
        
        
        request_timeout = timeout if timeout is not None else self.timeout
        
        try:
            with httpx.Client(timeout=request_timeout) as client:
                response = client.post(
                    self.BASE_URL,
                    headers=self._headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                
                return OpenRouterResponse(
                    content=data["choices"][0]["message"]["content"],
                    model=data.get("model", model),
                    usage=data.get("usage", {}),
                    raw=data,
                )
                
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter API error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"OpenRouter request failed: {e}")
            raise
    
    def complete_with_retry(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.1,
        max_tokens: int = 16384,
        max_retries: int = 3,
        retry_delay: float = 5.0,
        timeout: Optional[float] = None,
    ) -> OpenRouterResponse:
        """
        Completion with retry logic and fallback to secondary model.
        
        If primary model is rate limited, falls back to Llama 3.3 70B.
        """
        import time
        
        models_to_try = [
            model or self.MODELS["primary"],
            self.MODELS["fallback"],
        ]
        
        last_error = None
        
        for idx, current_model in enumerate(models_to_try):
            # Add delay before switching to next model (but not for first model)
            if idx > 0:
                logger.info(f"Switching to fallback model {current_model} in 2 seconds...")
                time.sleep(2.0)
            
            for attempt in range(max_retries):
                try:
                    return self.complete(
                        messages=messages,
                        model=current_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        timeout=timeout,
                    )
                except httpx.HTTPStatusError as e:
                    last_error = e
                    if e.response.status_code == 429:
                        # Rate limited - wait and retry
                        wait_time = retry_delay * (2 ** attempt)
                        logger.warning(f"Rate limited on {current_model}, waiting {wait_time}s...")
                        time.sleep(wait_time)
                    elif e.response.status_code in (401, 403):
                        # Auth error - try next model
                        logger.warning(f"Auth error on {current_model}, trying fallback...")
                        break
                    else:
                        raise
                except Exception as e:
                    last_error = e
                    logger.warning(f"Error on attempt {attempt+1}: {e}")
                    time.sleep(retry_delay)
        
        raise last_error or Exception("All models failed")
    
    async def complete_async(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.1,
        max_tokens: int = 8192,
        timeout: Optional[float] = None,
    ) -> OpenRouterResponse:
        """Async version of complete()."""
        model = model or self.MODELS["primary"]
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "max_tokens": max_tokens,
        }
        
        request_timeout = timeout if timeout is not None else self.timeout
        
        async with httpx.AsyncClient(timeout=request_timeout) as client:
            response = await client.post(
                self.BASE_URL,
                headers=self._headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            
            return OpenRouterResponse(
                content=data["choices"][0]["message"]["content"],
                model=data.get("model", model),
                usage=data.get("usage", {}),
                raw=data,
            )
    
    def complete_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.1,
        max_tokens: int = 8192,
        timeout: Optional[float] = None,
    ):
        """
        Streaming completion that yields content chunks as they arrive.
        
        Use this for real-time progress display during long responses.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model ID
            temperature: Sampling temperature
            max_tokens: Maximum response tokens
            timeout: Request timeout
            
        Yields:
            str: Content chunks as they stream in
            
        Example:
            for chunk in client.complete_stream(messages, model):
                print(chunk, end='', flush=True)
        """
        model = model or self.MODELS["primary"]
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,  # Enable streaming
        }
        
        request_timeout = timeout if timeout is not None else self.timeout
        
        try:
            with httpx.Client(timeout=request_timeout) as client:
                with client.stream(
                    "POST",
                    self.BASE_URL,
                    headers=self._headers,
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    
                    for line in response.iter_lines():
                        if not line:
                            continue
                        
                        # SSE format: "data: {...}"
                        if line.startswith("data: "):
                            data_str = line[6:]  # Remove "data: " prefix
                            
                            if data_str.strip() == "[DONE]":
                                break
                            
                            try:
                                data = json.loads(data_str)
                                delta = data.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue  # Skip malformed chunks
                                
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter streaming error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"OpenRouter stream failed: {e}")
            raise
    
    def get_models_info(self) -> Dict[str, str]:
        """Return available model configurations."""
        return self.MODELS.copy()


# Quick test
if __name__ == "__main__":
    client = OpenRouterClient()
    print("Testing OpenRouter connection...")
    
    response = client.complete(
        messages=[
            {"role": "user", "content": "Say 'Hello from Gemini!' in exactly 5 words."}
        ],
        model=client.MODELS["primary"],
    )
    
    print(f"Model: {response.model}")
    print(f"Response: {response.content}")
    print(f"Usage: {response.usage}")
