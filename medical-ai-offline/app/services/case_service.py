"""Case service: orchestrates the full prescription-to-case pipeline.

    image -> preprocess -> OCR -> extract -> (user verify) -> medical engine
    -> store case locally

The service is the single entry point used by the API layer.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.ai.engine import LocalAIEngine, engine as default_engine
from app.ai.ocr.preprocess import preprocessor
from app.core.storage import storage
from app.data.repositories.case_repository import CaseRepository
from app.domain.entities import Case, LabReport, LabTestResult, Medicine, Prescription
from app.domain.enums import DocumentType
from app.medical.engine import MedicalEngine, default_engine as default_medical_engine
from app.parsing.extractor import MedicineExtractor, default_extractor
from app.parsing.report_extractor import LabReportExtractor, default_report_extractor
from app.utils.logging import get_logger

log = get_logger("services.case")


class CaseService:
    def __init__(
        self,
        repo: CaseRepository,
        ai: LocalAIEngine = default_engine,
        extractor: MedicineExtractor = default_extractor,
        report_extractor: LabReportExtractor = default_report_extractor,
        medical: MedicalEngine = default_medical_engine,
    ) -> None:
        self.repo = repo
        self.ai = ai
        self.extractor = extractor
        self.report_extractor = report_extractor
        self.medical = medical

    # ------------------------------------------------------------ creation
    def create_from_image(
        self,
        image_bytes: bytes,
        name: str = "",
        original_filename: str | None = None,
        document_type: str = "prescription",
    ) -> Case:
        case = Case(name=name or "Unnamed case", document_type=document_type)
        case_folder = storage.case_dir_for(case.id)
        stem = Path(original_filename).stem if original_filename else "document"
        ext = Path(original_filename).suffix if original_filename else ""
        if not stem:
            stem = "document"
        if not ext or not ext.startswith("."):
            ext = ".jpg"
        image_path = case_folder / f"{stem}{ext}"
        image_path.write_bytes(image_bytes)
        case.original_documents = [str(image_path)]
        case.prescription.source_image = str(image_path)

        processed_path = case_folder / f"{stem}_preprocessed.png"
        try:
            processed = preprocessor.preprocess(str(image_path), str(processed_path))
        except Exception as exc:
            log.warning("preprocessing failed, using original: %s", exc)
            processed = str(image_path)

        ocr_result = self.ai.ocr_recognize(processed)
        case.ocr_source = f"{ocr_result.engine}:{str(ocr_result.model_id)}"

        # Dual extraction: medicines and lab reports
        if document_type == "lab_report":
            report_res = self.report_extractor.extract(ocr_result.text, ocr_result.confidence, ocr_result.engine)
            report_res.report.source_document = str(image_path)
            case.lab_reports = [report_res.report]
            case.prescription.raw_ocr_text = ocr_result.text
            case.prescription.ocr_confidence = ocr_result.confidence
            case.prescription.ocr_engine = ocr_result.engine
            if not name or name == "Unnamed case":
                tests = [t.test_name for t in report_res.report.test_results[:2]]
                base = ", ".join(tests) if tests else "Lab Report"
                case.name = f"{base} — {report_res.report.date or 'recent'}"
        elif document_type == "mixed":
            med_res = self.extractor.extract(ocr_result.text, ocr_result.confidence, ocr_result.engine)
            case.prescription = med_res.prescription
            report_res = self.report_extractor.extract(ocr_result.text, ocr_result.confidence, ocr_result.engine)
            report_res.report.source_document = str(image_path)
            case.lab_reports = [report_res.report] if report_res.report.test_results else []
            if not name or name == "Unnamed case":
                case.name = self._default_name(case.prescription)
        else:
            med_res = self.extractor.extract(ocr_result.text, ocr_result.confidence, ocr_result.engine)
            case.prescription = med_res.prescription
            # Also check if any lab tests were present
            report_res = self.report_extractor.extract(ocr_result.text, ocr_result.confidence, ocr_result.engine)
            if report_res.report.test_results and not med_res.prescription.medicines:
                case.document_type = "lab_report"
                report_res.report.source_document = str(image_path)
                case.lab_reports = [report_res.report]
            if not name or name == "Unnamed case":
                case.name = self._default_name(case.prescription)

        case.analysis = self.medical.analyze(case.prescription, case.lab_reports)
        case.engine_version = case.analysis.engine_version

        self.repo.create(case)
        log.info("case created: %s", case.id)
        return case

    @staticmethod
    def _default_name(prescription: Prescription) -> str:
        names = [m.name for m in prescription.medicines[:2] if m.name]
        base = ", ".join(names) if names else "Medical Record"
        return f"{base} — {prescription.date or 'recent'}".strip()

    # ------------------------------------------------------ user overrides
    def update_medicines(self, case_id: str, medicines: list[Medicine]) -> Case:
        case = self._must_get(case_id)
        case.prescription.medicines = medicines
        case.analysis = self.medical.analyze(case.prescription, case.lab_reports)
        case.engine_version = case.analysis.engine_version
        case.touch()
        self.repo.update(case)
        return case

    def verify_medicines(self, case_id: str, verified: list[dict]) -> Case:
        """Mark medicines as verified by the user then re-run the engine."""
        case = self._must_get(case_id)
        verified_ids = {str(v.get("index")) for v in verified}
        by_name = {str(v.get("name")) for v in verified}
        for index, medicine in enumerate(case.prescription.medicines):
            if str(index) in verified_ids or medicine.name in by_name:
                medicine.verified_by_user = True
                medicine.needs_verification = False
        case.analysis = self.medical.analyze(case.prescription, case.lab_reports)
        case.touch()
        self.repo.update(case)
        return case

    def verify_reports(self, case_id: str, verified: list[dict]) -> Case:
        """Mark lab test results as verified by user then re-run analysis."""
        case = self._must_get(case_id)
        verified_ids = {str(v.get("index")) for v in verified}
        by_name = {str(v.get("name")) for v in verified}
        for rep in case.lab_reports:
            for idx, item in enumerate(rep.test_results):
                if str(idx) in verified_ids or item.test_name in by_name:
                    item.verified_by_user = True
        case.analysis = self.medical.analyze(case.prescription, case.lab_reports)
        case.touch()
        self.repo.update(case)
        return case

    def set_name(self, case_id: str, name: str) -> Case:
        case = self._must_get(case_id)
        case.name = name.strip() or case.name
        case.touch()
        self.repo.update(case)
        return case

    def set_notes(self, case_id: str, notes: str) -> Case:
        case = self._must_get(case_id)
        case.notes = notes
        case.touch()
        self.repo.update(case)
        return case

    # --------------------------------------------------------------- reads
    def get(self, case_id: str) -> Case | None:
        return self.repo.get(case_id)

    def _must_get(self, case_id: str) -> Case:
        case = self.repo.get(case_id)
        if case is None:
            raise LookupError(f"Case not found: {case_id}")
        return case

    def list_cases(self, include_archived: bool = False) -> list[Case]:
        return self.repo.list_all(include_archived)

    def search(self, query: str) -> list[Case]:
        return self.repo.search(query)

    def delete(self, case_id: str) -> bool:
        return self.repo.delete(case_id)

    # --------------------------------------------------------- image access
    def image_path(self, case_id: str) -> Path | None:
        folder = storage.case_dir_for(case_id)
        if not folder.exists():
            return None
        for path in sorted(folder.iterdir()):
            if (
                path.is_file()
                and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
                and "preprocessed" not in path.stem.lower()
            ):
                return path
        return None


def to_case_export(case: Case) -> dict:
    """JSON snapshot of a case including chat for local export."""
    return case.to_dict()

def load_case_export(data: dict) -> Case:
    return Case.from_dict(data)

def save_case_export(case: Case, path: str) -> Path:
    target = Path(path)
    target.write_text(json.dumps(case.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
    return target