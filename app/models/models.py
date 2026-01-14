from sqlalchemy import Column, String, Text, Integer, ForeignKey, Enum, TIMESTAMP, text, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base


class UserRole(enum.Enum):
    viewer = "viewer"
    annotator = "annotator"
    reviewer = "reviewer"


class BatchStatus(enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ParseStatus(enum.Enum):
    draft = "draft"
    approved = "approved"
    rejected = "rejected"
    failed = "failed"


class ElementType(enum.Enum):
    table = "table"
    figure = "figure"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    status = Column(Enum(BatchStatus, name="batch_status"))
    total_count = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

    runs = relationship("ParseRun", back_populates="batch")


class Paper(Base):
    __tablename__ = "papers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    file_hash = Column(String(64), unique=True, nullable=False)
    filename = Column(String(255), nullable=False)
    official_run_id = Column(UUID(as_uuid=True), ForeignKey("parse_runs.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

    runs = relationship("ParseRun", back_populates="paper", foreign_keys="ParseRun.paper_id", cascade="all, delete-orphan")


class ParseRun(Base):
    __tablename__ = "parse_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    status = Column(Enum(ParseStatus, name="parse_status"), nullable=False)
    task_state = Column(Enum(BatchStatus, name="batch_status"), nullable=False)
    raw_metadata = Column(JSON, nullable=False)
    error_msg = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    annotated_at = Column(TIMESTAMP(timezone=True))
    reviewed_at = Column(TIMESTAMP(timezone=True))

    paper = relationship("Paper", back_populates="runs", foreign_keys=[paper_id])
    batch = relationship("Batch", back_populates="runs", foreign_keys=[batch_id])
    elements = relationship("ExtractedElement", back_populates="run", cascade="all, delete-orphan")
    metadata_versions = relationship("ParsedMetadata", back_populates="run", cascade="all, delete-orphan", order_by="desc(ParsedMetadata.created_at)")


class ParsedMetadata(Base):
    __tablename__ = "parsed_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    run_id = Column(UUID(as_uuid=True), ForeignKey("parse_runs.id"), nullable=False)
    omip_id = Column(String(50))
    title = Column(Text)
    authors = Column(JSONB)
    year = Column(Integer)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

    run = relationship("ParseRun", back_populates="metadata_versions", foreign_keys=[run_id])


class ExtractedElement(Base):
    __tablename__ = "extracted_elements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    run_id = Column(UUID(as_uuid=True), ForeignKey("parse_runs.id"), nullable=False)
    type = Column(Enum(ElementType, name="element_type"), nullable=False)
    label = Column(String(50))
    caption = Column(Text)
    content = Column(JSONB, nullable=False)
    order_index = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

    run = relationship("ParseRun", back_populates="elements", foreign_keys=[run_id])
