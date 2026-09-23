"""Medicine parsing tests — rule-based extraction, no LLM."""
from __future__ import annotations

from pathlib import Path

from app.domain.enums import Route, Timing
from app.parsing.extractor import MedicineExtractor
from app.parsing.normalization import normalize_text, normalize_units

SAMPLE_DIR = Path(__file__).resolve().parent / "fixtures" / "sample_prescriptions"


def load(name: str) -> str:
    return (SAMPLE_DIR / f"{name}.txt").read_text(encoding="utf-8")


def test_normalize_text_basic():
    assert normalize_text("  Tab.  Paracetamol 500  MG  ") == "tablet paracetamol 500 mg"


def test_normalize_units():
    assert normalize_units("5 ml of syrup 3 times a day") == "5 ml of syrup 3 times a day"
    assert "mcg" in normalize_units("take 25 micro gram")


def test_paracetamol_extraction():
    extractor = MedicineExtractor()
    result = extractor.extract(load("paracetamol"))
    medicines = result.prescription.medicines
    assert len(medicines) == 1
    med = medicines[0]
    assert med.name == "paracetamol" or "paracetamol" in med.name
    assert "500 mg" in med.strength
    assert med.frequency == "three times a day"
    assert med.duration == "5 days"
    assert med.route == Route.ORAL.value
    assert med.timing == Timing.AFTER_FOOD.value
    assert result.prescription.date == "12/03/2026"


def test_multi_medicine_extraction():
    extractor = MedicineExtractor()
    result = extractor.extract(load("sample_multi"))
    names = [m.name for m in result.prescription.medicines]
    assert len(result.prescription.medicines) >= 3
    assert "amoxicillin" in str(names)
    assert "  " not in result.prescription.raw_ocr_text.replace(" ", "")


def test_unknown_medicine_flags_verification():
    extractor = MedicineExtractor()
    text = "Tab. Zathrazorium 250 mg 1-0-1 for 3 days"
    result = extractor.extract(text)
    assert result.prescription.medicines
    medicine = result.prescription.medicines[0]
    assert medicine.needs_verification is True
    assert medicine.confidence <= 0.62


def test_low_ocr_confidence_kept():
    extractor = MedicineExtractor()
    result = extractor.extract("weird unparseable line", ocr_confidence=0.4)
    for medicine in result.prescription.medicines:
        assert medicine.confidence <= 0.8


def test_no_medicine_line_unmatched():
    extractor = MedicineExtractor()
    result = extractor.extract("Bring the reports tomorrow for review.")
    assert not result.prescription.medicines
    assert result.unmatched_lines


def test_dose_schedule_derives_frequency():
    extractor = MedicineExtractor()
    prescription = extractor.extract("Tab Aspirin 75 mg 1-1-1/2 for 7 days").prescription
    assert prescription.medicines
    assert prescription.medicines[0].frequency or prescription.medicines[0].dosage