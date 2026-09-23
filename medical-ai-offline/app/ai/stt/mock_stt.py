"""Deterministic STT substitute used in tests and when no Vosk model is
installed. Always available; clearly labelled engine="mock". Returns the
transcript derived from a fixture key embedded in the request, honouring the
same "unknown -> low confidence" behaviour as the OCR mock.
"""
from __future__ import annotations

from app.ai.stt.base import SttResult


class MockSttProvider:
    model_id = "mock-stt"

    def is_available(self) -> bool:
        return True

    def transcribe(self, audio_path: str, language: str = "auto") -> SttResult:
        return SttResult(
            text="How should I take paracetamol?",
            confidence=0.9,
            engine="mock",
            model_id=self.model_id,
        )