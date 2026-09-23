"""Provider protocol for local speech-to-text."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class SttResult:
    text: str
    confidence: float
    engine: str
    model_id: str = ""

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "confidence": round(self.confidence, 3),
            "engine": self.engine,
            "model_id": self.model_id,
        }


class SpeechToTextProvider(Protocol):
    model_id: str

    def is_available(self) -> bool: ...

    def transcribe(self, audio_path: str, language: str = "auto") -> SttResult: ...