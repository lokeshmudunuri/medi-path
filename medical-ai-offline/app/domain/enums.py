"""Domain enums shared across the application."""
from __future__ import annotations

from enum import Enum


class ModelState(str, Enum):
    NOT_INSTALLED = "NOT_INSTALLED"
    QUEUED = "QUEUED"
    DOWNLOADING = "DOWNLOADING"
    DOWNLOAD_FINISHED = "DOWNLOAD_FINISHED"  # temp file present, not yet verified
    VERIFYING = "VERIFYING"
    INSTALLED = "INSTALLED"
    READY = "READY"
    FAILED = "FAILED"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"
    CORRUPTED = "CORRUPTED"
    PAUSED = "PAUSED"


class ModelType(str, Enum):
    OCR = "ocr"
    STT = "stt"
    LLM = "llm"
    TTS = "tts"
    OTHER = "other"


class Route(str, Enum):
    ORAL = "oral"
    TOPICAL = "topical"
    INHALED = "inhaled"
    INJECTION = "injection"
    SUBLINGUAL = "sublingual"
    RECTAL = "rectal"
    UNKNOWN = "unknown"


class Timing(str, Enum):
    BEFORE_FOOD = "before_food"
    AFTER_FOOD = "after_food"
    WITH_FOOD = "with_food"
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"
    AS_NEEDED = "as_needed"
    UNKNOWN = "unknown"


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class InfoSource(str, Enum):
    OCR = "ocr"
    MEDICAL_ENGINE = "medical_engine"
    USER = "user"
    LLM = "llm"


class DocumentType(str, Enum):
    PRESCRIPTION = "prescription"
    LAB_REPORT = "lab_report"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class LabFlag(str, Enum):
    NORMAL = "normal"
    HIGH = "high"
    LOW = "low"
    ABNORMAL = "abnormal"
    UNKNOWN = "unknown"


class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNCERTAIN = "uncertain"