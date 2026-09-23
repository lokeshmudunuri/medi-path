"""Filesystem abstractions for app-managed storage.

Everything sensitive (images, OCR text, chat) lives under the runtime data
directory and is never written into logs. This module is the single owner of
on-disk layout used by the repositories and the model manager.
"""
from __future__ import annotations

from pathlib import Path

from app.config import settings


class Storage:
    def __init__(self) -> None:
        self.model_dir: Path = Path(settings.model_dir)
        self.case_dir: Path = Path(settings.case_dir)
        self.data_dir: Path = Path(settings.data_dir)
        self.ensure_dirs()

    def ensure_dirs(self) -> None:
        for path in (self.data_dir, self.model_dir, self.case_dir):
            path.mkdir(parents=True, exist_ok=True)

    # ---- models ----------------------------------------------------------
    def model_install_dir(self, model_id: str, relative_subpath: str) -> Path:
        """Return the absolute on-disk directory where a model is installed."""
        target = self.model_dir / model_id / relative_subpath
        target.mkdir(parents=True, exist_ok=True)
        return target

    def model_download_tmp(self, model_id: str) -> Path:
        tmp = self.model_dir / model_id / ".download"
        tmp.mkdir(parents=True, exist_ok=True)
        return tmp

    def model_base(self, model_id: str) -> Path:
        base = self.model_dir / model_id
        base.mkdir(parents=True, exist_ok=True)
        return base

    # ---- cases -----------------------------------------------------------
    def case_dir_for(self, case_id: str) -> Path:
        folder = self.case_dir / case_id
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def case_image_path(self, case_id: str) -> Path:
        return self.case_dir_for(case_id) / "prescription_image.jpg"

    def case_audio_path(self, case_id: str, message_id: str) -> Path:
        return self.case_dir_for(case_id) / f"audio_{message_id}.wav"

    def free_bytes(self, path: Path | None = None) -> int:
        """Free disk space (bytes) on the volume hosting `path`."""
        target = path or self.data_dir
        target = Path(target).resolve()
        while not target.exists():
            parent = target.parent
            if parent == target:
                return 0
            target = parent
        try:
            return __import__("shutil").disk_usage(target).free
        except Exception:  # pragma: no cover - platform edge cases
            return -1


storage = Storage()