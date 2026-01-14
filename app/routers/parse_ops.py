from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.deps import is_annotator, UserRole
from app.services.parse_service import ParseService
from app.schemas.api import BatchCreateResponse


class ParseRequest(BaseModel):
    paper_ids: List[UUID]


router = APIRouter()


@router.post("/parse", response_model=BatchCreateResponse)
def parse_papers(req: ParseRequest, _role: UserRole = Depends(is_annotator)):
    batch_id = ParseService().create_batch_for_papers(req.paper_ids)
    return BatchCreateResponse(batch_id=batch_id, total_count=len(req.paper_ids))

