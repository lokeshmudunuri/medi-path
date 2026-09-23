"""Provider protocol for local text-to-speech."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class TtsResult:
    audio_path: str
    engine: str
    model_id: str = ""
    duration_seconds: float = 0.0

    def to_dict(self) -> dict:
        return {
            "audio_path": self.audio_path,
            "engine": self.engine,
            "model_id": self.model_id,
            "duration_seconds": self.duration_seconds,
        }


class TextToSpeechProvider(Protocol):
    model_id: str

    def is_available(self) -> bool: ...

    def synthesize(self, text: str, output_path: str, language: str = "en") -> TtsResult: ...