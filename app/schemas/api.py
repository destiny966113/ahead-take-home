from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID


class BatchCreateResponse(BaseModel):
    batch_id: UUID
    total_count: int


class PaperResponse(BaseModel):
    paper_id: UUID
    filename: str
    official_run_id: Optional[UUID]


class ElementPatchRequest(BaseModel):
    caption: Optional[str] = None
    # For table cell update (simplified for POC)
    row_index: Optional[int] = None
    col_index: Optional[int] = None
    new_value: Optional[str] = None


class ApproveResponse(BaseModel):
    run_id: UUID
    status: str

