"""OCR text normalization.

Deterministic, rule-based. Converts messy OCR output into a canonical form so
the medicine extractor can work on predictable input. No ML involved.
"""
from __future__ import annotations

import re

# Common OCR confusions corrected before parsing. Applied carefully so that
# numeric dosage patterns (1-1-1) are not corrupted.
_OCR_FIXES = [
    (r"\bO\b", "0"),            # standalone O -> zero (e.g. "1-O-1")
    (r"(\d)[lI]([^a-z])", r"\g<1>1\g<2>"),  # 5l mg -> 51? no: avoid; handled below
    (r"\(\bmg\b", "(mg"),
]

_FULLWIDTH = str.maketrans(
    "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ０１２３４５６７８９", 
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
)


def normalize_text(text: str) -> str:
    """Canonical lower-case, ASCII-folded text with tidy whitespace."""
    if not text:
        return ""
    text = text.translate(_FULLWIDTH)
    text = text.replace("|", " ").replace("_", " ").replace("•", " ").replace("·", " ").replace("。", " ")
    text = _fix_ocr_confusions(text)
    # Separate directive prefixes stuck to words (e.g. "otab." -> "tablet", "cap.cyro" -> "capsule cyro")
    text = re.sub(r"(?i)\b(?:o\s*)?tab\.?", "tablet ", text)
    text = re.sub(r"(?i)\bcap\.?", "capsule ", text)
    # Separate numbers stuck after letters or units like "125mcq" -> "125 mcg"
    text = re.sub(r"(?i)(\d+)\s*(?:mcq|mcg)\b", r"\1 mcg", text)
    text = re.sub(r"(?i)(\d+)\s*(?:mgs?|mg)\b", r"\1 mg", text)
    text = re.sub(r"\s+", " ", text).strip().lower()
    text = normalize_units(text)
    return text


def _fix_ocr_confusions(text: str) -> str:
    text = re.sub(r"\bO\b", "0", text)
    # '1-1-1/2' style keep; convert commas to dashes in dosage lists
    text = re.sub(r"(\d)\s*,\s*(\d)", r"\g<1>-\g<2>", text)
    # letter-l/d mistaken for 1 between digits
    text = re.sub(r"(?<=\d)[lI](?=\d)", "1", text)
    # zero mistaken for O inside medicine-ish words is intentionally NOT fixed
    return text


def normalize_units(text: str) -> str:
    """Unify unit spellings and expand medicine abbreviations."""
    text = re.sub(r"\bµg\b|\bug\b|\bmicro[ -]?grams?\b", " mcg ", text)
    text = re.sub(r"\b(m?gms?|gms?)\b", r"\g<1>", text)
    text = re.sub(r"\bmls?\b", "ml", text)
    text = re.sub(r"\bi\.?u\.?\b|\bunits?\b", "iu", text)
    text = re.sub(r"\bsyr(?:up)?\b\.?", "syrup", text)
    text = re.sub(r"\binj(?:ection)?\b\.?", "injection", text)
    text = re.sub(r"\btab(?:s|let|lets)?\b\.?", "tablet", text)
    text = re.sub(r"\bcap(?:s|sule|sules)?\b\.?", "capsule", text)
    return re.sub(r"\s+", " ", text).strip()


def split_prescription_lines(text: str) -> list[str]:
    """Split OCR text into directive-led medicine lines for parsing."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    merged: list[str] = []
    for line in lines:
        merged.append(line)
    return merged


def starts_with_medicine_directive(line: str, directives: set[str]) -> bool:
    first = line.split(" ")[0].rstrip(".").lower()
    return first in directives


# Common frequency abbreviations -> human-readable
FREQUENCY_EXPANSION = {
    "od": "once a day",
    "bd": "twice a day",
    "tds": "three times a day",
    "tid": "three times a day",
    "qid": "four times a day",
    "hs": "at bedtime",
    "sos": "when needed",
    "prn": "when needed",
    "stat": "immediately",
    "mane": "in the morning",
    "nocte": "at night",
}