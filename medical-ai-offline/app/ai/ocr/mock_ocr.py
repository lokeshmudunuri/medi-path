"""Deterministic OCR provider for tests and for the case where the OCR model
is not yet installed.

It is clearly labelled as a mock: the engine name is "mock" and confidence
reflects uncertainty. Images whose file name is ``<sample-key>.*`` map to one
of the bundled sample prescriptions; every other image returns a low-confidence
fallback that forces the UI into the "Please verify this medicine" path.
"""
from __future__ import annotations

from pathlib import Path

from app.ai.ocr.base import OcrResult

_FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "tests" / "fixtures"
_SAMPLE_DIR = _FIXTURES_DIR / "sample_prescriptions"
_FALLBACK = (
    "Rx\nPara TAB 1-1-1 for 5 days\n"
    "Result: uncertain"
)

SAMPLE_KEYS = ("paracetamol_sample", "sample_multi", "sample_lab_report", "blood_test_sample")

_SAMPLE_FILE = {
    "paracetamol_sample": "paracetamol",
    "sample_multi": "sample_multi",
    "sample_lab_report": "sample_lab_report",
    "blood_test_sample": "sample_lab_report",
}


def load_sample(name: str) -> str:
    path = _SAMPLE_DIR / f"{_SAMPLE_FILE.get(name, name)}.txt"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return _FALLBACK


class MockOcrProvider:
    """Deterministic OCR substitute."""

    model_id = "mock-ocr"

    def is_available(self) -> bool:
        return True

    def recognize(self, image_path: str) -> OcrResult:
        key = self._key_for_path(Path(image_path))
        if not key:
            return OcrResult(
                text=_FALLBACK,
                confidence=0.55,
                engine="mock",
                segments=[{"text": _FALLBACK, "confidence": 0.55}],
            )
        text = load_sample(key)
        return OcrResult(
            text=text,
            confidence=0.94,
            engine="mock",
            segments=[{"text": text, "confidence": 0.94}],
        )

    @staticmethod
    def _key_for_path(path: Path) -> str:
        """Derive a deterministic fixture key from the image file name.

        Files named ``<sample-key>.*`` map to a bundled sample prescription
        (e.g. ``paracetamol_sample.jpg``). Every other image exercises the
        low-confidence fallback path that forces medicine verification.
        """
        stem = path.stem.lower()
        for sample in SAMPLE_KEYS:
            if stem == sample or stem.startswith(sample):
                return sample
        return ""