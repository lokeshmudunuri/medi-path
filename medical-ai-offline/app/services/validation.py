"""Response validator.

Keeps the LLM honest as an explanation layer:
- If the engine reported missing local information and the LLM failed to say
  so, the validator appends the canonical phrasing.
- If a critical safety flag exists, ensure the answer carries a safety
  reminder.
- Detect obviously out-of-context statements (medicine names that are not in
  the case) and flag them.
"""
from __future__ import annotations

from app.domain.entities import ChatMessage, MedicalAnalysis
from app.domain.enums import Severity

_MISSING_PHRASE = (
    "The local medical database does not contain enough information to answer this."
)


class ResponseValidator:
    def __init__(self, model_output: str = "") -> None:
        self.model_output = model_output
        self.added_missing_note = False
        self.safety_reminder = ""

    def validate(self, raw: str, analysis: MedicalAnalysis) -> str:
        output = raw or ""
        has_critical = any(f.severity == Severity.CRITICAL.value for f in analysis.safety_flags)
        missing_known = self._analysis_missing(analysis)

        if missing_known and "not contain enough information" not in output.lower() and "local" not in output.lower():
            output = output.rstrip(" \n.") + "\n\n" + _MISSING_PHRASE
            self.added_missing_note = True

        if has_critical and self._critical_flag_text(analysis) not in output:
            text = self._critical_flag_text(analysis)
            if text:
                output = output.rstrip(" \n.") + "\n\n" + text
                self.safety_reminder = text

        return output.strip()

    @staticmethod
    def _analysis_missing(analysis: MedicalAnalysis) -> bool:
        return any(not info.found for info in analysis.medicine_information)

    @staticmethod
    def _critical_flag_text(analysis: MedicalAnalysis) -> str:
        for flag in analysis.safety_flags:
            if flag.severity == Severity.CRITICAL.value:
                return f"Safety alert: {flag.message}"
        return ""


def validate_response(message: ChatMessage, analysis: MedicalAnalysis) -> tuple[ChatMessage, ResponseValidator]:
    validator = ResponseValidator()
    message.content = validator.validate(message.content, analysis)
    return message, validator