"""Case routes — case creation, listing, medicine verification, image serving."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import get_case_service
from app.services.case_service import CaseService

router = APIRouter(prefix="/api/cases")


@router.post("", status_code=201)
async def create_case(
    image: UploadFile = File(...),
    name: str = Form(default=""),
    document_type: str = Form(default="prescription"),
    service: CaseService = Depends(get_case_service),
) -> dict:
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload.")
    case = service.create_from_image(image_bytes, name, image.filename, document_type=document_type)
    return {"case": case.to_dict()}


@router.get("")
def list_cases(service: CaseService = Depends(get_case_service)) -> dict:
    return {"cases": [c.to_dict() for c in service.list_cases()]}


@router.get("/search")
def search_cases(q: str, service: CaseService = Depends(get_case_service)) -> dict:
    return {"cases": [c.to_dict() for c in service.search(q)]}


@router.get("/{case_id}")
def get_case(case_id: str, service: CaseService = Depends(get_case_service)) -> dict:
    case = service.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case": case.to_dict()}


@router.patch("/{case_id}")
def update_case(case_id: str, payload: dict, service: CaseService = Depends(get_case_service)) -> dict:
    try:
        if "name" in payload:
            case = service.set_name(case_id, payload["name"])
        if "notes" in payload:
            case = service.set_notes(case_id, payload["notes"])
        case = service.get(case_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case": case.to_dict()}


@router.delete("/{case_id}")
def delete_case(case_id: str, service: CaseService = Depends(get_case_service)) -> dict:
    if not service.delete(case_id):
        raise HTTPException(status_code=404, detail="Case not found")
    return {"deleted": case_id}


@router.post("/{case_id}/verify")
def verify_medicines(case_id: str, payload: dict, service: CaseService = Depends(get_case_service)) -> dict:
    try:
        case = service.verify_medicines(case_id, payload.get("verified", []))
    except LookupError:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case": case.to_dict()}


@router.post("/{case_id}/verify-reports")
def verify_reports(case_id: str, payload: dict, service: CaseService = Depends(get_case_service)) -> dict:
    try:
        case = service.verify_reports(case_id, payload.get("verified", []))
    except LookupError:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case": case.to_dict()}


@router.post("/{case_id}/update-medicines")
def update_medicines(case_id: str, payload: dict, service: CaseService = Depends(get_case_service)) -> dict:
    from app.domain.entities import Medicine

    try:
        medicines = [Medicine.from_dict(m) for m in payload.get("medicines", [])]
        case = service.update_medicines(case_id, medicines)
    except LookupError:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case": case.to_dict()}


@router.get("/{case_id}/image")
def case_image(case_id: str, service: CaseService = Depends(get_case_service)) -> FileResponse:
    path = service.image_path(case_id)
    if path is None:
        raise HTTPException(status_code=404, detail="No image stored for this case")
    return FileResponse(path, media_type="image/jpeg")