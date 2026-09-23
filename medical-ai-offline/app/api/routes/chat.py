"""Chat routes — text and voice chat against a local case."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import get_chat_service
from app.core.storage import storage
from app.services.chat_service import ChatService

router = APIRouter(prefix="/api/cases/{case_id}/chat")


@router.get("")
def chat_history(case_id: str, service: ChatService = Depends(get_chat_service)) -> dict:
    try:
        messages = service.history(case_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"messages": [m.to_dict() for m in messages]}


@router.post("")
def send_text(case_id: str, payload: dict, service: ChatService = Depends(get_chat_service)) -> dict:
    text = (payload.get("message") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty message")
    try:
        reply = service.send_text(case_id, text)
    except LookupError:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"reply": reply.to_dict()}


@router.post("/voice")
async def send_voice(
    case_id: str,
    audio: UploadFile = File(...),
    service: ChatService = Depends(get_chat_service),
) -> dict:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload")
    import uuid

    tmp = storage.case_dir_for(case_id) / f".tmp_{uuid.uuid4().hex}.wav"
    tmp.write_bytes(audio_bytes)
    try:
        reply = service.send_voice(case_id, str(tmp))
    except LookupError:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"reply": reply.to_dict(), "messages": [m.to_dict() for m in service.history(case_id)]}


@router.get("/audio/{message_id}")
def serve_audio(case_id: str, message_id: str, service: ChatService = Depends(get_chat_service)) -> FileResponse:
    try:
        messages = service.history(case_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Case not found")
    target = next((m for m in messages if m.id == message_id and m.media_path), None)
    if target is None:
        raise HTTPException(status_code=404, detail="No audio for this message")
    from pathlib import Path

    path = Path(target.media_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file missing")
    return FileResponse(path, media_type="audio/wav")