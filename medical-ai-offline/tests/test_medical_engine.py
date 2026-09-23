"""Medical engine tests — deterministic local knowledge base rules."""
from __future__ import annotations

from app.domain.entities import Medicine, Prescription
from app.domain.enums import Severity
from app.medical.engine import MedicalEngine
from app.parsing.extractor import MedicineExtractor

SAMPLE_DIR = __import__("pathlib").Path(__file__).resolve().parent / "fixtures" / "sample_prescriptions"


def analyze_from_text(text: str):
    extractor = MedicineExtractor()
    prescription = extractor.extract(text).prescription
    engine = MedicalEngine()
    return prescription, engine.analyze(prescription)


def test_known_medicine_info_present():
    _, analysis = analyze_from_text("Tab Paracetamol 500 mg 1-1-1 for 5 days")
    paracetamol = next(
        (m for m in analysis.medicine_information if m.name == "paracetamol"), None
    )
    assert paracetamol is not None
    assert paracetamol.found is True
    assert paracetamol.indications_summary


def test_unknown_medicine_reports_not_available():
    prescription, analysis = analyze_from_text("Cap Zathrazorium 250 mg 1 bd for 3 days")
    info = next(
        (m for m in analysis.medicine_information if m.name == "zathrazorium"), None
    )
    assert info is not None
    assert info.found is False
    assert "not available" in info.indications_summary.lower()
    # A warning/flag must exist so the UI surfaces it.
    assert any(flag.severity == Severity.WARNING.value for flag in analysis.safety_flags)


def test_interaction_detection():
    _, analysis = analyze_from_text(
        "Tab Ibuprofen 400 mg 1 tds for 5 days\nTab Aspirin 75 mg 1 od"
    )
    flag = next(
        (
            f
            for f in analysis.safety_flags
            if "ibuprofen" in f.message.lower() and "aspirin" in f.message.lower()
        ),
        None,
    )
    assert flag is not None
    assert flag.severity == Severity.CRITICAL.value
    assert "bleeding" in flag.message.lower()


def test_diet_rules_from_knowledge():
    _, analysis = analyze_from_text("Tab Metformin 500 mg 1-0-1 with food for 30 days")
    rules = [d.text for d in analysis.diet_rules]
    assert any("food" in r.lower() or "meal" in r.lower() for r in rules)


def test_takeaways_from_knowledge():
    _, analysis = analyze_from_text("Tab Amoxicillin 250 mg 1 tds x 5 days")
    texts = [t.text for t in analysis.takeaways]
    assert any("course" in t.lower() for t in texts)


def test_empty_prescription_warns():
    engine = MedicalEngine()
    analysis = engine.analyze(Prescription())
    assert analysis.warnings
    assert not analysis.medicine_information


def test_engine_version_recorded():
    _, analysis = analyze_from_text("Tab Paracetamol 500 mg 1 tds")
    assert analysis.engine_version