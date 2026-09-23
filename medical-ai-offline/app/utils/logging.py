"""Privacy-aware logging helpers.

Purpose: never write prescription/medical content into logs. The module also
offers a small structured audit log for non-sensitive lifecycle events.
"""
from __future__ import annotations

import logging
import sys

_LOGGER_NAME = "localmed"


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(f"{_LOGGER_NAME}.{name}")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def redact(text: str | None, keep: int = 4) -> str:
    """Replace a sensitive string with a length marker, never its content."""
    if text is None:
        return "<none>"
    return f"<redacted len={len(text)}>"