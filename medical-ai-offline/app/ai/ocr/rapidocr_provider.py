"""RapidOCR-backed local OCR provider.

The ONNX models are loaded from the app-managed model directory (managed by
the Model Download Manager), never from package data. RapidOCR is imported
lazily so the base application runs without it; when the models or the
dependency are missing, is_available() reports False and the caller routes
to the Model Setup UI.
"""
from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.utils.logging import get_logger

log = get_logger("ocr.rapidocr")


class RapidOcrProvider:
    model_id = "ocr-rapidocr"

    def __init__(self) -> None:
        self._engine = None
        self._require_dependency()

    def _require_dependency(self) -> None:
        if self._engine is not None:
            return
        try:
            from rapidocr_onnxruntime import RapidOCR  # type: ignore
        except ImportError:
            self._engine = None
            return
        model_dir: Path = Path(settings.model_dir) / self.model_id / "ocr" / "rapidocr"
        onnx_files = list(model_dir.glob("*.onnx"))
        if not onnx_files:
            self._engine = None
            return
        try:
            det = next((f for f in onnx_files if "det" in f.name.lower()), None)
            rec = next((f for f in onnx_files if "rec" in f.name.lower()), None)
            cls = next((f for f in onnx_files if "cls" in f.name.lower()), None)
            kwargs = {}
            if det:
                kwargs["det_model_path"] = str(det)
            if rec:
                kwargs["rec_model_path"] = str(rec)
            if cls:
                kwargs["cls_model_path"] = str(cls)
            if not kwargs:
                kwargs["model_dir"] = str(model_dir)
            self._engine = RapidOCR(**kwargs)
            log.info("RapidOCR initialised with %s", kwargs)
        except Exception as exc:  # corrupt model files
            log.warning("RapidOCR init failed: %s", exc)
            self._engine = None

    def is_available(self) -> bool:
        self._require_dependency()
        return self._engine is not None

    def recognize(self, image_path: str) -> object:
        if not self.is_available():
            raise RuntimeError(
                "ocr-rapidocr model is not installed. Open Settings > Models to install it."
            )
        result, _ = self._engine(str(image_path))
        if not result:
            from app.ai.ocr.base import OcrResult

            return OcrResult(text="", confidence=0.0, engine="rapidocr", model_id=self.model_id)
        lines = []
        for box, text, score in result:
            if text is None:
                continue
            lines.append({"text": str(text), "confidence": float(score or 0.0), "box": box})
        text = "\n".join(item["text"] for item in lines)
        avg_conf = (
            sum(item["confidence"] for item in lines) / len(lines) if lines else 0.0
        )
        from app.ai.ocr.base import OcrResult

        return OcrResult(
            text=text,
            confidence=avg_conf,
            engine="rapidocr",
            model_id=self.model_id,
            segments=lines,
        )