"""Model management routes — the Model Management UI contract."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_model_manager
from app.core.model_manager import ModelDownloadManager

router = APIRouter(prefix="/api/models")


@router.get("")
def list_models(manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    return {"models": manager.list_models_with_status()}


@router.post("/{model_id}/download")
def start_download(model_id: str, manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    ok, message = manager.check_storage_before_download(model_id)
    if not ok:
        raise HTTPException(status_code=507, detail=message)
    record = manager.download_model(model_id, start=True)
    return {"model_id": model_id, "status": record.to_dict(), "storage": {"free": _free()}}


@router.post("/{model_id}/pause")
def pause(model_id: str, manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    return {"model_id": model_id, "status": manager.pause_download(model_id).to_dict()}


@router.post("/{model_id}/resume")
def resume(model_id: str, manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    ok, message = manager.check_storage_before_download(model_id)
    if not ok:
        raise HTTPException(status_code=507, detail=message)
    return {"model_id": model_id, "status": manager.resume_download(model_id).to_dict()}


@router.post("/{model_id}/cancel")
def cancel(model_id: str, manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    return {"model_id": model_id, "status": manager.cancel_download(model_id).to_dict()}


@router.post("/{model_id}/verify")
def verify(model_id: str, manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    return {"model_id": model_id, "status": manager.verify_model(model_id).to_dict()}


@router.delete("/{model_id}")
def delete(model_id: str, manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    return {"model_id": model_id, "status": manager.delete_model(model_id).to_dict()}


@router.get("/{model_id}/progress")
def progress(model_id: str, manager: ModelDownloadManager = Depends(get_model_manager)) -> dict:
    return {"model_id": model_id, "status": manager.get_download_progress(model_id)}


def _free() -> int:
    from app.core.storage import storage

    return storage.free_bytes()