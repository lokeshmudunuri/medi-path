"""Comprehensive unit & integration tests for restructured medical pipeline:
- Clinical Lab Report extraction
- Unknown medicine detection
- SafetyValidator flags
- MedicalKnowledgeRepository query
- Report verification
"""
from __future__ import annotations

import io
from PIL import Image

from app.domain.entities import LabReport, LabTestResult, Medicine, Prescription
from app.domain.enums import LabFlag, Severity
from app.medical.safety_validator import SafetyValidator
from app.parsing.report_extractor import LabReportExtractor


def test_lab_report_extractor_identifies_tests_and_flags():
    extractor = LabReportExtractor()
    ocr_sample = """
    METROPOLIS PATHOLOGY LAB
    Patient Name: Alice Smith
    Dr. Kumar
    Date: 15/03/2026

    Hemoglobin: 10.2 g/dL (12.0 - 17.5) Low
    Fasting Blood Sugar: 135 mg/dL (70 - 99) High
    Serum Creatinine: 0.9 mg/dL (0.6 - 1.3)
    Platelets: 220000 /mcL (150000 - 450000)
    """
    res = extractor.extract(ocr_sample, ocr_confidence=0.92, ocr_engine="mock")
    report = res.report

    assert report.patient_info == "Alice Smith"
    assert "Kumar" in report.doctor_info
    assert len(report.test_results) >= 4

    tests_by_name = {t.test_name.lower(): t for t in report.test_results}
    assert "hemoglobin" in tests_by_name
    hb = tests_by_name["hemoglobin"]
    assert hb.result == "10.2"
    assert hb.flag == LabFlag.LOW.value

    fbs = tests_by_name["fasting blood sugar"]
    assert fbs.result == "135"
    assert fbs.flag == LabFlag.HIGH.value

    creat = tests_by_name["serum creatinine"]
    assert creat.result == "0.9"
    assert creat.flag == LabFlag.NORMAL.value


def test_safety_validator_catches_uncertain_medicine_and_low_ocr():
    validator = SafetyValidator()
    
    # 1. Low OCR confidence prescription
    p = Prescription(
        ocr_confidence=0.45,
        medicines=[
            Medicine(name="", raw_text="illegible scribble", confidence=0.3),
            Medicine(name="amoxicillin", strength="", dosage="", confidence=0.8),
        ]
    )
    flags = validator.validate(prescription=p)
    severities = [f.severity for f in flags]

    assert Severity.WARNING.value in severities
    assert Severity.CRITICAL.value in severities
    assert any("could not be confidently identified" in f.message for f in flags)
    assert any("Dosage or strength information was not found" in f.message for f in flags)


def test_safety_validator_flags_abnormal_lab_results():
    validator = SafetyValidator()
    rep = LabReport(
        test_results=[
            LabTestResult(test_name="Fasting Blood Sugar", result="140", unit="mg/dL", reference_range="70 - 99 mg/dL", flag=LabFlag.HIGH.value),
            LabTestResult(test_name="Hemoglobin", result="9.5", unit="g/dL", reference_range="12.0 - 17.5 g/dL", flag=LabFlag.LOW.value),
        ]
    )
    flags = validator.validate(lab_reports=[rep])
    assert len(flags) == 2
    assert any("higher than reference range" in f.message for f in flags)
    assert any("lower than reference range" in f.message for f in flags)


def test_lab_report_pipeline_end_to_end(case_service, fresh_db, tmp_path):
    image = Image.new("RGB", (140, 80), "white")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    image_bytes = buffer.getvalue()

    case = case_service.create_from_image(
        image_bytes,
        name="Dad — Blood Test",
        original_filename="sample_lab_report.jpg",
        document_type="lab_report"
    )

    assert case.id
    assert case.name == "Dad — Blood Test"
    assert len(case.lab_reports) == 1
    rep = case.lab_reports[0]
    assert len(rep.test_results) > 0

    # Ensure abnormal flags exist
    assert any(f.severity in (Severity.WARNING.value, Severity.CRITICAL.value) for f in case.analysis.safety_flags)

    # Verify report results
    case_service.verify_reports(case.id, [{"index": 0}])
    updated = case_service.get(case.id)
    assert updated.lab_reports[0].test_results[0].verified_by_user is True
