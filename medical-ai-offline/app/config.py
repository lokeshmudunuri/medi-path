"""Application configuration.

All runtime paths are resolved relative to the repository/app root so the
application works without a packaged environment. On a deployed installation
the administrator can override via environment variables (see DEVELOPMENT.md).
"""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings

APP_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime settings. All values have safe local defaults."""

    app_name: str = "LocalMed — Offline Medical Assistant"
    version: str = "0.1.0"

    # Data storage roots. These are runtime-only locations:
    #   <root>/data/models  -> downloaded AI models
    #   <root>/data/cases   -> local case files (images, OCR, chat)
    data_dir: Path = APP_ROOT / "data"
    model_dir: Path = APP_ROOT / "data" / "models"
    case_dir: Path = APP_ROOT / "data" / "cases"

    # Centralized model registry (part of the application package).
    registry_path: Path = APP_ROOT / "models" / "registry" / "model_registry.json"

    # Medical knowledge base (bundled, small, curator-extendable).
    knowledge_base_path: Path = APP_ROOT / "app" / "medical" / "data" / "medicine_knowledge.json"

    # Local SQLite database file.
    database_path: Path = APP_ROOT / "data" / "localmed.db"

    # Local LLM runtime endpoint (Ollama HTTP API on localhost). Never remote.
    # The default target model is Gemma 3 1B (or local equivalent).
    # If Gemma 3 1B is not pulled, LocalLLMProvider checks for available local
    # models or clearly reports offline status without fabricating cloud calls.
    ollama_host: str = "http://127.0.0.1:11434"
    ollama_model: str = "gemma3:1b"
    fallback_models: list[str] = ["qwen3-coder-16k:latest", "qwen3-coder:latest"]

    # Downloader behaviour
    download_chunk_size: int = 262144

    model_config = {"env_prefix": "LOCALMED_"}


settings = Settings()


def ensure_runtime_dirs() -> None:
    for path in (settings.data_dir, settings.model_dir, settings.case_dir):
        path.mkdir(parents=True, exist_ok=True)