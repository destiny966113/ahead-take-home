from typing import List
from fastapi import APIRouter, UploadFile, File, Depends
from app.core.deps import is_annotator, UserRole
from app.services.parse_service import ParseService


router = APIRouter()


@router.post("/uploads")
async def upload(files: List[UploadFile] = File(...), _role: UserRole = Depends(is_annotator)):
    uploads: list[tuple[str, bytes]] = []
    for f in files:
        uploads.append((f.filename, await f.read()))
    service = ParseService()
    return {"papers": service.upload_pdfs(uploads)}

