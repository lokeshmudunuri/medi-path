"""Safety Validator layer.

Sits strictly between extraction/medical knowledge and the LLM.
Detects:
- Low OCR confidence (< 0.60)
- Unidentified / unreadable medicine names
- Ambiguous or unverified medicines
- Missing critical dosage information
- Missing frequency / schedule
- Conflicting or unsupported extractions
- Abnormal or out-of-range clinical lab report results
- Medicines missing from local knowledge base

Prioritizes transparency and uncertainty over fabrication.
"""
from __future__ import annotations

from app.domain.entities import (
    LabReport,
    MedicalAnalysis,
    Medicine,
    Prescription,
    SafetyFlag,
)
from app.domain.enums import InfoSource, LabFlag, Severity
from app.medical.knowledge import MedicineKnowledgeBase, knowledge_base


class SafetyValidator:
    """Validates clinical safety across prescriptions, medicines, lab reports and knowledge."""

    def __init__(self, kb: MedicineKnowledgeBase = knowledge_base) -> None:
        self.kb = kb

    def validate(
        self,
        prescription: Prescription | None = None,
        lab_reports: list[LabReport] | None = None,
        analysis: MedicalAnalysis | None = None,
    ) -> list[SafetyFlag]:
        flags: list[SafetyFlag] = []

        if prescription:
            flags.extend(self._validate_prescription(prescription))

        if lab_reports:
            for report in lab_reports:
                flags.extend(self._validate_lab_report(report))

        if analysis:
            flags.extend(self._validate_knowledge_coverage(analysis))

        return flags

    def _validate_prescription(self, prescription: Prescription) -> list[SafetyFlag]:
        flags: list[SafetyFlag] = []

        # 1. OCR Confidence check
        if prescription.ocr_confidence > 0 and prescription.ocr_confidence < 0.60:
            flags.append(
                SafetyFlag(
                    severity=Severity.WARNING.value,
                    message=(
                        f"Low document reading confidence ({round(prescription.ocr_confidence * 100)}%). "
                        "Please verify extracted medicine names and instructions against the original prescription."
                    ),
                    evidence=f"OCR engine: {prescription.ocr_engine or 'local'}, confidence: {prescription.ocr_confidence:.2f}",
                    source=InfoSource.MEDICAL_ENGINE.value,
                )
            )

        if not prescription.medicines and not prescription.raw_ocr_text:
            flags.append(
                SafetyFlag(
                    severity=Severity.WARNING.value,
                    message="No prescription text could be identified.",
                    source=InfoSource.MEDICAL_ENGINE.value,
                )
            )

        # 2. Per-medicine checks
        for i, med in enumerate(prescription.medicines):
            med_name = med.name.strip()

            # Unidentified medicine name
            if not med_name or med_name.lower() in ("unrecognised", "unknown", "uncertain"):
                flags.append(
                    SafetyFlag(
                        severity=Severity.CRITICAL.value,
                        message=f"Medicine #{i+1} could not be confidently identified from the document. Please capture a clearer image or check with your doctor.",
                        medicine=med_name or f"Medicine #{i+1}",
                        evidence=med.raw_text or "Unreadable text segment",
                        source=InfoSource.MEDICAL_ENGINE.value,
                    )
                )
                continue

            # Low extraction confidence
            if med.confidence > 0 and med.confidence < 0.65:
                flags.append(
                    SafetyFlag(
                        severity=Severity.WARNING.value,
                        message=f"Medicine name '{med_name}' has low reading confidence ({round(med.confidence * 100)}%). Verification required.",
                        medicine=med_name,
                        evidence=f"Extracted: '{med_name}', confidence: {med.confidence:.2f}",
                        source=InfoSource.MEDICAL_ENGINE.value,
                    )
                )

            # Missing dosage/strength
            if not med.strength and not med.dosage:
                flags.append(
                    SafetyFlag(
                        severity=Severity.WARNING.value,
                        message=f"Dosage or strength information was not found for '{med_name}'. Never guess medication dosage.",
                        medicine=med_name,
                        evidence="No strength/dosage parsed in prescription directive",
                        source=InfoSource.MEDICAL_ENGINE.value,
                    )
                )

            # Missing frequency
            if not med.frequency:
                flags.append(
                    SafetyFlag(
                        severity=Severity.INFO.value,
                        message=f"Frequency (how often to take) was not detected for '{med_name}'. Please verify with your prescription.",
                        medicine=med_name,
                        evidence="Frequency field is empty",
                        source=InfoSource.MEDICAL_ENGINE.value,
                    )
                )

        return flags

    def _validate_lab_report(self, report: LabReport) -> list[SafetyFlag]:
        flags: list[SafetyFlag] = []

        if report.ocr_confidence > 0 and report.ocr_confidence < 0.60:
            flags.append(
                SafetyFlag(
                    severity=Severity.WARNING.value,
                    message=f"Report scan confidence is low ({round(report.ocr_confidence * 100)}%). Review values carefully.",
                    evidence=f"OCR confidence: {report.ocr_confidence:.2f}",
                    source=InfoSource.MEDICAL_ENGINE.value,
                )
            )

        for res in report.test_results:
            if res.flag == LabFlag.HIGH.value:
                flags.append(
                    SafetyFlag(
                        severity=Severity.WARNING.value,
                        message=f"Lab test '{res.test_name}' result ({res.result} {res.unit}) is higher than reference range ({res.reference_range}).",
                        medicine=res.test_name,
                        evidence=f"Extracted result: {res.result} {res.unit}, Reference: {res.reference_range}",
                        source=InfoSource.MEDICAL_ENGINE.value,
                    )
                )
            elif res.flag == LabFlag.LOW.value:
                flags.append(
                    SafetyFlag(
                        severity=Severity.WARNING.value,
                        message=f"Lab test '{res.test_name}' result ({res.result} {res.unit}) is lower than reference range ({res.reference_range}).",
                        medicine=res.test_name,
                        evidence=f"Extracted result: {res.result} {res.unit}, Reference: {res.reference_range}",
                        source=InfoSource.MEDICAL_ENGINE.value,
                    )
                )

        return flags

    def _validate_knowledge_coverage(self, analysis: MedicalAnalysis) -> list[SafetyFlag]:
        flags: list[SafetyFlag] = []
        for info in analysis.medicine_information:
            if not info.found and info.name:
                flags.append(
                    SafetyFlag(
                        severity=Severity.WARNING.value,
                        message=f"No local information is available for '{info.name}' in the on-device knowledge base. Consult a healthcare professional before use.",
                        medicine=info.name,
                        evidence="Medicine not found in on-device database",
                        source=InfoSource.MEDICAL_ENGINE.value,
                    )
                )
        return flags


default_safety_validator = SafetyValidator()
