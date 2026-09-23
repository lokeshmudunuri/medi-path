"""Important-takeaway engine: deterministic, knowledge-base backed."""
from __future__ import annotations

from app.domain.entities import MedicalAnalysis, Medicine, Takeaway
from app.medical.knowledge import MedicineKnowledgeBase, knowledge_base


class ImportantTakeawayEngine:
    def __init__(self, kb: MedicineKnowledgeBase = knowledge_base) -> None:
        self.kb = kb

    def generate(self, analysis: MedicalAnalysis, medicines: list[Medicine]) -> None:
        for medicine in medicines:
            entry = self._entry(medicine.name)
            if entry is None:
                continue
            for takeaway in entry.get("takeaways", []):
                analysis.takeaways.append(Takeaway(text=takeaway, medicine=medicine.name))

    def _entry(self, name: str) -> dict | None:
        result = self.kb.medicine_by_alias(name)
        return result[1] if result else None