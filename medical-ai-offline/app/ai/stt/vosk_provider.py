"""Vosk-backed local speech recognition provider.

The Vosk model zip is downloaded by the Model Download Manager into the
app-managed model directory and extracted there. `vosk` is imported lazily;
the base application runs without it.
"""
from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.utils.logging import get_logger

log = get_logger("stt.vosk")


class VoskSttProvider:
    model_id = "stt-vosk-en"

    def __init__(self, language: str = "en") -> None:
        self._model = None
        self._language = language
        self._require_model()

    def _install_dir(self) -> Path:
        return Path(settings.model_dir) / self.model_id / "stt" / "vosk-en"

    def _require_model(self) -> None:
        if self._model is not None:
            return
        try:
            import vosk  # type: ignore
        except ImportError:
            self._model = None
            return
        model_dir = self._install_dir()
        candidates = list(model_dir.rglob("am/final.mdl"))
        if not candidates:
            self._model = None
            return
        try:
            vosk.SetLogLevel(-1)
            self._model = vosk.Model(str(model_dir))
            log.info("Vosk model loaded from %s", model_dir)
        except Exception as exc:
            log.warning("Vosk init failed: %s", exc)
            self._model = None

    def is_available(self) -> bool:
        self._require_model()
        return self._model is not None

    def transcribe(self, audio_path: str, language: str = "auto") -> object:
        if not self.is_available():
            raise RuntimeError(
                "stt-vosk-en model is not installed. Open Settings > Models to install it."
            )
        import wave

        from app.ai.stt.base import SttResult

        with wave.open(audio_path, "rb") as wav:
            import vosk  # type: ignore

            rec = vosk.KaldiRecognizer(self._model, wav.getframerate())
            rec.SetWords(True)
            audio = wav.readframes(wav.getnframes())
            rec.AcceptWaveform(audio)
            result = rec.FinalResult()
        import json

        payload = json.loads(result)
        text = payload.get("text", "").strip()
        confidence = 1.0
        words = payload.get("result")
        if words:
            confidence = sum(float(w.get("conf", 1.0)) for w in words) / len(words)
        return SttResult(text=text, confidence=confidence, engine="vosk", model_id=self.model_id)