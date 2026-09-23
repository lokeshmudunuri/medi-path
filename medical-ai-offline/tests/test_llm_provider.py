"""Local LLM provider facade tests.

The suite runs with LOCALMED_FORCE_MOCK=1 (see conftest), so the provider must
report an honest "mock / not connected" status without ever probing the
network — the status endpoint can then drive the UI's Model Status panel
without lying about the backend.
"""
from __future__ import annotations

import os

from app.ai.llm.local_provider import LocalLLMProvider
from app.ai.llm.base import LlmRequest


def test_local_llm_provider_reports_mock_in_force_mock_mode():
    os.environ["LOCALMED_FORCE_MOCK"] = "1"
    provider = LocalLLMProvider()
    status = provider.status()
    assert status["provider"] == "mock"
    assert status["connected"] is False
    assert status["runtime"] == "local"
    assert status["internet_required_for_inference"] is False
    assert status["model_name"]
    assert status["ollama_reachable"] is False
    assert status["available_models"] == []


def test_local_llm_provider_status_never_reaches_network_in_mock_mode(monkeypatch):
    import app.ai.llm.local_provider as module

    def boom():
        raise AssertionError("must not probe Ollama in mock mode")

    monkeypatch.setattr(module, "ollama_installed_tags", boom)
    os.environ["LOCALMED_FORCE_MOCK"] = "1"
    status = LocalLLMProvider().status()
    assert status["provider"] == "mock"


def test_local_llm_provider_complete_uses_mock_backend():
    os.environ["LOCALMED_FORCE_MOCK"] = "1"
    provider = LocalLLMProvider()
    response = provider.complete(
        LlmRequest(system="sys", messages=[{"role": "user", "content": "MEDICINES: x"}])
    )
    assert response.engine == "mock"
    assert response.text


def test_engine_llm_status_delegates_to_provider():
    from app.ai.engine import LocalAIEngine

    os.environ["LOCALMED_FORCE_MOCK"] = "1"
    status = LocalAIEngine().llm_status()
    assert status["runtime"] == "local"
    assert status["provider"] == "mock"