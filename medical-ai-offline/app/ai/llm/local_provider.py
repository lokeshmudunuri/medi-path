"""LocalLLMProvider: the single abstraction the app uses to reach the LLM.

The app never talks to Ollama directly. It talks to this provider, which:

* selects the real backend (local Ollama) when the configured model tag is
  detected in the running Ollama runtime;
* falls back to the clearly-labelled mock provider for tests / when Ollama
  is not reachable (the response then carries engine="mock");
* reports one authoritative :meth:`status` dict used by the UI's Model Status
  panel — so the UI can never lie about which backend answered.

The LLM is only an explanation layer on top of the local Medical Engine. A
coding model such as the configured one is never described as a medical model.
"""
from __future__ import annotations

import os

from app.ai.llm.base import LlmRequest, LlmResponse
from app.ai.llm.mock_llm import MockLlmProvider
from app.ai.llm.ollama_provider import OllamaProvider, ollama_installed_tags
from app.config import settings
from app.utils.logging import get_logger

log = get_logger("ai.llm.local")


def _force_mock() -> bool:
    return os.environ.get("LOCALMED_FORCE_MOCK", "0") == "1"


class LocalLLMProvider:
    """Offline-first LLM facade: local Ollama with a labelled mock fallback.
    
    Target model is Gemma 3 1B. If not present in the local Ollama runtime,
    it checks for installed local fallback models (e.g. qwen3-coder) or clearly
    reports offline status. Never substitutes a cloud API.
    """

    model_id = "local-llm"
    target_model_name = settings.ollama_model

    def __init__(self) -> None:
        self.host = settings.ollama_host

    def _resolved_model(self) -> tuple[str, bool, bool]:
        """Returns (active_model_name, is_target_model, is_installed)."""
        reachable, tags = ollama_installed_tags()
        if not reachable:
            return self.target_model_name, False, False

        # 1. Exact match with target (e.g., gemma3:1b)
        if self.target_model_name in tags:
            return self.target_model_name, True, True
        
        # Check partial tag match for gemma3:1b
        for tag in tags:
            if "gemma3" in tag.lower() or "gemma-3" in tag.lower():
                return tag, True, True

        # 2. Check local fallback models if present
        for fallback in getattr(settings, "fallback_models", []):
            if fallback in tags:
                return fallback, False, True

        # 3. Use first available model if any exists
        if tags:
            return tags[0], False, True

        return self.target_model_name, False, False

    # ------------------------------------------------------------- backend
    def _select(self) -> "object":
        """Pick the concrete backend: Ollama or the labelled mock provider."""
        if _force_mock():
            return MockLlmProvider()

        active_model, is_target, is_installed = self._resolved_model()
        if is_installed:
            return OllamaProvider(host=self.host, model=active_model)

        log.info(
            "Local LLM %s not installed; chat runs in offline sample/mock mode.",
            self.target_model_name,
        )
        return MockLlmProvider()

    def complete(self, request: LlmRequest) -> LlmResponse:
        return self._select().complete(request)

    def is_available(self) -> bool:
        return self._select().is_available()

    # -------------------------------------------------------------- status
    def status(self) -> dict:
        """One authoritative snapshot for the Model Status panel. Never faked."""
        forced_mock = _force_mock()

        if forced_mock:
            note = (
                "Mock explanation layer: test mode active. "
                "Local inference is used in normal operation."
            )
            return {
                "provider": "mock",
                "connected": False,
                "runtime": "local",
                "internet_required_for_inference": False,
                "target_model": self.target_model_name,
                "model_name": self.target_model_name,
                "active_model": "mock",
                "is_target_model": False,
                "model_detected_in_ollama": False,
                "ollama_reachable": False,
                "ollama_host": self.host,
                "available_models": [],
                "note": note,
            }

        reachable, tags = ollama_installed_tags()
        active_model, is_target, is_installed = self._resolved_model()

        if reachable and is_installed:
            provider = "ollama"
            connected = True
            if is_target:
                note = f"Connected to local {active_model} on-device."
            else:
                note = (
                    f"Connected to local {active_model}. "
                    f"Target model '{self.target_model_name}' is not installed yet; "
                    "pull it via `ollama pull gemma3:1b` or Model Manager."
                )
        elif reachable:
            provider = "mock"
            connected = False
            note = (
                f"Ollama is running locally but '{self.target_model_name}' is not installed. "
                "Pull the model or install it via Model Manager to enable live local inference."
            )
        else:
            provider = "mock"
            connected = False
            note = (
                "Local AI runtime (Ollama) is not reachable on localhost:11434. "
                "Chat runs in offline sample mode until the local runtime is started."
            )

        return {
            "provider": provider,
            "connected": connected,
            "runtime": "local",
            "internet_required_for_inference": False,
            "target_model": self.target_model_name,
            "model_name": active_model if is_installed else self.target_model_name,
            "active_model": active_model if is_installed else "none",
            "is_target_model": is_target,
            "model_detected_in_ollama": is_installed,
            "ollama_reachable": reachable,
            "ollama_host": self.host,
            "available_models": tags,
            "note": note,
        }