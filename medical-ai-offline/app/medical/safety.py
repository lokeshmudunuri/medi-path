"""Safety checker: flags medicines that cannot be reliably identified and
exposes cautions from the local database as safety flags. Never invents
information."
"""
from __future__ import annotations

from app.domain.entities import MedicalAnalysis, Medicine, SafetyFlag
from app.domain.enums import Severity
from app.medical.knowledge import MedicineKnowledgeBase, knowledge_base

NOT_LOCAL_PHRASE = "Information is not available in the local medical database."


class SafetyChecker:
    def __init__(self, kb: MedicineKnowledgeBase = knowledge_base) -> None:
        self.kb = kb

    def check(self, analysis: MedicalAnalysis, medicines: list[Medicine]) -> None:
        for medicine in medicines:
            if not medicine.name:
                analysis.safety_flags.append(
                    SafetyFlag(
                        severity=Severity.CRITICAL.value,
                        message="A medicine could not be read reliably. Please verify the medicine name.",
                        medicine="",
                        evidence="OCR/extraction confidence too low to identify a medicine.",
                    )
                )
                continue
            entry = self._lookup(medicine.name)
            if entry is None:
                analysis.safety_flags.append(
                    SafetyFlag(
                        severity=Severity.WARNING.value,
                        message=(
                            f"{NOT_LOCAL_PHRASE} For \"{medicine.name}\" — "
                            "please verify this medicine with your doctor or pharmacist."
                        ),
                        medicine=medicine.name,
                        evidence="Medicine not present in the local knowledge base.",
                    )
                )
                continue
            if medicine.needs_verification and not medicine.verified_by_user:
                analysis.safety_flags.append(
                    SafetyFlag(
                        severity=Severity.WARNING.value,
                        message=f"Please verify this medicine: \"{medicine.name}\".",
                        medicine=medicine.name,
                        evidence="OCR confidence for this medicine was low.",
                    )
                )
            for caution in entry.get("cautions", []):
                analysis.safety_flags.append(
                    SafetyFlag(
                        severity=Severity.INFO.value,
                        message=caution,
                        medicine=medicine.name,
                        evidence="Local knowledge base: cautions.",
                    )
                )

    def _lookup(self, name: str) -> dict | None:
        result = self.kb.medicine_by_alias(name)
        return result[1] if result else None