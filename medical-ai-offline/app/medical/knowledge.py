"""Loader for the local medicine knowledge base.

The knowledge base is the single source of medical facts used by the
deterministic MedicalEngine. It is loaded from the packaged JSON file and can
be extended by an administrator without code changes.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.config import settings
from app.utils.logging import get_logger

log = get_logger("medical.knowledge")

_EMPTY = {
    "version": 0,
    "medicines": {},
    "interactions": {},
}


class MedicineKnowledgeBase:
    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path or settings.knowledge_base_path)
        self.data: dict = dict(_EMPTY)
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            log.error("knowledge base missing: %s", self.path)
            self.data = dict(_EMPTY)
            return
        try:
            self.data = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            log.error("knowledge base invalid JSON: %s", exc)
            self.data = dict(_EMPTY)

    @property
    def version(self) -> int:
        return self.data.get("version", 0)

    def medicine(self, key: str) -> dict | None:
        entry = self.data.get("medicines", {}).get(key)
        return entry if entry else None

    def medicine_by_alias(self, name: str) -> tuple[str, dict] | None:
        name = _clean_key(name)
        for key, entry in self.data.get("medicines", {}).items():
            if key == name:
                return key, entry
            for alias in entry.get("aliases", []):
                if _clean_key(alias) == name:
                    return key, entry
        return None

    def names(self) -> list[str]:
        return list(self.data.get("medicines", {}).keys())

    def aliases(self) -> list[str]:
        result: list[str] = []
        for entry in self.data.get("medicines", {}).values():
            result.extend(entry.get("aliases", []))
        return result

    def interaction(self, medicine_a: str, medicine_b: str) -> str | None:
        entry = self.data.get("interactions", {}).get(medicine_a, {}).get(medicine_b)
        if entry is False:
            return None
        if isinstance(entry, str):
            return entry
        return self.data.get("interactions", {}).get(medicine_b, {}).get(medicine_a)


def _clean_key(value: str) -> str:
    return value.strip().lower().replace("_", " ").replace("-", " ")


knowledge_base = MedicineKnowledgeBase()