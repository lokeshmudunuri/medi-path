"""Ollama-backed local LLM provider + shared Ollama presence probe.

The actual Ollama communication happens only inside this module:
- :func:`ollama_installed_tags` is the single cached probe of the local
  Ollama /api/tags endpoint, shared by the provider, the model manager and
  the status endpoint.
- :class:`OllamaProvider` is the transport for /api/chat completions.

Only the localhost endpoint configured in `settings.ollama_host` is ever
contacted; no remote hosts are supported.
"""
from __future__ import annotations

import threading
import time

import httpx

from app.ai.llm.base import (
    EXPLANATION_SYSTEM_PROMPT,
    LlmProvider,
    LlmRequest,
    LlmResponse,
    LlmUnavailableError,
)
from app.config import settings

_TAGS_TTL_SECONDS = 5.0
_TAGS_CACHE: dict = {"ts": 0.0, "reachable": False, "models": []}
_TAGS_LOCK = threading.Lock()


def ollama_host() -> str:
    """The configured Ollama endpoint, without a trailing slash."""
    return settings.ollama_host.rstrip("/")


def ollama_installed_tags(ttl: float = _TAGS_TTL_SECONDS) -> tuple[bool, list[str]]:
    """Return ``(reachable, [model names])`` for the local Ollama runtime.

    Results are cached for ``ttl`` seconds so the status panel and model rows
    are cheap to refresh and the app never hammers the local runtime.
    """
    with _TAGS_LOCK:
        now = time.time()
        cache = _TAGS_CACHE
        if cache["models"] is not None and now - cache["ts"] < ttl:
            return cache["reachable"], list(cache["models"])
    try:
        response = httpx.get(f"{ollama_host()}/api/tags", timeout=3.0)
        reachable = response.status_code == 200
        models = [
            m.get("name")
            for m in response.json().get("models", [])
            if m.get("name")
        ] if reachable else []
    except Exception:
        reachable, models = False, []
    with _TAGS_LOCK:
        _TAGS_CACHE.update(ts=time.time(), reachable=reachable, models=models)
    return reachable, sorted(models)


def _configured_model_present() -> bool:
    """True when the configured Ollama model tag exists in the local runtime."""
    matched = False
    for name in ollama_installed_tags()[1]:
        if name == settings.ollama_model:
            matched = True
            break
    return matched


class OllamaProvider(LlmProvider):
    """Local Ollama chat backend for the configured model tag."""

    model_id = "llm-qwen3-coder"

    def __init__(self, host: str | None = None, model: str | None = None) -> None:
        self.host = (host or settings.ollama_host).rstrip("/")
        self.model_name = model or settings.ollama_model

    @property
    def model_tag(self) -> str:
        return self.model_name

    def is_available(self) -> bool:
        return self.model_name in ollama_installed_tags()[1]

    def complete(self, request: LlmRequest) -> LlmResponse:
        if not self.is_available():
            raise LlmUnavailableError(
                f"{self.model_name} is not detected in the local Ollama runtime "
                f"({self.host}). Pull it with `ollama pull {self.model_name}` "
                "or open Settings > Models."
            )
        messages = [{"role": "system", "content": request.system or EXPLANATION_SYSTEM_PROMPT}]
        messages.extend(request.messages)
        payload = {
            "model": self.model_name,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            },
        }
        try:
            response = httpx.post(
                f"{self.host}/api/chat", json=payload, timeout=httpx.Timeout(180, connect=10)
            )
            response.raise_for_status()
            text = response.json().get("message", {}).get("content", "").strip()
            return LlmResponse(text=text, engine="ollama", model_name=self.model_name)
        except Exception as exc:
            raise LlmUnavailableError(f"Local LLM request failed: {exc}") from exc