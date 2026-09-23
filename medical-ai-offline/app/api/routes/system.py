"""System / health / model-status routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.ai.engine import LocalAIEngine
from app.api.deps import get_ai_engine, get_model_manager
from app.core.model_manager import ModelDownloadManager
from app.core.storage import storage

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    """Surfaces app version + offline posture. Never reports medical data."""
    return {
        "service": "localmed",
        "offline_only": True,
        "model_registry_loaded": True,
        "free_storage_bytes": storage.free_bytes(),
    }


@router.get("/llm/status")
def llm_status(engine: LocalAIEngine = Depends(get_ai_engine)) -> dict:
    """Live status of the local LLM layer: Ollama connectivity + model tag.

    This is the single source of truth for the UI's Model Status panel. It is
    never faked: in mock/test mode it reports provider="mock" explicitly.
    """
    return engine.llm_status()


@router.get("/models/required")
def required_models(manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    required = manager.get_required_models()
    return {
        "required": [m.to_dict() for m in required],
        "total_bytes": sum(m.total_size_bytes for m in required),
        "free_storage_bytes": storage.free_bytes(),
    }


@router.get("/models")
def list_models(manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    return {"models": manager.list_models_with_status()}