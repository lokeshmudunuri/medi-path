"""LocalAIEngine: the single facade the rest of the app uses to reach the
four on-device AI capabilities.

It is a provider *factory*: it inspects the Model Manager to decide between
the real local provider (when the model is installed) and the clearly-labelled
mock provider (for tests / before model installation). The mock providers
always report engine="mock" so downstream code can never confuse synthetic
output with real model output.

Force-mock can be switched via env LOCALMED_FORCE_MOCK=1 (used by tests).
"""
from __future__ import annotations

import os

from app.ai.llm.base import LlmRequest, LlmResponse
from app.ai.llm.local_provider import LocalLLMProvider
from app.ai.ocr.base import OcrResult
from app.ai.ocr.mock_ocr import MockOcrProvider
from app.ai.ocr.rapidocr_provider import RapidOcrProvider
from app.ai.stt.base import SttResult
from app.ai.stt.mock_stt import MockSttProvider
from app.ai.stt.vosk_provider import VoskSttProvider
from app.ai.tts.base import TtsResult
from app.ai.tts.mock_tts import MockTtsProvider
from app.ai.tts.platform_tts import PlatformTtsProvider
from app.ai.tts.piper_provider import PiperTtsProvider
from app.core.model_manager import ModelDownloadManager, default_manager
from app.domain.enums import ModelState
from app.utils.logging import get_logger

log = get_logger("ai.engine")


class LocalAIEngine:
    def __init__(self, manager: ModelDownloadManager = default_manager) -> None:
        self.manager = manager
        self.force_mock = os.environ.get("LOCALMED_FORCE_MOCK", "0") == "1"

    # ------------------------------------------------------------- helpers
    def _installed(self, model_id: str) -> bool:
        return self.force_mock or self.manager.is_model_installed(model_id)

    # ----------------------------------------------------------------- OCR
    def get_ocr_provider(self):
        mock = MockOcrProvider()
        if self.force_mock:
            return mock
        if self._installed("ocr-rapidocr"):
            provider = RapidOcrProvider()
            if provider.is_available():
                return provider
        return mock

    def ocr_recognize(self, image_path: str) -> OcrResult:
        return self.get_ocr_provider().recognize(image_path)

    # ----------------------------------------------------------------- STT
    def get_stt_provider(self):
        mock = MockSttProvider()
        if self.force_mock:
            return mock
        if self._installed("stt-vosk-en"):
            provider = VoskSttProvider()
            if provider.is_available():
                return provider
        return mock

    def transcribe(self, audio_path: str, language: str = "auto") -> SttResult:
        return self.get_stt_provider().transcribe(audio_path, language)

    # ----------------------------------------------------------------- TTS
    def get_tts_provider(self):
        if self.force_mock:
            return MockTtsProvider()
        if self._installed("tts-piper-en"):
            provider = PiperTtsProvider()
            if provider.is_available():
                return provider
        platform = PlatformTtsProvider()
        if platform.is_available():
            return platform
        return MockTtsProvider()

    def synthesize(self, text: str, output_path: str, language: str = "en") -> TtsResult:
        return self.get_tts_provider().synthesize(text, output_path, language)

    # ----------------------------------------------------------------- LLM
    def get_llm_provider(self) -> LocalLLMProvider:
        """Return the offline LLM facade (Ollama with labelled mock fallback)."""
        return LocalLLMProvider()

    def complete(self, request: LlmRequest) -> LlmResponse:
        return self.get_llm_provider().complete(request)

    def llm_status(self) -> dict:
        """Authoritative LLM/Ollama status snapshot for the UI (see provider)."""
        return self.get_llm_provider().status()


engine = LocalAIEngine()