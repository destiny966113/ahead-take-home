from uuid import UUID
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from typing import List

from app.core.deps import is_annotator, UserRole
from app.controllers.batch_controller import BatchController
from app.services.parse_service import ParseService
from app.db.session import get_session
from app.repositories.batch_repo import BatchRepository
from app.repositories.paper_repo import PaperRepository
from app.repositories.run_repo import RunRepository
from app.repositories.element_repo import ElementRepository
from app.schemas.parse import PaperMetadata, ExtractedElement, ElementType as SElementType, TableContent, ParsingResultPayload
from app.models.models import ParseStatus, ElementType as MElementType
from app.db.session import get_session
from app.repositories.batch_repo import BatchRepository
from app.schemas.api import BatchCreateResponse
from app.schemas.parse import BatchProgressResponse


router = APIRouter()


@router.post("/batches/parse", response_model=BatchCreateResponse)
async def create_batch(files: List[UploadFile] = File(...), _role: UserRole = Depends(is_annotator)):
    import time
    import logging
    logger = logging.getLogger(__name__)

    start_time = time.time()
    logger.info(f"[PERF] Starting batch upload with {len(files)} files")

    uploads: list[tuple[str, bytes]] = []
    read_start = time.time()
    for f in files:
        uploads.append((f.filename, await f.read()))
    read_time = time.time() - read_start
    logger.info(f"[PERF] File read took {read_time:.2f}s")

    # Use service to enqueue Celery tasks
    service_start = time.time()
    service = ParseService()
    batch_id = service.create_batch_and_schedule(uploads)
    service_time = time.time() - service_start
    logger.info(f"[PERF] Service processing took {service_time:.2f}s")

    total_time = time.time() - start_time
    logger.info(f"[PERF] Total request took {total_time:.2f}s")

    return BatchCreateResponse(batch_id=batch_id, total_count=len(uploads))


@router.get("/batches/{batch_id}/runs")
def list_batch_runs(batch_id: UUID, _role: UserRole = Depends(is_annotator)):
    with get_session() as db:
        from sqlalchemy import select
        from app.models.models import ParseRun, Paper
        rows = db.execute(
            select(ParseRun.id, ParseRun.paper_id, ParseRun.status, ParseRun.task_state, ParseRun.error_msg, Paper.filename)
            .join(Paper, Paper.id == ParseRun.paper_id)
            .where(ParseRun.batch_id == batch_id)
        ).all()
        return [
            {
                "run_id": str(r[0]),
                "paper_id": str(r[1]),
                "parse_status": r[2].value if hasattr(r[2], "value") else str(r[2]),
                "task_state": r[3].value if hasattr(r[3], "value") else str(r[3]),
                "error_msg": r[4],
                "filename": r[5],
            }
            for r in rows
        ]


@router.get("/batches/{batch_id}", response_model=BatchProgressResponse)
def get_batch(batch_id: UUID, _role: UserRole = Depends(is_annotator)):
    with get_session() as db:
        repo = BatchRepository(db)
        batch = repo.get(batch_id)
        if not batch:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
        processing = batch.total_count - (batch.success_count + batch.failed_count)
        return BatchProgressResponse(
            batch_id=batch.id,
            status=batch.status.value,
            total_count=batch.total_count,
            success_count=batch.success_count,
            failed_count=batch.failed_count,
            processing_count=processing,
        )


@router.get("/batches")
def list_batches(_role: UserRole = Depends(is_annotator)):
    with get_session() as db:
        from sqlalchemy import select
        from app.models.models import Batch
        rows = db.execute(select(Batch).order_by(Batch.created_at.desc()).limit(50)).scalars().all()
        return [
            {
                "id": str(b.id),
                "status": b.status.value if hasattr(b.status, "value") else str(b.status),
                "total_count": b.total_count,
                "success_count": b.success_count,
                "failed_count": b.failed_count,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in rows
        ]
