"""GroundingContextBuilder.

Constructs the exact, bounded context handed to the local LLM. The LLM never
sees the whole database — only the relevant grounded case information plus a
strict explanation-layer instruction.
"""
from __future__ import annotations

from app.domain.entities import Case, MedicalAnalysis
from app.domain.enums import InfoSource, Severity

INSUFFICIENT_MARKER = "NOT_ENOUGH_LOCAL_INFORMATION"


class GroundingContextBuilder:
    def build(self, case: Case, recent_chat: list[dict] | None = None) -> dict:
        analysis = case.analysis
        lab_data = []
        for rep in getattr(case, "lab_reports", []):
            lab_data.append(rep.to_dict())

        context: dict[str, object] = {
            "case_id": case.id,
            "case_name": case.name,
            "document_type": getattr(case, "document_type", "prescription"),
            "medicines": [m.to_dict() for m in case.prescription.medicines],
            "lab_reports": lab_data,
            "ocr_confidence": case.prescription.ocr_confidence,
            "ocr_engine": case.prescription.ocr_engine,
            "medicine_information": self._info_summary(analysis),
            "safety_flags": [f.to_dict() for f in analysis.safety_flags],
            "important_takeaways": [t.to_dict() for t in analysis.takeaways],
            "diet_rules": [d.to_dict() for d in analysis.diet_rules],
            "warnings": list(analysis.warnings),
            "evidence": list(analysis.evidence),
            "previous_chat": [
                {"role": m["role"], "content": m["content"]}
                for m in (recent_chat or [])[-8:]
            ],
            "insufficient_mark": INSUFFICIENT_MARKER if self._has_missing_info(case) else "",
        }
        return context

    def render(self, context: dict) -> str:
        lines: list[str] = []
        lines.append("CASE INFORMATION")
        lines.append(f"Case: {context['case_name']} (id {context['case_id']})")
        lines.append(f"Document type: {context.get('document_type', 'prescription')}")
        lines.append(f"OCR engine: {context['ocr_engine']} | OCR confidence: {context['ocr_confidence']}")

        lines.append("\nMEDICINES")
        meds: list[dict] = context["medicines"]
        if not meds:
            lines.append("No medicines extracted.")
        else:
            for m in meds:
                needs_verify = " (UNVERIFIED / PLEASE VERIFY)" if m.get("needs_verification") else ""
                entry = (
                    f"- {m['name']}{needs_verify} | strength: {m['strength'] or 'n/a'} | "
                    f"dose: {m['dosage'] or 'n/a'} | frequency: {m['frequency'] or 'n/a'} | "
                    f"duration: {m['duration'] or 'n/a'} | route: {m['route']} | timing: {m['timing']}"
                )
                lines.append(entry)

        lab_reports: list[dict] = context.get("lab_reports", [])
        if lab_reports:
            lines.append("\nLABORATORY / CLINICAL TEST RESULTS")
            for rep in lab_reports:
                if rep.get("lab_name"):
                    lines.append(f"Lab: {rep['lab_name']} ({rep.get('date', 'no date')})")
                for test in rep.get("test_results", []):
                    flag_str = f" [FLAG: {test['flag'].upper()}]" if test.get("flag") and test["flag"] != "normal" else ""
                    lines.append(
                        f"- {test['test_name']}: {test['result']} {test['unit']} "
                        f"(Ref: {test['reference_range'] or 'n/a'}){flag_str}"
                    )

        lines.append("\nMEDICAL ENGINE RESULTS (deterministic, do not contradict)")
        for info in context["medicine_information"]:
            if not info["found"]:
                lines.append(
                    f"- {info['name'] or 'Unknown medicine'}: "
                    "Information is not available in the local medical database."
                )
            elif info["indications_summary"]:
                lines.append(f"- {info['name']} ({info['category']}): {info['indications_summary']}")

        lines.append("\nSAFETY FLAGS")
        flags = context["safety_flags"]
        if not flags:
            lines.append("None reported by the local engine.")
        for flag in flags:
            lines.append(f"- [{flag['severity']}] {flag['message']}")

        lines.append("\nIMPORTANT TAKEAWAYS")
        for t in context["important_takeaways"]:
            lines.append(f"- {t['text']}")

        lines.append("\nDIET / FOOD RULES")
        for d in context["diet_rules"]:
            lines.append(f"- {d['text']}")

        if context["insufficient_mark"]:
            lines.append(f"\nMARKER: {context['insufficient_mark']}")
            lines.append("The local database lacks reliable information for at least one medicine. "
                         "State this explicitly.")

        if context["previous_chat"]:
            lines.append("\nPREVIOUS RELEVANT CHAT")
            for m in context["previous_chat"]:
                lines.append(f"{m['role']}: {m['content']}")

        return "\n".join(lines)

    @staticmethod
    def _info_summary(analysis: MedicalAnalysis) -> list[dict]:
        return [m.to_dict() for m in analysis.medicine_information]

    @staticmethod
    def _has_missing_info(case: Case) -> bool:
        for info in case.analysis.medicine_information:
            if not info.found:
                return True
        for flag in case.analysis.safety_flags:
            if flag.severity in (Severity.WARNING.value, Severity.CRITICAL.value):
                if "not available in the local medical database" in flag.message.lower():
                    return True
        return False


grounding_builder = GroundingContextBuilder()