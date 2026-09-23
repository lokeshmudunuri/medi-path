"""Deterministic extraction for laboratory and clinical test reports.

Extracts:
- test name
- result
- unit
- reference range
- high/low indicator when explicitly supported
- confidence score

Unknown values remain None or "unknown". Never guess or invent values.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from app.domain.entities import LabReport, LabTestResult
from app.domain.enums import LabFlag


# Known diagnostic tests with canonical names, typical units, and reference ranges
KNOWN_LAB_TESTS: dict[str, dict] = {
    "hemoglobin": {
        "aliases": ["hb", "hgb", "haemoglobin"],
        "unit": "g/dL",
        "low": 12.0,
        "high": 17.5,
        "range_str": "12.0 - 17.5 g/dL",
    },
    "wbc": {
        "aliases": ["white blood cells", "total leukocyte count", "tlc", "leukocytes"],
        "unit": "/mcL",
        "low": 4000.0,
        "high": 11000.0,
        "range_str": "4000 - 11000 /mcL",
    },
    "rbc": {
        "aliases": ["red blood cells", "erythrocytes", "total rbc"],
        "unit": "million/mcL",
        "low": 4.0,
        "high": 5.9,
        "range_str": "4.0 - 5.9 million/mcL",
    },
    "platelets": {
        "aliases": ["platelet count", "plt"],
        "unit": "/mcL",
        "low": 150000.0,
        "high": 450000.0,
        "range_str": "150000 - 450000 /mcL",
    },
    "fasting blood sugar": {
        "aliases": ["fbs", "fasting glucose", "glucose fasting"],
        "unit": "mg/dL",
        "low": 70.0,
        "high": 99.0,
        "range_str": "70 - 99 mg/dL",
    },
    "post prandial blood sugar": {
        "aliases": ["ppbs", "postprandial glucose", "glucose pp"],
        "unit": "mg/dL",
        "low": 70.0,
        "high": 140.0,
        "range_str": "70 - 140 mg/dL",
    },
    "hba1c": {
        "aliases": ["glycated hemoglobin", "glycohemoglobin"],
        "unit": "%",
        "low": 4.0,
        "high": 5.6,
        "range_str": "4.0 - 5.6 %",
    },
    "total cholesterol": {
        "aliases": ["cholesterol", "serum cholesterol"],
        "unit": "mg/dL",
        "low": 0.0,
        "high": 200.0,
        "range_str": "< 200 mg/dL",
    },
    "triglycerides": {
        "aliases": ["tg", "serum triglycerides"],
        "unit": "mg/dL",
        "low": 0.0,
        "high": 150.0,
        "range_str": "< 150 mg/dL",
    },
    "hdl cholesterol": {
        "aliases": ["hdl", "good cholesterol"],
        "unit": "mg/dL",
        "low": 40.0,
        "high": 60.0,
        "range_str": "> 40 mg/dL",
    },
    "ldl cholesterol": {
        "aliases": ["ldl", "bad cholesterol"],
        "unit": "mg/dL",
        "low": 0.0,
        "high": 100.0,
        "range_str": "< 100 mg/dL",
    },
    "serum creatinine": {
        "aliases": ["creatinine", "creat"],
        "unit": "mg/dL",
        "low": 0.6,
        "high": 1.3,
        "range_str": "0.6 - 1.3 mg/dL",
    },
    "blood urea nitrogen": {
        "aliases": ["bun", "urea"],
        "unit": "mg/dL",
        "low": 7.0,
        "high": 20.0,
        "range_str": "7 - 20 mg/dL",
    },
    "tsh": {
        "aliases": ["thyroid stimulating hormone", "thyrotropin"],
        "unit": "uIU/mL",
        "low": 0.4,
        "high": 4.5,
        "range_str": "0.4 - 4.5 uIU/mL",
    },
    "sgot": {
        "aliases": ["ast", "aspartate aminotransferase"],
        "unit": "U/L",
        "low": 10.0,
        "high": 40.0,
        "range_str": "10 - 40 U/L",
    },
    "sgpt": {
        "aliases": ["alt", "alanine aminotransferase"],
        "unit": "U/L",
        "low": 7.0,
        "high": 56.0,
        "range_str": "7 - 56 U/L",
    },
}


@dataclass
class ReportExtractionResult:
    report: LabReport
    unmatched_lines: list[str]

    def to_dict(self) -> dict:
        return {
            "report": self.report.to_dict(),
            "unmatched_lines": self.unmatched_lines,
        }


class LabReportExtractor:
    """Extracts lab report data from OCR text."""

    def __init__(self, known_tests: dict[str, dict] = KNOWN_LAB_TESTS) -> None:
        self.known_tests = known_tests

    def extract(self, ocr_text: str, ocr_confidence: float = 0.0, ocr_engine: str = "") -> ReportExtractionResult:
        report = LabReport()
        report.raw_ocr_text = ocr_text
        report.ocr_confidence = ocr_confidence
        report.ocr_engine = ocr_engine
        unmatched: list[str] = []

        lines = [l.strip() for l in ocr_text.splitlines() if l.strip()]

        for line in lines:
            lower_line = line.lower()
            if self._is_header_line(lower_line):
                self._extract_header(report, line)
                continue

            test_result = self._try_parse_line(line, ocr_confidence)
            if test_result is not None:
                report.test_results.append(test_result)
            else:
                unmatched.append(line)

        return ReportExtractionResult(report=report, unmatched_lines=unmatched)

    def _is_header_line(self, lower: str) -> bool:
        return any(
            h in lower
            for h in (
                "patient",
                "lab",
                "laboratory",
                "pathology",
                "dr.",
                "doctor",
                "sample date",
                "report date",
                "age",
                "gender",
                "ref by",
            )
        )

    def _extract_header(self, report: LabReport, line: str) -> None:
        m = re.search(r"patient(?:\s+name)?[:\-]?\s*([a-zA-Z\s]+)", line, re.I)
        if m and not report.patient_info:
            report.patient_info = m.group(1).strip()

        m = re.search(r"(?:dr|ref(?:erred)?\s+by)[:\.]?\s*([a-zA-Z\s]+)", line, re.I)
        if m and not report.doctor_info:
            report.doctor_info = m.group(1).strip()

        m = re.search(r"date[:\-]?\s*([0-9\/\.\-]+)", line, re.I)
        if m and not report.date:
            report.date = m.group(1).strip()

        m = re.search(r"(?:diagnostic|pathology|laboratory|clinical)\s+([a-zA-Z\s]+)", line, re.I)
        if m and not report.lab_name:
            report.lab_name = m.group(0).strip()

    def _try_parse_line(self, line: str, ocr_confidence: float) -> Optional[LabTestResult]:
        lower = line.lower()
        matched_test = None
        test_canonical = ""

        # Find known test
        for test_name, meta in self.known_tests.items():
            names_to_check = [test_name] + meta.get("aliases", [])
            for name in names_to_check:
                pattern = r"\b" + re.escape(name) + r"\b"
                if re.search(pattern, lower):
                    matched_test = meta
                    test_canonical = test_name.title()
                    break
            if matched_test:
                break

        if not matched_test:
            # Generic pattern: TestName [Result] [Unit] [ReferenceRange]
            generic = self._parse_generic_line(line, ocr_confidence)
            return generic

        # Extract number (result) from the line
        # e.g., "Hemoglobin: 14.2 g/dL (12 - 17.5)" or "Hb 10.5 Low"
        numbers = re.findall(r"\b(\d+(?:\.\d+)?)\b", line)
        if not numbers:
            return None

        # First number usually result
        result_val_str = numbers[0]
        try:
            val = float(result_val_str)
        except ValueError:
            return None

        unit = matched_test.get("unit", "")
        ref_range = matched_test.get("range_str", "")

        # Look for explicit custom reference range in line
        # e.g., "(12.0 - 16.0)" or "12-16"
        custom_range_m = re.search(r"\(?\b(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\b\)?", line)
        low_bound = matched_test.get("low", 0.0)
        high_bound = matched_test.get("high", 999999.0)

        if custom_range_m:
            try:
                r_low = float(custom_range_m.group(1))
                r_high = float(custom_range_m.group(2))
                # Ensure it wasn't the result itself
                if r_low != val or len(numbers) > 1:
                    low_bound, high_bound = r_low, r_high
                    ref_range = f"{r_low} - {r_high} {unit}".strip()
            except (ValueError, IndexError):
                pass

        # Determine flag
        flag = LabFlag.NORMAL.value
        if val < low_bound:
            flag = LabFlag.LOW.value
        elif val > high_bound:
            flag = LabFlag.HIGH.value

        # Check if line explicitly says High/Low
        if re.search(r"\b(high|elevated|above)\b", lower):
            flag = LabFlag.HIGH.value
        elif re.search(r"\b(low|decreased|below)\b", lower):
            flag = LabFlag.LOW.value

        confidence = max(0.65, min(1.0, ocr_confidence + 0.15))

        return LabTestResult(
            test_name=test_canonical,
            result=result_val_str,
            unit=unit,
            reference_range=ref_range,
            flag=flag,
            confidence=confidence,
        )

    def _parse_generic_line(self, line: str, ocr_confidence: float) -> Optional[LabTestResult]:
        # Match "TestName: 12.5 mg/dL (10 - 20)"
        m = re.search(r"^([a-zA-Z\s]{3,30})[:\s]+(\d+(?:\.\d+)?)\s*([a-zA-Z\/%]+)?(?:\s*[\(\[]?([0-9\.\s\-–]+)[\)\]]?)?", line)
        if not m:
            return None
        name = m.group(1).strip()
        val_str = m.group(2).strip()
        unit = (m.group(3) or "").strip()
        range_str = (m.group(4) or "").strip()

        # Reject pure medicine directives or headers
        if any(w in name.lower() for w in ("tablet", "capsule", "syrup", "date", "name", "dr", "patient", "page")):
            return None

        flag = LabFlag.UNKNOWN.value
        if range_str and "-" in range_str:
            parts = [p.strip() for p in re.split(r"[-–]", range_str) if p.strip()]
            if len(parts) == 2:
                try:
                    low = float(parts[0])
                    high = float(parts[1])
                    val = float(val_str)
                    if val < low:
                        flag = LabFlag.LOW.value
                    elif val > high:
                        flag = LabFlag.HIGH.value
                    else:
                        flag = LabFlag.NORMAL.value
                except ValueError:
                    pass

        return LabTestResult(
            test_name=name.title(),
            result=val_str,
            unit=unit,
            reference_range=range_str,
            flag=flag,
            confidence=min(0.6, ocr_confidence),
        )


default_report_extractor = LabReportExtractor()
