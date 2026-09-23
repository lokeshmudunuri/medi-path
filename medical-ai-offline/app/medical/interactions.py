"""Interaction checker between medicines in the same prescription.

Uses the local interaction matrix. Severity is derived deterministically from
the interaction wording; serious keywords escalate to critical.
"""
from __future__ import annotations

from app.domain.entities import MedicalAnalysis, Medicine, SafetyFlag
from app.domain.enums import Severity, InfoSource
from app.medical.knowledge import MedicineKnowledgeBase, knowledge_base

_SERIOUS_KEYWORDS = (
    "bleeding",
    "lacti",
    "must be avoided",
    "alcohol",
    "liver damage",
)


class InteractionChecker:
    def __init__(self, kb: MedicineKnowledgeBase = knowledge_base) -> None:
        self.kb = kb

    def check(self, analysis: MedicalAnalysis, medicines: list[Medicine]) -> None:
        pairs = self._pairs(medicines)
        for med_a, med_b in pairs:
            key_a = self._key(med_a.name)
            key_b = self._key(med_b.name)
            if not key_a or not key_b:
                continue
            interaction = self.kb.interaction(key_a, key_b)
            if interaction is None:
                continue
            severity = self._severity(interaction)
            analysis.safety_flags.append(
                SafetyFlag(
                    severity=severity,
                    message=(
                        f"Possible interaction between {med_a.name} and {med_b.name}: "
                        f"{interaction}"
                    ),
                    medicine=f"{med_a.name} + {med_b.name}",
                    evidence="Local interaction matrix.",
                    source=InfoSource.MEDICAL_ENGINE.value,
                )
            )
            analysis.evidence.append(interaction)

    @staticmethod
    def _pairs(medicines: list[Medicine]) -> list[tuple[Medicine, Medicine]]:
        result = []
        for i in range(len(medicines)):
            for j in range(i + 1, len(medicines)):
                result.append((medicines[i], medicines[j]))
        return result

    @staticmethod
    def _key(name: str) -> str | None:
        cleaned = name.strip().lower()
        return cleaned if cleaned else None

    @staticmethod
    def _severity(interaction: str) -> str:
        lowered = interaction.lower()
        if any(k in lowered for k in _SERIOUS_KEYWORDS):
            return Severity.CRITICAL.value
        return Severity.WARNING.value