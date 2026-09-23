"""Provider protocol for the local LLM.

The LLM is strictly an *explanation layer*. It receives grounded case
information (built by GroundingContextBuilder) and is instructed never to
invent medical facts.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class LlmRequest:
    system: str
    messages: list[dict]  # [{"role": "user"|"assistant", "content": "..."}]
    temperature: float = 0.2
    max_tokens: int = 512


@dataclass
class LlmResponse:
    text: str
    engine: str
    model_name: str = ""
    raw_available: bool = True

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "engine": self.engine,
            "model_name": self.model_name,
            "raw_available": self.raw_available,
        }


class LlmProvider(Protocol):
    model_id: str
    model_name: str

    def is_available(self) -> bool: ...

    def complete(self, request: LlmRequest) -> LlmResponse: ...


class LlmUnavailableError(RuntimeError):
    """Raised by providers when the local model is not installed."""


EXPLANATION_SYSTEM_PROMPT = """You are a local medical information explanation assistant. You are not a doctor. Use only the supplied case information and approved local knowledge. Never invent medicine names, dosages, test results, diagnoses, or medical history. Never change a prescribed treatment. If information is missing, ambiguous, or unsupported, explicitly say that it is unavailable or uncertain.

Strict rules:
1. Use ONLY the supplied case information and approved local medical engine results.
2. Never invent medicine names, dosages, test results, diagnoses, or medical history.
3. If the supplied information is insufficient, ambiguous, or missing, say explicitly:
   "The local medical database does not contain enough information to answer this."
4. Never reference external cloud sources or fabricate facts.
5. Do not diagnose or prescribe. Remind the user to follow their doctor's instructions.
6. Keep answers concise, clear, and grounded. If a safety flag or warning exists, highlight it.
"""