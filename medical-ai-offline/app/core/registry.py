"""Centralized model registry.

All knowledge about AI models (URLs, sizes, checksums, runtimes, licenses,
install paths) is declared in a single JSON registry file. The rest of the
application loads everything through :class:`ModelRegistry` so URLs and
filenames are never scattered across source files.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from app.config import settings
from app.domain.enums import ModelType


@dataclass
class RegistryFile:
    name: str
    url: str
    size_bytes: int
    sha256: str | None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "url": self.url,
            "size_bytes": self.size_bytes,
            "sha256": self.sha256,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "RegistryFile":
        return cls(
            name=data.get("name", ""),
            url=data.get("url", ""),
            size_bytes=int(data.get("size_bytes", 0)),
            sha256=data.get("sha256"),
        )


@dataclass
class ModelDefinition:
    """One entry from the model registry."""

    id: str
    name: str
    type: str
    runtime: str
    version: str
    required: bool
    files: list[RegistryFile] = field(default_factory=list)
    total_size_bytes: int = 0
    minimum_storage_bytes: int = 0
    minimum_ram_bytes: int = 0
    quantization: str = ""
    accelerator: str = "CPU"
    license: str = ""
    install_path_relative: str = ""
    languages: list[str] = field(default_factory=list)
    source: str = ""
    description: str = ""

    @property
    def model_type(self) -> ModelType:
        try:
            return ModelType(self.type)
        except ValueError:
            return ModelType.OTHER

    @property
    def display_size(self) -> str:
        return human_size(self.total_size_bytes)

    @property
    def primary_url(self) -> str:
        return self.files[0].url if self.files else ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "runtime": self.runtime,
            "version": self.version,
            "required": self.required,
            "files": [f.to_dict() for f in self.files],
            "total_size_bytes": self.total_size_bytes,
            "minimum_storage_bytes": self.minimum_storage_bytes,
            "minimum_ram_bytes": self.minimum_ram_bytes,
            "quantization": self.quantization,
            "accelerator": self.accelerator,
            "license": self.license,
            "install_path_relative": self.install_path_relative,
            "languages": list(self.languages),
            "display_size": self.display_size,
            "source": self.source,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ModelDefinition":
        return cls(
            id=data["id"],
            name=data["name"],
            type=data["type"],
            runtime=data["runtime"],
            version=data.get("version", ""),
            required=bool(data.get("required", False)),
            files=[RegistryFile.from_dict(f) for f in data.get("files", [])],
            total_size_bytes=int(data.get("total_size_bytes", 0)),
            minimum_storage_bytes=int(data.get("minimum_storage_bytes", 0)),
            minimum_ram_bytes=int(data.get("minimum_ram_bytes", 0)),
            quantization=data.get("quantization", ""),
            accelerator=data.get("accelerator", "CPU"),
            license=data.get("license", ""),
            install_path_relative=data.get("install_path_relative", ""),
            languages=list(data.get("languages", [])),
            source=data.get("source", ""),
            description=data.get("description", ""),
        )


def human_size(num: int) -> str:
    value = float(num)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if value < 1024.0 or unit == "TB":
            return f"{value:.0f} {unit}" if unit == "B" else f"{value:.0f} {unit}"
        value /= 1024.0
    return f"{num} B"


class ModelRegistryError(Exception):
    pass


class ModelRegistry:
    """Loads and serves model definitions from the JSON registry."""

    def __init__(self, registry_path: Path | None = None) -> None:
        self.path = Path(registry_path or settings.registry_path)
        self.models: list[ModelDefinition] = []
        self.version = ""
        self.reload()

    def reload(self) -> None:
        if not self.path.exists():
            raise ModelRegistryError(f"Model registry not found: {self.path}")
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ModelRegistryError(f"Model registry is invalid JSON: {exc}") from exc
        self.version = raw.get("$schema", "version 1")
        self.models = [ModelDefinition.from_dict(m) for m in raw.get("models", [])]

    def all(self) -> list[ModelDefinition]:
        return list(self.models)

    def get(self, model_id: str) -> ModelDefinition | None:
        return next((m for m in self.models if m.id == model_id), None)

    def require(self, model_id: str) -> ModelDefinition:
        model = self.get(model_id)
        if model is None:
            raise ModelRegistryError(f"Unknown model id: {model_id}")
        return model

    def by_type(self, model_type: str) -> list[ModelDefinition]:
        return [m for m in self.models if m.type == model_type]

    def required(self) -> list[ModelDefinition]:
        return [m for m in self.models if m.required]

    def optional(self) -> list[ModelDefinition]:
        return [m for m in self.models if not m.required]

    def total_download_bytes(self, model_ids: list[str] | None = None) -> int:
        models = [self.require(i) for i in model_ids] if model_ids else self.required()
        return sum(m.total_size_bytes for m in models)


default_registry = ModelRegistry()