"""Provider protocol for local OCR."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class OcrResult:
    text: str
    confidence: float
    engine: str
    model_id: str = ""
    segments: list[dict] = None  # list of {"text","confidence","box"}

    def __post_init__(self) -> None:
        if self.segments is None:
            self.segments = []

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "confidence": round(self.confidence, 3),
            "engine": self.engine,
            "model_id": self.model_id,
            "segments": self.segments,
        }


class OcrProvider(Protocol):
    model_id: str

    def is_available(self) -> bool: ...

    def recognize(self, image_path: str) -> OcrResult: ...