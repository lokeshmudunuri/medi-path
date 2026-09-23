"""Deterministic TTS substitute for offline tests.

Writes a small valid WAV file (silence with a header) so the audio pipeline
can be tested end-to-end without any speech model installed.
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

from app.ai.tts.base import TtsResult


class MockTtsProvider:
    model_id = "mock-tts"

    def is_available(self) -> bool:
        return True

    def synthesize(self, text: str, output_path: str, language: str = "en") -> TtsResult:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        rate = 16000
        duration = 0.4
        frames = int(rate * duration)
        with wave.open(output_path, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            for i in range(frames):
                sample = int(4000 * math.sin(2 * math.pi * 220 * i / rate))
                wav.writeframes(struct.pack("<h", sample))
        return TtsResult(
            audio_path=output_path, engine="mock", model_id=self.model_id, duration_seconds=duration
        )