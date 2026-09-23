"""Domain entities (plain, serialisable objects).

These models are the single source of truth for case data flowing through the
OCR -> extraction -> medical engine -> storage -> chat pipeline. They are
deliberately framework-free so they can be serialised to JSON, stored in
SQLite, and served to the UI without leaking ORM specifics.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.enums import (
    InfoSource,
    MessageRole,
    ModelState,
    Route,
    Severity,
    Timing,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


@dataclass
class Medicine:
    """A single medicine entry extracted from a prescription."""

    name: str = ""
    strength: str = ""          # e.g. "500 mg"
    dosage: str = ""            # e.g. "1 tablet"
    frequency: str = ""         # e.g. "3 times a day"
    duration: str = ""          # e.g. "5 days"
    route: str = Route.UNKNOWN.value
    timing: str = Timing.UNKNOWN.value
    raw_text: str = ""
    confidence: float = 0.0
    verified_by_user: bool = False
    notes: str = ""
    needs_verification: bool = False

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "strength": self.strength,
            "dosage": self.dosage,
            "frequency": self.frequency,
            "duration": self.duration,
            "route": self.route,
            "timing": self.timing,
            "raw_text": self.raw_text,
            "confidence": round(self.confidence, 3),
            "verified_by_user": self.verified_by_user,
            "notes": self.notes,
            "needs_verification": self.needs_verification,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Medicine":
        m = cls()
        for key in (
            "name",
            "strength",
            "dosage",
            "frequency",
            "duration",
            "route",
            "timing",
            "raw_text",
            "notes",
        ):
            setattr(m, key, data.get(key, ""))
        m.confidence = data.get("confidence", 0.0)
        m.verified_by_user = data.get("verified_by_user", False)
        m.needs_verification = data.get("needs_verification", False)
        return m


@dataclass
class Prescription:
    """Structured representation of a scanned prescription."""

    patient_info: str = ""
    doctor_info: str = ""
    date: str = ""
    medicines: list[Medicine] = field(default_factory=list)
    instructions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    source_image: str = ""
    raw_ocr_text: str = ""
    ocr_engine: str = ""
    ocr_confidence: float = 0.0

    def to_dict(self) -> dict:
        return {
            "patient_info": self.patient_info,
            "doctor_info": self.doctor_info,
            "date": self.date,
            "medicines": [m.to_dict() for m in self.medicines],
            "instructions": self.instructions,
            "warnings": self.warnings,
            "source_image": self.source_image,
            "raw_ocr_text": self.raw_ocr_text,
            "ocr_engine": self.ocr_engine,
            "ocr_confidence": round(self.ocr_confidence, 3),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Prescription":
        p = cls()
        p.patient_info = data.get("patient_info", "")
        p.doctor_info = data.get("doctor_info", "")
        p.date = data.get("date", "")
        p.medicines = [Medicine.from_dict(m) for m in data.get("medicines", [])]
        p.instructions = list(data.get("instructions", []))
        p.warnings = list(data.get("warnings", []))
        p.source_image = data.get("source_image", "")
        p.raw_ocr_text = data.get("raw_ocr_text", "")
        p.ocr_engine = data.get("ocr_engine", "")
        p.ocr_confidence = data.get("ocr_confidence", 0.0)
        return p


@dataclass
class LabTestResult:
    """A single laboratory test result extracted from a medical report."""

    test_name: str = ""
    result: str = ""
    unit: str = ""
    reference_range: str = ""
    flag: str = "unknown"  # normal | high | low | abnormal | unknown
    confidence: float = 0.0
    verified_by_user: bool = False
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "test_name": self.test_name,
            "result": self.result,
            "unit": self.unit,
            "reference_range": self.reference_range,
            "flag": self.flag,
            "confidence": round(self.confidence, 3),
            "verified_by_user": self.verified_by_user,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "LabTestResult":
        item = cls()
        for key in ("test_name", "result", "unit", "reference_range", "flag", "notes"):
            setattr(item, key, data.get(key, ""))
        item.confidence = data.get("confidence", 0.0)
        item.verified_by_user = data.get("verified_by_user", False)
        return item


@dataclass
class LabReport:
    """Structured representation of a laboratory/medical diagnostic report."""

    patient_info: str = ""
    doctor_info: str = ""
    lab_name: str = ""
    date: str = ""
    test_results: list[LabTestResult] = field(default_factory=list)
    instructions: list[str] = field(default_factory=list)
    source_document: str = ""
    raw_ocr_text: str = ""
    ocr_engine: str = ""
    ocr_confidence: float = 0.0

    def to_dict(self) -> dict:
        return {
            "patient_info": self.patient_info,
            "doctor_info": self.doctor_info,
            "lab_name": self.lab_name,
            "date": self.date,
            "test_results": [t.to_dict() for t in self.test_results],
            "instructions": self.instructions,
            "source_document": self.source_document,
            "raw_ocr_text": self.raw_ocr_text,
            "ocr_engine": self.ocr_engine,
            "ocr_confidence": round(self.ocr_confidence, 3),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "LabReport":
        r = cls()
        r.patient_info = data.get("patient_info", "")
        r.doctor_info = data.get("doctor_info", "")
        r.lab_name = data.get("lab_name", "")
        r.date = data.get("date", "")
        r.test_results = [LabTestResult.from_dict(t) for t in data.get("test_results", [])]
        r.instructions = list(data.get("instructions", []))
        r.source_document = data.get("source_document", "")
        r.raw_ocr_text = data.get("raw_ocr_text", "")
        r.ocr_engine = data.get("ocr_engine", "")
        r.ocr_confidence = data.get("ocr_confidence", 0.0)
        return r


@dataclass
class SafetyFlag:
    severity: str
    message: str
    medicine: str = ""
    evidence: str = ""
    source: str = InfoSource.MEDICAL_ENGINE.value

    def to_dict(self) -> dict:
        return {
            "severity": self.severity,
            "message": self.message,
            "medicine": self.medicine,
            "evidence": self.evidence,
            "source": self.source,
        }


@dataclass
class Takeaway:
    text: str
    medicine: str = ""
    source: str = InfoSource.MEDICAL_ENGINE.value

    def to_dict(self) -> dict:
        return {"text": self.text, "medicine": self.medicine, "source": self.source}


@dataclass
class DietRule:
    text: str
    medicine: str = ""
    source: str = InfoSource.MEDICAL_ENGINE.value

    def to_dict(self) -> dict:
        return {"text": self.text, "medicine": self.medicine, "source": self.source}


@dataclass
class MedicineInformation:
    name: str
    found: bool
    generic_name: str = ""
    category: str = ""
    indications_summary: str = ""
    common_side_effects: list[str] = field(default_factory=list)
    cautions: list[str] = field(default_factory=list)
    source: str = "local_database"
    evidence: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "found": self.found,
            "generic_name": self.generic_name,
            "category": self.category,
            "indications_summary": self.indications_summary,
            "common_side_effects": list(self.common_side_effects),
            "cautions": list(self.cautions),
            "source": self.source,
            "evidence": self.evidence,
        }


@dataclass
class MedicalAnalysis:
    """Deterministic output of the local medical engine."""

    safety_flags: list[SafetyFlag] = field(default_factory=list)
    takeaways: list[Takeaway] = field(default_factory=list)
    diet_rules: list[DietRule] = field(default_factory=list)
    medicine_information: list[MedicineInformation] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)
    engine_version: str = "1.0.0"

    def to_dict(self) -> dict:
        return {
            "safety_flags": [f.to_dict() for f in self.safety_flags],
            "takeaways": [t.to_dict() for t in self.takeaways],
            "diet_rules": [d.to_dict() for d in self.diet_rules],
            "medicine_information": [m.to_dict() for m in self.medicine_information],
            "warnings": list(self.warnings),
            "evidence": list(self.evidence),
            "engine_version": self.engine_version,
        }


@dataclass
class Case:
    """A named local case file created from one or more medical documents."""

    id: str = field(default_factory=new_id)
    name: str = ""
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)
    document_type: str = "prescription"  # prescription | lab_report | mixed
    original_documents: list[str] = field(default_factory=list)
    prescription: Prescription = field(default_factory=Prescription)
    lab_reports: list[LabReport] = field(default_factory=list)
    analysis: MedicalAnalysis = field(default_factory=MedicalAnalysis)
    ocr_source: str = ""
    engine_version: str = ""
    notes: str = ""
    archived: bool = False

    def touch(self) -> None:
        self.updated_at = utc_now()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "document_type": self.document_type,
            "original_documents": list(self.original_documents),
            "prescription": self.prescription.to_dict(),
            "lab_reports": [r.to_dict() for r in self.lab_reports],
            "analysis": self.analysis.to_dict(),
            "ocr_source": self.ocr_source,
            "engine_version": self.engine_version,
            "notes": self.notes,
            "archived": self.archived,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Case":
        case = cls()
        case.id = data.get("id", new_id())
        case.name = data.get("name", "")
        case.created_at = data.get("created_at", utc_now())
        case.updated_at = data.get("updated_at", utc_now())
        case.document_type = data.get("document_type", "prescription")
        case.original_documents = list(data.get("original_documents", []))
        case.prescription = Prescription.from_dict(data.get("prescription", {}))
        case.lab_reports = [LabReport.from_dict(r) for r in data.get("lab_reports", [])]
        analysis = data.get("analysis", {})
        case.analysis = MedicalAnalysis.from_dict(analysis)
        case.ocr_source = data.get("ocr_source", "")
        case.engine_version = data.get("engine_version", "")
        case.notes = data.get("notes", "")
        case.archived = data.get("archived", False)
        return case



@dataclass
class ChatMessage:
    id: str = field(default_factory=new_id)
    case_id: str = ""
    role: str = MessageRole.USER.value
    content: str = ""
    created_at: str = field(default_factory=utc_now)
    source: str = InfoSource.LLM.value
    media_path: str = ""   # audio file for voice messages
    input_kind: str = "text"   # text | voice

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "case_id": self.case_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at,
            "source": self.source,
            "media_path": self.media_path,
            "input_kind": self.input_kind,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ChatMessage":
        msg = cls()
        msg.id = data.get("id", new_id())
        msg.case_id = data.get("case_id", "")
        msg.role = data.get("role", MessageRole.USER.value)
        msg.content = data.get("content", "")
        msg.created_at = data.get("created_at", utc_now())
        msg.source = data.get("source", InfoSource.LLM.value)
        msg.media_path = data.get("media_path", "")
        msg.input_kind = data.get("input_kind", "text")
        return msg


def medical_analysis_from_dict(data: dict) -> MedicalAnalysis:
    analysis = MedicalAnalysis()
    analysis.safety_flags = [
        SafetyFlag(
            severity=f.get("severity", Severity.INFO.value),
            message=f.get("message", ""),
            medicine=f.get("medicine", ""),
            evidence=f.get("evidence", ""),
            source=f.get("source", InfoSource.MEDICAL_ENGINE.value),
        )
        for f in data.get("safety_flags", [])
    ]
    analysis.takeaways = [
        Takeaway(t.get("text", ""), t.get("medicine", ""), t.get("source", InfoSource.MEDICAL_ENGINE.value))
        for t in data.get("takeaways", [])
    ]
    analysis.diet_rules = [
        DietRule(d.get("text", ""), d.get("medicine", ""), d.get("source", InfoSource.MEDICAL_ENGINE.value))
        for d in data.get("diet_rules", [])
    ]
    analysis.medicine_information = []
    for m in data.get("medicine_information", []):
        med = MedicineInformation(
            name=m.get("name", ""),
            found=m.get("found", False),
            generic_name=m.get("generic_name", ""),
            category=m.get("category", ""),
            indications_summary=m.get("indications_summary", ""),
            source=m.get("source", "local_database"),
            evidence=m.get("evidence", ""),
        )
        med.common_side_effects = list(m.get("common_side_effects", []))
        med.cautions = list(m.get("cautions", []))
        analysis.medicine_information.append(med)
    analysis.warnings = list(data.get("warnings", []))
    analysis.evidence = list(data.get("evidence", []))
    analysis.engine_version = data.get("engine_version", "1.0.0")
    return analysis


MedicalAnalysis.from_dict = staticmethod(medical_analysis_from_dict)