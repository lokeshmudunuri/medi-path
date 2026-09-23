"""The deterministic local MEDICAL ENGINE.

Single entry point for medical facts. It accepts structured medicines and
returns a structured MedicalAnalysis. The LLM never replaces this engine.

Boundary rules:
- If a medicine is not in the local knowledge base, the engine returns the
  explicit "not available" information rather than guessing.
- Every safety flag / takeaway / diet rule is either sourced from the local
  knowledge base or is a "not available" statement.
"""
from __future__ import annotations

from app.domain.entities import (
    LabReport,
    MedicalAnalysis,
    Medicine,
    MedicineInformation,
    Prescription,
)
from app.medical.diet import DietRuleEngine
from app.medical.interactions import InteractionChecker
from app.medical.knowledge import MedicineKnowledgeBase, knowledge_base
from app.medical.safety import SafetyChecker
from app.medical.safety_validator import SafetyValidator
from app.medical.takeaways import ImportantTakeawayEngine
from app.utils.logging import get_logger

log = get_logger("medical.engine")

ENGINE_VERSION = "1.0.0"


class MedicalEngine:
    def __init__(self, kb: MedicineKnowledgeBase = knowledge_base) -> None:
        self.kb = kb
        self.safety = SafetyChecker(kb)
        self.validator = SafetyValidator(kb)
        self.interactions = InteractionChecker(kb)
        self.takeaways = ImportantTakeawayEngine(kb)
        self.diet = DietRuleEngine(kb)

    def analyze(self, prescription: Prescription, lab_reports: list[LabReport] | None = None) -> MedicalAnalysis:
        analysis = MedicalAnalysis(engine_version=ENGINE_VERSION)
        medicines = prescription.medicines

        # Medicine information (found / not found in local database)
        for medicine in medicines:
            analysis.medicine_information.append(self._info_for(medicine))

        self.safety.check(analysis, medicines)
        self.interactions.check(analysis, medicines)
        self.takeaways.generate(analysis, medicines)
        self.diet.generate(analysis, medicines)

        # Run SafetyValidator on full context
        additional_flags = self.validator.validate(
            prescription=prescription,
            lab_reports=lab_reports,
            analysis=analysis,
        )
        existing_msgs = {f.message for f in analysis.safety_flags}
        for flag in additional_flags:
            if flag.message not in existing_msgs:
                analysis.safety_flags.append(flag)
                existing_msgs.add(flag.message)

        if not medicines and (not lab_reports or not any(r.test_results for r in lab_reports)):
            analysis.warnings.append(
                "No medicines or lab results could be extracted from the document. "
                "Please review the document scan and verify the information."
            )
        return analysis

    def _info_for(self, medicine: Medicine) -> MedicineInformation:
        if not medicine.name:
            return MedicineInformation(
                name="",
                found=False,
                indications_summary=(
                    "A medicine could not be read. Please verify the medicine name."
                ),
                evidence="OCR/extraction confidence too low.",
            )
        result = self.kb.medicine_by_alias(medicine.name)
        if result is None:
            return MedicineInformation(
                name=medicine.name,
                found=False,
                indications_summary=(
                    "Information is not available in the local medical database for this medicine."
                ),
                evidence="Medicine not present in the local knowledge base.",
            )
        key, entry = result
        return MedicineInformation(
            name=medicine.name,
            found=True,
            generic_name=key,
            category=entry.get("category", ""),
            indications_summary=entry.get("indications_summary", ""),
            common_side_effects=entry.get("common_side_effects", []),
            cautions=entry.get("cautions", []),
            evidence="Local knowledge base.",
        )


default_engine = MedicalEngine()