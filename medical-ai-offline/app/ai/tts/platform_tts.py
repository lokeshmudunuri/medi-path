"""Text-to-speech using the operating system voice (pyttsx3).

This provider is always available once the optional pyttsx3 dependency is
installed and does not need downloaded models — useful as a baseline so the
voice pipeline works even before the Piper voice model is installed.
"""
from __future__ import annotations

from pathlib import Path

from app.ai.tts.base import TtsResult


class PlatformTtsProvider:
    model_id = "platform-tts"

    def __init__(self) -> None:
        self._engine = None
        try:
            import pyttsx3  # type: ignore

            self._engine = pyttsx3.init()
        except Exception:
            self._engine = None

    def is_available(self) -> bool:
        return self._engine is not None

    def synthesize(self, text: str, output_path: str, language: str = "en") -> TtsResult:
        if not self.is_available():
            raise RuntimeError("Platform TTS is not available on this device.")
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        self._engine.save_to_file(text, output_path)
        self._engine.runAndWait()
        return TtsResult(audio_path=output_path, engine="pyttsx3", model_id=self.model_id)