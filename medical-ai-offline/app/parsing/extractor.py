"""Rule-based medicine information extraction from OCR text.

Deterministic parsing first: medicines, strength, dosage schedule, frequency,
duration, timing and route are all extracted with regex/lexicon rules. The LLM
is never used to parse safety-critical prescription data.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.domain.entities import Medicine, Prescription
from app.domain.enums import Route, Timing
from app.medical.knowledge import MedicineKnowledgeBase, knowledge_base
from app.parsing.normalization import (
    FREQUENCY_EXPANSION,
    normalize_text,
    split_prescription_lines,
)

DIRECTIVES = {
    "tablet",
    "capsule",
    "syrup",
    "injection",
    "ointment",
    "cream",
    "drops",
    "gel",
    "spray",
    "lotion",
    "sachet",
    "suspension",
}

_ROUTE_BY_DIRECTIVE = {
    "ointment": Route.TOPICAL,
    "cream": Route.TOPICAL,
    "gel": Route.TOPICAL,
    "lotion": Route.TOPICAL,
    "drops": Route.TOPICAL,
    "injection": Route.INJECTION,
    "spray": Route.INHALED,
}

_STRENGTH_RE = re.compile(
    r"(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>mg|mcg|gm|g|ml|iu)\b", re.IGNORECASE
)
# Dash-form schedule (1-1-1, 1-0-1, 1-1-1/2) must be matched BEFORE plain
# digits so "500 mg 1-1-1" yields the schedule, not "500".
_DASH_SCHEDULE_RE = re.compile(
    r"\b\d+(?:\.\d+)?\s*[-/]\s*\d+(?:\s*[-/]\s*\d+)*(?:\s*/\s*2)?\b"
)
_DURATION_RE = re.compile(
    r"(?:for\s+|x\s*|×\s*)?(\d+)\s*(day|week|month|year)s?\b", re.IGNORECASE
)
_DOSE_UNIT_RE = re.compile(
    r"([\d\u00bc\u00bd\u00be]+(?:\s*\d/\d)?)\s*"
    r"(tab(?:let)?|cap(?:sule)?|ml|tsp|tablespoon|sachet|sachets|puff|puffs|drop(s)?)",
    re.IGNORECASE,
)
_FREQ_ABBREV_RE = re.compile(
    r"\b(od|bd|tds|tid|qid|hs|sos|prn|stat|mane|nocte)\b", re.IGNORECASE
)
_FREQ_WORDS_RE = re.compile(
    r"(once|twice|thrice|three times|four times)\s*(a\s+day|daily|/day)", re.IGNORECASE
)
_TIMING_RE = re.compile(
    r"(after food|before food|with food|empty stomach|after meal|before meal|"
    r"between meals|at bed ?time|bedtime|morning|evening|night|"
    r"after breakfast|after lunch|after dinner)",
    re.IGNORECASE,
)


@dataclass
class ExtractionResult:
    prescription: Prescription
    unmatched_lines: list[str]

    def to_dict(self) -> dict:
        return {
            "prescription": self.prescription.to_dict(),
            "unmatched_lines": self.unmatched_lines,
        }


class MedicineExtractor:
    def __init__(self, kb: MedicineKnowledgeBase = knowledge_base) -> None:
        self.kb = kb
        self._known_names = [n.lower() for n in kb.names()] + [a.lower() for a in kb.aliases()]
        self._known_names.sort(key=len, reverse=True)

    def extract(self, ocr_text: str, ocr_confidence: float = 0.0, ocr_engine: str = "") -> ExtractionResult:
        prescription = Prescription()
        prescription.raw_ocr_text = ocr_text
        prescription.ocr_confidence = ocr_confidence
        prescription.ocr_engine = ocr_engine
        unmatched: list[str] = []
        for line in split_prescription_lines(ocr_text):
            norm_line = normalize_text(line)
            if not norm_line:
                continue
            if self._is_header_line(norm_line):
                self._extract_header(prescription, norm_line)
                continue
            medicine = self._try_parse_line(norm_line, ocr_confidence)
            if medicine is not None:
                prescription.medicines.append(medicine)
            else:
                unmatched.append(line)
        if not prescription.medicines:
            for line in split_prescription_lines(ocr_text):
                norm_line = normalize_text(line)
                medicine = self._try_parse_line(norm_line, ocr_confidence, allow_implicit=True)
                if medicine is not None:
                    prescription.medicines.append(medicine)
        return ExtractionResult(prescription=prescription, unmatched_lines=unmatched)

    # ------------------------------------------------------------- helpers
    def _is_header_line(self, norm: str) -> bool:
        return any(
            kw in norm
            for kw in (
                "patient",
                "name",
                "age",
                "sex",
                "date",
                "dr.",
                "dr ",
                "consultant",
                "hospital",
                "clinic",
                "address",
                "weight",
                "blood pressure",
                "bp",
                "temperature",
            )
        )

    def _extract_header(self, prescription: Prescription, norm: str) -> None:
        m = re.search(r"patient[:\-]?\s*(.+)", norm)
        if m and not prescription.patient_info:
            prescription.patient_info = m.group(1).strip()

        m = re.search(r"dr\.?\s*([a-z]+)", norm)
        if m and not prescription.doctor_info:
            prescription.doctor_info = m.group(0).strip()

        m = re.search(r"date[:\-]?\s*([0-9/.-]+)", norm)
        if m and not prescription.date:
            prescription.date = m.group(1).strip()

    def _try_parse_line(self, norm: str, ocr_confidence: float, allow_implicit: bool = False) -> Medicine | None:
        if len(norm.split()) > 60:
            return None
        directive = self._detect_directive(norm)
        if directive is None and not self._contains_known_medicine(norm):
            return None
        medicine = Medicine()
        medicine.raw_text = norm
        medicine.confidence = 0.7

        rest = norm
        if directive:
            idx = norm.find(directive)
            if idx >= 0:
                rest = norm[idx + len(directive):].strip()
            medicine.route = _ROUTE_BY_DIRECTIVE.get(directive, Route.ORAL).value

        name, name_hit = self._extract_name(rest)
        if name:
            medicine.name = name
            medicine.confidence += 0.2 if name_hit else 0.0
        else:
            medicine.name = ""
            medicine.needs_verification = True

        self._extract_strength(medicine, rest)
        self._extract_dose(medicine, rest)
        self._extract_frequency(medicine, rest)
        self._extract_duration(medicine, rest)
        self._extract_timing(medicine, rest)
        if directive is None and not medicine.name:
            return None

        if not name_hit:
            medicine.needs_verification = True
            medicine.confidence = min(medicine.confidence, 0.62)
        medicine.confidence = min(medicine.confidence, 1.0)
        return medicine

    def _detect_directive(self, norm: str) -> str | None:
        for word in norm.split():
            cleaned = word.rstrip(".").rstrip(",")
            if cleaned in DIRECTIVES:
                return cleaned
        return None

    def _contains_known_medicine(self, norm: str) -> bool:
        return any(name in norm for name in self._known_names)

    def _extract_name(self, rest: str) -> tuple[str, bool]:
        for name in self._known_names:
            pattern = r"(?<![a-z])" + re.escape(name) + r"(?![a-z])"
            m = re.search(pattern, rest)
            if m:
                return name, True
        m = re.match(r"([a-z][a-z ]*?)(?=\s*\d|$)", rest)
        if m:
            candidate = m.group(1).strip()
            candidate = re.split(r"\b(for|od|bd|tds|hs|sos|after|before|x)\b", candidate)[0].strip()
            if candidate and candidate != "for" and len(candidate) > 1:
                return candidate, False
        return "", False

    def _extract_strength(self, medicine: Medicine, rest: str) -> None:
        m = _STRENGTH_RE.search(rest)
        if m:
            unit = m.group("unit").lower()
            if unit in ("mg", "mcg", "iu", "ml"):
                medicine.strength = f"{m.group('value')} {unit}"
                medicine.confidence += 0.1

    def _extract_dose(self, medicine: Medicine, rest: str) -> None:
        m = _DASH_SCHEDULE_RE.search(rest)
        if m:
            medicine.dosage = m.group(0).strip()
            medicine.frequency = self._schedule_to_frequency(m.group(0))
            medicine.confidence += 0.1
            return
        m = _DOSE_UNIT_RE.search(rest)
        if m:
            medicine.dosage = f"{m.group(1)} {m.group(2)}".strip()
            medicine.confidence += 0.1

    def _schedule_to_frequency(self, schedule: str) -> str:
        text = schedule.replace("\u00bd", ".5").replace("\u00bc", ".25").replace("\u00be", ".75")
        if text.rstrip().endswith("/2"):
            text = text.rstrip()[:-2]
        parts = [p for p in re.split(r"[-/]", text) if p]
        nonzero = [p for p in parts if p.replace(".", "").lstrip("-") not in ("", "0")]
        if len(nonzero) == 3:
            return "three times a day"
        if len(nonzero) == 2:
            return "twice a day"
        if len(nonzero) == 1:
            return "once a day"
        return ""

    def _extract_frequency(self, medicine: Medicine, rest: str) -> None:
        if medicine.frequency:
            return
        m = _FREQ_ABBREV_RE.search(rest)
        if m:
            medicine.frequency = FREQUENCY_EXPANSION.get(m.group(1).lower(), m.group(1))
            medicine.confidence += 0.1
            return
        m = _FREQ_WORDS_RE.search(rest)
        if m:
            medicine.frequency = m.group(1).strip() + " " + (m.group(2) or "")
            medicine.confidence += 0.1

    def _extract_duration(self, medicine: Medicine, rest: str) -> None:
        m = _DURATION_RE.search(rest)
        if m:
            medicine.duration = f"{m.group(1)} {m.group(2)}s"

    def _extract_timing(self, medicine: Medicine, rest: str) -> None:
        m = _TIMING_RE.search(rest)
        if m:
            token = m.group(1).lower()
            mapping = {
                "after food": Timing.AFTER_FOOD,
                "after meal": Timing.AFTER_FOOD,
                "after breakfast": Timing.AFTER_FOOD,
                "after lunch": Timing.AFTER_FOOD,
                "after dinner": Timing.AFTER_FOOD,
                "before food": Timing.BEFORE_FOOD,
                "before meal": Timing.BEFORE_FOOD,
                "with food": Timing.WITH_FOOD,
                "empty stomach": Timing.BEFORE_FOOD,
                "morning": Timing.MORNING,
                "evening": Timing.EVENING,
                "night": Timing.NIGHT,
                "at bedtime": Timing.NIGHT,
                "bedtime": Timing.NIGHT,
                "between meals": Timing.WITH_FOOD,
            }
            medicine.timing = mapping.get(token, Timing.UNKNOWN).value
            medicine.confidence += 0.1


default_extractor = MedicineExtractor()
