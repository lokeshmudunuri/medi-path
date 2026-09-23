"""Deterministic LLM substitute used in tests and when Ollama is absent.

It never fabricates medical facts: it only reflects the grounded context that
was passed to it. If the request contains the "insufficient" marker used by
GroundingContextBuilder for missing information, it returns the canonical
"locally unavailable" phrasing.
"""
from __future__ import annotations

from app.ai.llm.base import (
    EXPLANATION_SYSTEM_PROMPT,
    LlmProvider,
    LlmRequest,
    LlmResponse,
)

_INSUFFICIENT = "NOT_ENOUGH_LOCAL_INFORMATION"
_MISSING_PHRASE = (
    "The local medical database does not contain enough information to answer this."
)


class MockLlmProvider(LlmProvider):
    model_id = "mock-llm"
    model_name = "mock-llm"

    def is_available(self) -> bool:
        return True

    def complete(self, request: LlmRequest) -> LlmResponse:
        context = "\n".join(m["content"] for m in request.messages)
        if _INSUFFICIENT in context:
            return LlmResponse(text=_MISSING_PHRASE, engine="mock", model_name=self.model_name)
        if "SAFETY_FLAGS" in context and "critical" in context.lower():
            return LlmResponse(
                text="I see a serious safety flag in your case. Please contact your doctor "
                "or a pharmacist before taking the prescription.",
                engine="mock",
                model_name=self.model_name,
            )
        if "MEDICINES" in context:
            return LlmResponse(
                text="Based on your case file, the medicine information and medical-engine "
                "results are shown in the case summary. Ask me anything specific.",
                engine="mock",
                model_name=self.model_name,
            )
        return LlmResponse(
            text="I can help explain the prescription details in your case file.",
            engine="mock",
            model_name=self.model_name,
        )