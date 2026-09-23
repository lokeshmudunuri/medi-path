"""Model download & lifecycle manager.

Owns the model state machine:

    NOT_INSTALLED -> DOWNLOADING -> DOWNLOAD_FINISHED -> VERIFYING -> INSTALLED/READY
    DOWNLOADING -> PAUSED -> DOWNLOADING
    DOWNLOADING/VERIFYING -> FAILED -> (retry)
    INSTALLED -> VERIFICATION_FAILED -> re-download

Downloaded bytes are streamed to `<modeldir>/.download/<name>.part` with
HTTP Range resume support. A model is only marked INSTALLED after every file
is fully downloaded, checksum-verified (when a checksum is known) and passed
basic validation. Incomplete files are never treated as valid models.
"""
from __future__ import annotations

import json
import os
import shutil
import threading
import time
import zipfile
from dataclasses import asdict, dataclass, field
from pathlib import Path

import httpx

from app.ai.llm.ollama_provider import ollama_host, ollama_installed_tags
from app.config import settings
from app.core.hashing import verify_sha256
from app.core.registry import ModelDefinition, ModelRegistry, human_size
from app.core.storage import storage
from app.domain.enums import ModelState
from app.utils.logging import get_logger

log = get_logger("model_manager")

_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


@dataclass
class FileProgress:
    name: str
    bytes_done: int = 0
    size_bytes: int = 0
    complete: bool = False
    verified: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DownloadRecord:
    model_id: str
    state: str = ModelState.NOT_INSTALLED.value
    total_bytes: int = 0
    bytes_done: int = 0
    error: str = ""
    progress: float = 0.0
    files: list[FileProgress] = field(default_factory=list)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "model_id": self.model_id,
            "state": self.state,
            "total_bytes": self.total_bytes,
            "bytes_done": self.bytes_done,
            "error": self.error,
            "progress": round(self.progress, 4),
            "files": [f.to_dict() for f in self.files],
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DownloadRecord":
        rec = cls(model_id=data.get("model_id", ""))
        rec.state = data.get("state", ModelState.NOT_INSTALLED.value)
        rec.total_bytes = int(data.get("total_bytes", 0))
        rec.bytes_done = int(data.get("bytes_done", 0))
        rec.error = data.get("error", "")
        rec.progress = float(data.get("progress", 0.0))
        rec.files = [
            FileProgress(
                name=f.get("name", ""),
                bytes_done=int(f.get("bytes_done", 0)),
                size_bytes=int(f.get("size_bytes", 0)),
                complete=bool(f.get("complete", False)),
                verified=bool(f.get("verified", False)),
            )
            for f in data.get("files", [])
        ]
        rec.updated_at = float(data.get("updated_at", time.time()))
        return rec


class _StateStore:
    """Persists per-model download records as JSON next to the model files."""

    def _path(self, model_id: str) -> Path:
        return storage.model_base(model_id) / "state.json"

    def load(self, model_id: str) -> DownloadRecord | None:
        path = self._path(model_id)
        if not path.exists():
            return None
        try:
            return DownloadRecord.from_dict(json.loads(path.read_text(encoding="utf-8")))
        except Exception as exc:  # corrupt state -> start clean
            log.warning("state file for %s unreadable: %s", model_id, exc)
            return None

    def save(self, record: DownloadRecord) -> None:
        record.updated_at = time.time()
        self._path(record.model_id).write_text(
            json.dumps(record.to_dict(), indent=2), encoding="utf-8"
        )


class ModelDownloadManager:
    """Thread-safe download manager with resumable, verifiable downloads."""

    def __init__(self, registry: ModelRegistry | None = None) -> None:
        self.registry = registry or ModelRegistry()
        self._store = _StateStore()
        self._lock = threading.RLock()
        self._threads: dict[str, threading.Thread] = {}
        self._cancel_flags: set[str] = set()

    # ------------------------------------------------------------- queries
    def get_state(self, model_id: str) -> DownloadRecord:
        with self._lock:
            record = self._store.load(model_id)
            if record is None:
                record = DownloadRecord(model_id=model_id)
            else:
                self._reconcile_installed(record)
                self._store.save(record)
            return record

    def _reconcile_installed(self, record: DownloadRecord) -> None:
        """If files are already on disk and verified, state is INSTALLED.

        Ollama-managed LLMs are reconciled against the live local runtime via
        the shared cached probe instead of an on-disk model directory.
        """
        definition = self.registry.get(record.model_id)
        if definition is None:
            return
        if record.state in (ModelState.INSTALLED.value, ModelState.READY.value):
            return
        if is_ollama_managed(definition):
            if not _force_mock_env() and self._ollama_model_present(definition):
                record.state = ModelState.INSTALLED.value
                record.progress = 1.0
                record.error = ""
                record.updated_at = time.time()
            return
        if self._files_verified_on_disk(definition):
            record.state = ModelState.INSTALLED.value
            record.progress = 1.0
            record.error = ""

    def get_download_progress(self, model_id: str) -> dict:
        return self.get_state(model_id).to_dict()

    def get_installed_models(self) -> list[str]:
        return [
            m.id for m in self.registry.all() if self.is_model_installed(m.id)
        ]

    def get_required_models(self) -> list[ModelDefinition]:
        return self.registry.required()

    def is_model_installed(self, model_id: str) -> bool:
        state = self.get_state(model_id).state
        return state in (ModelState.INSTALLED.value, ModelState.READY.value)

    def list_models_with_status(self) -> list[dict]:
        result = []
        for definition in self.registry.all():
            record = self.get_state(definition.id)
            result.append(
                {
                    "definition": definition.to_dict(),
                    "status": {
                        "state": record.state,
                        "progress": round(record.progress, 4),
                        "bytes_done": record.bytes_done,
                        "bytes_total": record.total_bytes,
                        "error": record.error,
                    },
                }
            )
        return result

    # ------------------------------------------------------------- actions
    def check_storage_before_download(self, model_id: str) -> tuple[bool, str]:
        definition = self.registry.require(model_id)
        free = storage.free_bytes()
        needed = max(definition.total_size_bytes, definition.minimum_storage_bytes)
        if free < 0:
            return True, "Unable to measure free storage; proceeding."
        if free < needed:
            return (
                False,
                f"Not enough storage to install selected models. "
                f"Needed ~{human_size(needed)}, available {human_size(free)}.",
            )
        return True, f"OK ({human_size(free)} available)"

    def download_model(self, model_id: str, start: bool = True) -> DownloadRecord:
        definition = self.registry.require(model_id)
        if is_ollama_managed(definition):
            return self._handle_ollama_managed(definition)
        with self._lock:
            self._cancel_flags.discard(model_id)
            record = self.get_state(model_id)
            if record.state == ModelState.VERIFYING.value:
                return record
            if record.state != ModelState.DOWNLOADING.value:
                record = self._prepare_record(definition, record)
                self._store.save(record)
        if start:
            self._start_thread(definition)
        return record

    def _prepare_record(self, definition: ModelDefinition, record: DownloadRecord) -> DownloadRecord:
        record.state = ModelState.DOWNLOADING.value
        record.error = ""
        record.total_bytes = definition.total_size_bytes
        removed = {fp.name for fp in record.files} - {f.name for f in definition.files}
        record.files = [
            fp for fp in record.files if fp.name in {f.name for f in definition.files}
        ]
        registry_names = {fp.name for fp in record.files}
        for f in definition.files:
            if f.name not in registry_names:
                record.files.append(FileProgress(name=f.name, size_bytes=f.size_bytes))
        record.files = [
            fp for fp in record.files if fp.name not in removed
        ]
        self._reconcile_from_state_files(record)
        return record

    def _reconcile_from_state_files(self, record: DownloadRecord) -> None:
        """Preserve already-downloaded temp bytes when a previous run paused."""
        tmp_dir = storage.model_download_tmp(record.model_id)
        done = 0
        for fp in record.files:
            part = tmp_dir / f"{fp.name}.part"
            if part.exists() and not fp.complete:
                fp.bytes_done = min(part.stat().st_size, fp.size_bytes or part.stat().st_size)
            done += fp.bytes_done if not fp.complete else fp.size_bytes
        record.bytes_done = done
        record.progress = (
            done / record.total_bytes if record.total_bytes else 0.0
        )

    def pause_download(self, model_id: str) -> DownloadRecord:
        definition = self.registry.get(model_id)
        if definition and is_ollama_managed(definition):
            return self.get_state(model_id)
        with self._lock:
            record = self.get_state(model_id)
            record.state = ModelState.PAUSED.value
            self._store.save(record)
        return record

    def resume_download(self, model_id: str) -> DownloadRecord:
        definition = self.registry.require(model_id)
        if is_ollama_managed(definition):
            return self._handle_ollama_managed(definition)
        return self.download_model(model_id, start=True)

    def cancel_download(self, model_id: str) -> DownloadRecord:
        with self._lock:
            self._cancel_flags.add(model_id)
            record = self.get_state(model_id)
            record.state = ModelState.NOT_INSTALLED.value
            record.bytes_done = 0
            record.progress = 0.0
            record.error = ""
            self._store.save(record)
        return record

    def delete_model(self, model_id: str) -> DownloadRecord:
        with self._lock:
            self._cancel_flags.add(model_id)
            base = storage.model_base(model_id)
            if base.exists():
                shutil.rmtree(base, ignore_errors=True)
            record = self.get_state(model_id)
            record.state = ModelState.NOT_INSTALLED.value
            record.bytes_done = 0
            record.progress = 0.0
            record.error = ""
            record.files = []
            self._store.save(record)
        definition = self.registry.get(model_id)
        if definition and is_ollama_managed(definition):
            self._try_ollama_delete(model_id)
        return record

    def verify_model(self, model_id: str) -> DownloadRecord:
        definition = self.registry.require(model_id)
        if is_ollama_managed(definition):
            return self._verify_ollama_managed(definition)
        record = self.get_state(model_id)
        record.state = ModelState.VERIFYING.value
        self._store.save(record)
        ok, details = self._verify_files(definition)
        if ok:
            record.state = ModelState.INSTALLED.value
            record.progress = 1.0
            record.bytes_done = record.total_bytes
            for fp in record.files:
                fp.complete = True
                fp.verified = True
            self._apply_post_install(definition)
        else:
            record.state = ModelState.VERIFICATION_FAILED.value
            record.error = details
        self._store.save(record)
        return record

    # ------------------------------------------------------ worker thread
    def _start_thread(self, definition: ModelDefinition) -> None:
        with self._lock:
            if self._threads.get(definition.id) and self._threads[definition.id].is_alive():
                return
            thread = threading.Thread(
                target=self._run_download, args=(definition,), daemon=True, name=f"dl-{definition.id}"
            )
            self._threads[definition.id] = thread
            thread.start()

    def _run_download(self, definition: ModelDefinition) -> None:
        record = self.get_state(definition.id)
        if record.state != ModelState.DOWNLOADING.value:
            return
        failed = False
        error_message = ""
        try:
            for fp in record.files:
                if self._is_cancelled(definition.id):
                    return
                if self._download_file(definition, fp) is False:
                    failed = True
                    error_message = f"Failed to download {fp.name}"
                    break
        except Exception as exc:  # network/IO
            failed = True
            error_message = str(exc)
        with self._lock:
            record = self.get_state(definition.id)
            if self._is_cancelled(definition.id):
                return
            if failed:
                record.state = ModelState.FAILED.value
                record.error = error_message
            else:
                record.state = ModelState.DOWNLOAD_FINISHED.value
            self._store.save(record)
        if not failed:
            self.verify_model(definition.id)

    def _download_file(self, definition: ModelDefinition, fp: FileProgress) -> bool:
        registry_file = next((f for f in definition.files if f.name == fp.name), None)
        if registry_file is None or not registry_file.url:
            return False
        if is_ollama_managed(definition):
            return True
        tmp_dir = storage.model_download_tmp(definition.id)
        part = tmp_dir / f"{fp.name}.part"
        headers = {}
        if part.exists() and part.stat().st_size > 0:
            headers["Range"] = f"bytes={part.stat().st_size}-"
        try:
            with httpx.stream(
                "GET", registry_file.url, headers=headers or None, timeout=_TIMEOUT, follow_redirects=True
            ) as response:
                if response.status_code == 416:  # range not satisfiable -> restart
                    part.unlink(missing_ok=True)
                    with httpx.stream(
                        "GET", registry_file.url, timeout=_TIMEOUT, follow_redirects=True
                    ) as response2:
                        response2.raise_for_status()
                        return self._stream_to_part(response2, part)
                response.raise_for_status()
                return self._stream_to_part(response, part)
        except Exception as exc:
            log.warning("download %s/%s failed: %s", definition.id, fp.name, exc)
            return False

    def _stream_to_part(self, response, part: Path) -> bool:
        with open(part, "ab") as fh:
            for chunk in response.iter_bytes(settings.download_chunk_size):
                fh.write(chunk)
                with self._lock:
                    record = self.get_state(part.parent.parent.name)
                    fp = next((x for x in record.files if f"{x.name}.part" == part.name), None)
                    if fp is not None:
                        fp.bytes_done = part.stat().st_size
                    record.bytes_done = sum(
                        fp.bytes_done if not fp.complete else fp.size_bytes
                        for fp in record.files
                    )
                    record.progress = record.bytes_done / record.total_bytes if record.total_bytes else 0.0
                    record.updated_at = time.time()
                    self._store.save(record)
        return True

    def _verify_files(self, definition: ModelDefinition) -> tuple[bool, str]:
        tmp_dir = storage.model_download_tmp(definition.id)
        for registry_file in definition.files:
            candidate = tmp_dir / registry_file.name
            if not candidate.exists():
                part = tmp_dir / f"{registry_file.name}.part"
                if part.exists():
                    candidate = part
            if not verify_sha256(candidate, registry_file.sha256):
                return False, f"checksum verification failed for {registry_file.name}"
            if registry_file.size_bytes and candidate.stat().st_size < registry_file.size_bytes:
                return False, f"size verification failed for {registry_file.name}"
        return True, ""

    def _files_verified_on_disk(self, definition: ModelDefinition) -> bool:
        install_dir = storage.model_install_dir(definition.id, definition.install_path_relative)
        for registry_file in definition.files:
            candidate = install_dir / registry_file.name
            if not candidate.exists():
                return False
            if not verify_sha256(candidate, registry_file.sha256):
                return False
            if registry_file.size_bytes and candidate.stat().st_size < registry_file.size_bytes:
                return False
        return True

    def _apply_post_install(self, definition: ModelDefinition) -> None:
        """Move verified files from temp to the final install path and extract
        archives (e.g. zipped Vosk models)."""
        tmp_dir = storage.model_download_tmp(definition.id)
        install_dir = storage.model_install_dir(definition.id, definition.install_path_relative)
        for registry_file in definition.files:
            src = tmp_dir / registry_file.name
            if not src.exists():
                part = tmp_dir / f"{registry_file.name}.part"
                if not part.exists():
                    continue
                src = part
            if src.suffix == ".zip":
                target_zip = install_dir / src.name
                self._safe_copy(src, target_zip)
                with zipfile.ZipFile(target_zip) as zf:
                    zf.extractall(install_dir)
            else:
                target = install_dir / registry_file.name
                self._safe_copy(src, target)

    @staticmethod
    def _safe_copy(src: Path, dst: Path) -> None:
        dst.parent.mkdir(parents=True, exist_ok=True)
        try:
            dst.unlink(missing_ok=True)
        except OSError:
            pass
        shutil.copy2(src, dst)
        src.unlink(missing_ok=True)

    def _is_cancelled(self, model_id: str) -> bool:
        return model_id in self._cancel_flags

    # ------------------------------------------------ ollama-managed LLMs
    def _handle_ollama_managed(self, definition: ModelDefinition) -> DownloadRecord:
        record = self.get_state(definition.id)
        if self._ollama_model_present(definition):
            record.state = ModelState.INSTALLED.value
            record.progress = 1.0
        else:
            record.state = ModelState.NOT_INSTALLED.value
            record.error = (
                "Managed by the local Ollama runtime. Pull the model with Ollama "
                "(see DEVELOPMENT.md), or press download to trigger a local pull."
            )
        self._store.save(record)
        self._try_ollama_pull(definition)
        return record

    def _verify_ollama_managed(self, definition: ModelDefinition) -> DownloadRecord:
        record = self.get_state(definition.id)
        record.state = (
            ModelState.INSTALLED.value
            if self._ollama_model_present(definition)
            else ModelState.VERIFICATION_FAILED.value
        )
        self._store.save(record)
        return record

    def _ollama_model_present(self, definition: ModelDefinition) -> bool:
        model_tag = ollama_tag(definition)
        if not model_tag:
            return False
        return any(name == model_tag for name in ollama_installed_tags()[1])

    def _try_ollama_pull(self, definition: ModelDefinition) -> None:
        """Trigger a best-effort, non-blocking `ollama pull` via the CLI.

        Only runs when the model is not already present in the local runtime.
        """
        model_tag = ollama_tag(definition)
        if not model_tag:
            return
        if self._ollama_model_present(definition):
            return

        def _pull() -> None:
            import subprocess

            try:
                subprocess.run(
                    ["ollama", "pull", model_tag],
                    timeout=7200,
                )
                self._verify_ollama_managed(definition)
            except Exception as exc:
                log.warning("ollama pull failed: %s", exc)

        with self._lock:
            if self._threads.get(definition.id) and self._threads[definition.id].is_alive():
                return
            thread = threading.Thread(target=_pull, daemon=True, name=f"ollama-{definition.id}")
            self._threads[definition.id] = thread
            thread.start()

    def _try_ollama_delete(self, model_id: str) -> None:
        definition = self.registry.get(model_id)
        model_tag = ollama_tag(definition)
        if not model_tag:
            return
        try:
            httpx.delete(f"{ollama_host()}/api/delete", json={"model": model_tag}, timeout=5.0)
        except Exception:
            pass


def ollama_tag(definition: ModelDefinition | None) -> str | None:
    if not definition or not definition.files:
        return None
    url = definition.files[0].url
    if url.startswith("ollama://"):
        return url.split("ollama://", 1)[1]
    return None


def is_ollama_managed(definition: ModelDefinition | None) -> bool:
    return ollama_tag(definition) is not None


def _force_mock_env() -> bool:
    """True when the app is forced into mock AI mode (used by tests)."""
    return os.environ.get("LOCALMED_FORCE_MOCK", "0") == "1"


default_manager = ModelDownloadManager()