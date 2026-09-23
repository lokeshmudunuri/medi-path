"""Model registry tests."""
from __future__ import annotations

import json

import pytest

from app.core.registry import (
    ModelDefinition,
    ModelRegistry,
    ModelRegistryError,
    RegistryFile,
    human_size,
)
from app.domain.enums import ModelState, ModelType


def test_registry_loads_all_models():
    registry = ModelRegistry()
    assert len(registry.all()) >= 4
    ids = {m.id for m in registry.all()}
    assert {"ocr-rapidocr", "stt-vosk-en", "llm-qwen3-coder", "tts-piper-en"} <= ids


def test_registry_fields_complete():
    registry = ModelRegistry()
    for model in registry.all():
        assert model.id
        assert model.name
        assert model.type
        assert model.runtime
        assert model.license
        assert model.total_size_bytes >= 0
        for f in model.files:
            assert f.name
            assert f.url
            assert isinstance(f.size_bytes, int)


def test_required_and_optional_split():
    registry = ModelRegistry()
    required = registry.required()
    assert len(required) >= 4
    assert all(m.required for m in required)
    assert all(not m.required for m in registry.optional())


def test_registry_require_missing_raises():
    registry = ModelRegistry()
    with pytest.raises(ModelRegistryError):
        registry.require("does-not-exist")


def test_registry_missing_file_raises(tmp_path):
    with pytest.raises(ModelRegistryError):
        ModelRegistry(registry_path=tmp_path / "nope.json")


def test_registry_invalid_json_raises(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("{ nope", encoding="utf-8")
    with pytest.raises(ModelRegistryError):
        ModelRegistry(registry_path=bad)


def test_model_type_enum():
    definition = ModelDefinition(
        id="x", name="x", type="ocr", runtime="onnx", version="1", required=True
    )
    assert definition.model_type == ModelType.OCR
    odd = ModelDefinition(
        id="y", name="y", type="bogus", runtime="x", version="1", required=False
    )
    assert odd.model_type == ModelType.OTHER


def test_model_type_produces_expected_fields():
    d = {"id": "a", "name": "A", "type": "llm", "runtime": "ollama",
         "version": "v1", "required": True,
         "files": [{"name": "f", "url": "http://x", "size_bytes": 5, "sha256": "ab"}],
         "total_size_bytes": 5, "minimum_storage_bytes": 10, "minimum_ram_bytes": 20,
         "quantization": "q4", "accelerator": "CPU", "license": "MIT",
         "install_path_relative": "llm/a", "languages": ["en"]}
    definition = ModelDefinition.from_dict(d)
    assert definition.id == "a"
    assert definition.primary_url == "http://x"
    assert definition.display_size == "5 B"
    assert definition.to_dict()["files"][0]["sha256"] == "ab"


def test_human_size():
    assert human_size(0) == "0 B"
    assert human_size(1024) == "1 KB"
    assert "MB" in human_size(1024 * 1024)
    assert "GB" in human_size(1024 * 1024 * 1024)


def test_registry_serialization_roundtrip(tmp_path):
    source = tmp_path / "src.json"
    source.write_text(
        json.dumps({
            "models": [
                {
                    "id": "m1", "name": "M1", "type": "tts", "runtime": "piper",
                    "version": "1", "required": False,
                    "files": [{"name": "f.onnx", "url": "u", "size_bytes": 9, "sha256": "abc"}],
                    "total_size_bytes": 9, "minimum_storage_bytes": 1,
                    "minimum_ram_bytes": 1, "license": "x",
                }
            ]
        }),
        encoding="utf-8",
    )
    registry = ModelRegistry(registry_path=source)
    model = registry.get("m1")
    assert model is not None
    assert len(model.files) == 1
    file = model.files[0]
    assert isinstance(file, RegistryFile)
    assert file.sha256 == "abc"
    assert model.model_type == ModelType.TTS
    assert not model.required


def test_model_status_listing_shape():
    from app.core.model_manager import default_manager

    listing = default_manager.list_models_with_status()
    assert listing
    for entry in listing:
        assert "definition" in entry
        assert "status" in entry
        assert entry["status"]["state"] in {
            "NOT_INSTALLED", "INSTALLED", "READY", "PAUSED", "FAILED",
            "VERIFICATION_FAILED", "DOWNLOADING", "DOWNLOAD_FINISHED", "VERIFYING",
        }