from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from enum import Enum
from uuid import UUID


class ElementType(str, Enum):
    table = "table"
    figure = "figure"


class TableCell(BaseModel):
    """Represents a single cell in a table."""
    text: Optional[str] = None
    colspan: Optional[int] = None
    rowspan: Optional[int] = None


class TableContent(BaseModel):
    """Table content with rows of cells (PARSER format)."""
    number: Optional[str] = None
    caption: Optional[str] = None
    rows: List[List[TableCell]] = Field(default_factory=list)
    confidence: Optional[float] = None
    is_manually_edited: bool = False


class FigureImage(BaseModel):
    """Figure image metadata."""
    page: Optional[int] = None
    bbox: Optional[List[float]] = None  # [x1, y1, x2, y2]
    path: Optional[str] = None  # Path to extracted image file


class FigureContent(BaseModel):
    """Figure content with image metadata (PARSER format)."""
    number: Optional[str] = None
    caption: Optional[str] = None
    image: Optional[FigureImage] = None
    confidence: Optional[float] = None
    minio_key: Optional[str] = None  # For uploaded/stored images


class ExtractedElement(BaseModel):
    id: Optional[UUID] = None
    type: ElementType
    label: Optional[str] = None
    caption: Optional[str] = None
    order_index: int
    content: Union[TableContent, FigureContent]


class PaperMetadata(BaseModel):
    omip_id: Optional[str] = Field(default=None, pattern=r"^OMIP-\d{3}$")
    title: Optional[str] = None
    authors: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    journal: Optional[str] = "Cytometry Part A"
    confidence_score: float = Field(0.0, ge=0.0, le=1.0)
    parser_raw: Optional[Dict[str, Any]] = None


class MetadataVersion(BaseModel):
    id: UUID
    run_id: UUID
    omip_id: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    year: Optional[int] = None
    created_at: Any
    
    model_config = ConfigDict(from_attributes=True)


class ParsingResultPayload(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    raw_metadata: PaperMetadata
    elements: List[ExtractedElement]
    processing_time_ms: int
    error_msg: Optional[str] = None


class BatchProgressResponse(BaseModel):
    batch_id: UUID
    status: str
    total_count: int
    success_count: int
    failed_count: int
    processing_count: int
