"""Piper (ONNX) text-to-speech provider.

Piper voices are downloaded by the Model Download Manager into the managed
model directory. `piper` may run as `python -m piper`; we probe for the
bundled binary or module. The provider is configured lazily and reports
unavailable when the voice model or runtime is not installed.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from app.config import settings
from app.ai.tts.base import TtsResult
from app.utils.logging import get_logger

log = get_logger("tts.piper")


class PiperTtsProvider:
    model_id = "tts-piper-en"

    def __init__(self, voice: str = "en_US-lessac-medium") -> None:
        self.voice = voice
        self._binary = self._find_piper()

    @staticmethod
    def _find_piper() -> str | None:
        for candidate in ("piper", "piper.exe"):
            found = shutil.which(candidate)
            if found:
                return found
        return None

    def _install_dir(self) -> Path:
        return Path(settings.model_dir) / self.model_id / "tts" / "piper-en"

    def is_available(self) -> bool:
        install_dir = self._install_dir()
        voice_onx = install_dir / f"{self.voice}.onnx"
        voice_json = install_dir / f"{self.voice}.onnx.json"
        if self._binary is None:
            return False
        return voice_onx.exists() and voice_json.exists()

    def synthesize(self, text: str, output_path: str, language: str = "en") -> TtsResult:
        if not self.is_available():
            raise RuntimeError(
                "tts-piper-en model is not installed. Open Settings > Models to install it."
            )
        install_dir = self._install_dir()
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            self._binary,
            "--model",
            str(install_dir / f"{self.voice}.onnx"),
            "--config",
            str(install_dir / f"{self.voice}.onnx.json"),
            "--output_file",
            output_path,
        ]
        completed = subprocess.run(
            cmd,
            input=text.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
        )
        if completed.returncode != 0:
            raise RuntimeError(
                f"Piper synthesis failed: {completed.stderr.decode('utf-8', 'replace')}"
            )
        return TtsResult(audio_path=output_path, engine="piper", model_id=self.model_id)