"""Model download manager tests: state machine, resume, checksum, storage."""
from __future__ import annotations

import hashlib
import threading

from app.core.hashing import sha256_hexdigest, verify_sha256
from app.core.model_manager import ModelDownloadManager, is_ollama_managed
from app.core.registry import ModelDefinition, RegistryFile
from app.domain.enums import ModelState


def build_manager(monkeypatch, tmp_path):
    from app.core import storage as storage_module

    class TinyRegistry:
        def __init__(self, models):
            self.models = models
            self._lookup = {m.id: m for m in models}

        def all(self):
            return self.models

        def get(self, model_id):
            return self._lookup.get(model_id)

        def require(self, model_id):
            m = self._lookup.get(model_id)
            if m is None:
                raise KeyError(model_id)
            return m

        def required(self):
            return [m for m in self.models if m.required]

    data = b"0123456789abcdef" * 1024  # 16 KB payload
    registry_file = RegistryFile(name="model.bin", url="", size_bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
    definition = ModelDefinition(
        id="test-model", name="Test", type="ocr", runtime="onnx", version="1",
        required=True, files=[registry_file], total_size_bytes=len(data),
        minimum_storage_bytes=len(data),
    )
    registry = TinyRegistry([definition])
    manager = ModelDownloadManager(registry=registry)
    monkeypatch.setattr(manager, "check_storage_before_download", lambda m: (True, "ok"))
    return manager, definition, data, registry_file


def test_download_resume_and_checksum(byte_server, monkeypatch, tmp_path):
    manager, definition, data, registry_file = build_manager(monkeypatch, tmp_path)
    registry_file.url = byte_server.url("model.bin")
    byte_server.put("model.bin", data)

    manager.download_model(definition.id, start=False)
    # Simulate a partial download by pre-writing a .part file with half the data.
    from app.core.storage import storage

    part = storage.model_download_tmp(definition.id) / "model.bin.part"
    part.write_bytes(data[: len(data) // 2])
    record = manager.download_model(definition.id, start=True)
    assert record.state == ModelState.DOWNLOADING.value

    deadline = 0
    while manager.get_state(definition.id).state != ModelState.INSTALLED.value and deadline < 200:
        deadline += 1
        threading.Event().wait(0.05)
    record = manager.get_state(definition.id)
    assert record.state == ModelState.INSTALLED.value, record.error
    assert record.progress == 1.0

    # Because we pre-filled half the part, the server must have seen a Range
    # request not starting at 0 (resume behaviour).
    hits = [h for h in byte_server.hit_headers() if h["name"] == "model.bin"]
    assert any(h["start"] > 0 for h in hits)

    # Final installed file verifies.
    install_dir = storage.model_install_dir(definition.id, definition.install_path_relative)
    installed = install_dir / "model.bin"
    assert installed.exists()
    assert verify_sha256(installed, registry_file.sha256)
    assert manager.is_model_installed(definition.id)


def test_download_366_restarts_when_complete_part_resent(byte_server, monkeypatch, tmp_path):
    manager, definition, data, registry_file = build_manager(monkeypatch, tmp_path)
    registry_file.url = byte_server.url("model.bin")
    byte_server.put("model.bin", data)
    from app.core.storage import storage

    part = storage.model_download_tmp(definition.id) / "model.bin.part"
    part.write_bytes(data)  # pretend fully downloaded part
    manager.download_model(definition.id, start=True)
    deadline = 0
    while manager.get_state(definition.id).state != ModelState.INSTALLED.value and deadline < 100:
        deadline += 1
        threading.Event().wait(0.05)
    assert manager.get_state(definition.id).state == ModelState.INSTALLED.value


def test_corrupt_file_fails_verification(tmp_path):
    manager = ModelDownloadManager()
    record = manager.get_state("ocr-rapidocr")
    record.files = []
    # Not a real model dir; verification must fail cleanly without exceptions.
    from app.core.storage import storage

    tmp = storage.model_download_tmp("ocr-rapidocr")
    (tmp / "anything.onnx").write_bytes(b"corrupt")
    definition = manager.registry.require("ocr-rapidocr")
    ok, detail = manager._verify_files(definition)
    assert ok is False
    assert detail  # verification failed with a reason


def test_checksum_mismatch_fails(tmp_path):
    from app.core.hashing import verify_sha256

    file = tmp_path / "x.bin"
    file.write_bytes(b"hello")
    assert verify_sha256(file, hashlib.sha256(b"nope").hexdigest()) is False
    assert verify_sha256(file, hashlib.sha256(b"hello").hexdigest()) is True
    assert verify_sha256(file, None) is True
    assert verify_sha256(file, "") is True
    assert verify_sha256(tmp_path / "missing", "abc") is False


def test_sha256_known_vector(tmp_path):
    file = tmp_path / "a.bin"
    file.write_bytes(b"abc")
    assert sha256_hexdigest(file) == hashlib.sha256(b"abc").hexdigest()


def test_pause_cancel_delete(tmp_path):
    from app.core.model_manager import ModelDownloadManager

    manager = ModelDownloadManager()
    record = manager.pause_download("ocr-rapidocr")
    assert record.state == ModelState.PAUSED.value
    record = manager.cancel_download("ocr-rapidocr")
    assert record.state == ModelState.NOT_INSTALLED.value
    record = manager.delete_model("ocr-rapidocr")
    assert record.state == ModelState.NOT_INSTALLED.value
    assert not manager.is_model_installed("ocr-rapidocr")


def test_ollama_managed_detection():
    managed = ModelDefinition(
        id="llm", name="L", type="llm", runtime="ollama", version="1", required=True,
        files=[RegistryFile(name="q:", url="ollama://qwen2.5:0.5b-instruct-q4_K_M", size_bytes=0, sha256=None)],
    )
    normal = ModelDefinition(
        id="o", name="O", type="ocr", runtime="onnx", version="1", required=True,
        files=[RegistryFile(name="f", url="https://x", size_bytes=0, sha256=None)],
    )
    assert is_ollama_managed(managed)
    assert not is_ollama_managed(normal)


def test_storage_check(tmp_path):
    from app.core.model_manager import ModelDownloadManager

    manager = ModelDownloadManager()
    ok, message = manager.check_storage_before_download("ocr-rapidocr")
    assert ok is True or "month" in message.lower()
    assert isinstance(message, str)