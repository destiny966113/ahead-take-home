from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.deps import is_staff, UserRole
from app.db.session import get_session
from app.repositories.run_repo import RunRepository
from sqlalchemy import select
from app.models.models import ParseRun, Paper
from app.repositories.element_repo import ElementRepository
from app.models.models import ElementType as MElementType, ParseStatus
from sqlalchemy import func


router = APIRouter()


@router.get("/runs/count")
def count_runs(status: str | None = None, task_state: str | None = None, _role: UserRole = Depends(is_staff)):
    with get_session() as db:
        stmt = select(func.count()).select_from(ParseRun)
        if status:
            try:
                ps = ParseStatus(status)
                stmt = stmt.where(ParseRun.status == ps)
            except Exception:
                pass
        if task_state:
            from app.models.models import BatchStatus
            try:
                ts = BatchStatus(task_state)
                stmt = stmt.where(ParseRun.task_state == ts)
            except Exception:
                pass
        total = db.execute(stmt).scalar() or 0
        return {"count": int(total)}


@router.get("/runs")
def list_runs(
    status: str | None = None,
    task_state: str | None = None,
    limit: int = 10,
    offset: int = 0,
    _role: UserRole = Depends(is_staff),
):
    with get_session() as db:
        stmt = select(ParseRun, Paper.filename).join(Paper, Paper.id == ParseRun.paper_id)
        if status:
            from app.models.models import ParseStatus
            try:
                ps = ParseStatus(status)
                stmt = stmt.where(ParseRun.status == ps)
            except Exception:
                pass
        if task_state:
            from app.models.models import BatchStatus
            try:
                ts = BatchStatus(task_state)
                stmt = stmt.where(ParseRun.task_state == ts)
            except Exception:
                pass
        stmt = stmt.order_by(ParseRun.created_at.desc()).offset(offset).limit(limit)
        rows = db.execute(stmt).all()
        out = []
        for (run, filename) in rows:
            out.append({
                "run_id": str(run.id),
                "paper_id": str(run.paper_id),
                "batch_id": str(run.batch_id) if run.batch_id else None,
                "parse_status": run.status.value,
                "task_state": run.task_state.value if run.task_state else None,
                "error_msg": run.error_msg,
                "filename": filename,
                "created_at": run.created_at.isoformat() if run.created_at else None,
            })
        return out


@router.get("/runs/{run_id}")
def get_run(run_id: UUID, _role: UserRole = Depends(is_staff)):
    """Get detailed parse run information including paper data and parsed results."""
    with get_session() as db:
        repo = RunRepository(db)
        run = repo.get(run_id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
        
        # Get paper information
        paper = run.paper
        
        return {
            "run": {
                "id": str(run.id),
                "paper_id": str(run.paper_id),
                "batch_id": str(run.batch_id) if run.batch_id else None,
                "status": run.status.value,
                "task_state": run.task_state.value if run.task_state else None,
                "error_msg": run.error_msg,
                "created_at": run.created_at.isoformat() if run.created_at else None,
                "result": {
                    "omip_id": run.raw_metadata.get("omip_id") if run.raw_metadata else None,
                    "title": run.raw_metadata.get("title") if run.raw_metadata else None,
                    "authors": run.raw_metadata.get("authors", []) if run.raw_metadata else [],
                    "year": run.raw_metadata.get("year") if run.raw_metadata else None,
                    "tables": len([e for e in run.elements if e.type.value == "table"]),
                    "figures": len([e for e in run.elements if e.type.value == "figure"]),
                }
            },
            "paper": {
                "id": str(paper.id),
                "filename": paper.filename,
                "file_hash": paper.file_hash,
                "source_pdf": paper.filename,
                "created_at": paper.created_at.isoformat() if paper.created_at else None,
            },
            "metadata": run.raw_metadata,
            "elements": [
                {
                    "id": str(e.id),
                    "type": e.type.value,
                    "label": e.label,
                    "caption": e.caption,
                    "content": e.content,
                    "order_index": e.order_index,
                }
                for e in sorted(run.elements, key=lambda x: x.order_index)
            ],
        }


@router.put("/runs/{run_id}/metadata")
def update_run_metadata(run_id: UUID, metadata: dict, _role: UserRole = Depends(is_staff)):
    """Update parse run metadata."""
    with get_session() as db:
        repo = RunRepository(db)
        run = repo.get(run_id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
        
        # Update raw_metadata
        run.raw_metadata = metadata
        db.add(run)
        db.flush() # ensure run update is staged

        # Save new version
        from app.repositories.metadata_repo import MetadataRepository
        meta_repo = MetadataRepository(db)
        meta_repo.add_version(
            run_id=run.id,
            omip_id=metadata.get("omip_id"),
            title=metadata.get("title"),
            authors=metadata.get("authors"),
            year=metadata.get("year")
        )

        db.commit()
        
        return {
            "success": True,
            "run_id": str(run.id),
            "metadata": run.raw_metadata
        }


@router.put("/runs/{run_id}/parser")
def update_run_from_parser_json(run_id: UUID, payload: dict, _role: UserRole = Depends(is_staff)):
    """
    Overwrite a draft run using a PARSER OMIP JSON payload.

    Expected payload shape:
    {
      omip_id, title, authors, year,
      tables: [{ number, caption, rows, confidence? }],
      figures: [{ number, caption, image?, confidence? }]
    }
    """
    with get_session() as db:
        run_repo = RunRepository(db)
        el_repo = ElementRepository(db)
        run = run_repo.get(run_id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
        if run.status != ParseStatus.draft:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft runs can be edited")

        # Update raw_metadata to include at least top-level fields; store full payload is fine
        # to preserve original PARSER semantics for future retrieval
        run.raw_metadata = {
            "omip_id": payload.get("omip_id"),
            "title": payload.get("title"),
            "authors": payload.get("authors", []),
            "year": payload.get("year"),
            # keep any other fields if present
            **{k: v for k, v in payload.items() if k not in {"tables", "figures"}},
            # persist full PARSER payload for exact rendering
            "parser_raw": payload,
        }

        # Replace elements from tables + figures
        el_repo.delete_by_run(run.id)

        order_index = 0
        for t in payload.get("tables", []) or []:
            content = {
                "number": t.get("number"),
                "caption": t.get("caption"),
                "rows": t.get("rows", []),
                "confidence": t.get("confidence"),
                "is_manually_edited": True,
            }
            el_repo.create(
                run_id=run.id,
                type_=MElementType.table,
                label=f"Table {t.get('number') or order_index + 1}",
                caption=t.get("caption"),
                content=content,
                order_index=order_index,
            )
            order_index += 1

        for f in payload.get("figures", []) or []:
            content = {
                "number": f.get("number"),
                "caption": f.get("caption"),
                "image": f.get("image"),
                "confidence": f.get("confidence"),
            }
            el_repo.create(
                run_id=run.id,
                type_=MElementType.figure,
                label=f"Figure {f.get('number') or order_index + 1}",
                caption=f.get("caption"),
                content=content,
                order_index=order_index,
            )
            order_index += 1

        db.add(run)
        db.flush()

        # Save new version
        from app.repositories.metadata_repo import MetadataRepository
        meta_repo = MetadataRepository(db)
        meta_repo.add_version(
            run_id=run.id,
            omip_id=payload.get("omip_id"),
            title=payload.get("title"),
            authors=payload.get("authors"),
            year=payload.get("year")
        )

        db.commit()

        return {"success": True, "run_id": str(run.id)}


@router.get("/runs/{run_id}/parser")
def get_run_parser_raw(run_id: UUID, _role: UserRole = Depends(is_staff)):
    """
    Return stored parse result for a specific run in exact PARSER OMIP JSON shape.

    - Uses the specified run (no draft/official inference)
    - If preserved raw payload exists (raw_metadata.parser_raw), return it directly
    - Otherwise, rebuild from persisted elements
    """
    with get_session() as db:
        run_repo = RunRepository(db)
        run = run_repo.get(run_id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

        base = run.raw_metadata or {}
        if isinstance(base, dict) and base.get("parser_raw"):
            return base.get("parser_raw")

        omip_id = base.get("omip_id")
        title = base.get("title")
        authors = base.get("authors", [])
        year = base.get("year")

        tables = []
        figures = []
        for e in sorted(run.elements, key=lambda x: x.order_index):
            if e.type == MElementType.table:
                c = e.content or {}
                tables.append({
                    "number": c.get("number"),
                    "caption": c.get("caption") or e.caption,
                    "rows": c.get("rows", []),
                    "confidence": c.get("confidence"),
                })
            elif e.type == MElementType.figure:
                c = e.content or {}
                figures.append({
                    "number": c.get("number"),
                    "caption": c.get("caption") or e.caption,
                    "image": c.get("image"),
                    "confidence": c.get("confidence"),
                })

        return {
            "omip_id": omip_id,
            "title": title,
            "authors": authors,
            "year": year,
            "tables": tables,
            "figures": figures,
        }


@router.get("/runs/{run_id}/versions")
def list_run_versions(run_id: UUID, _role: UserRole = Depends(is_staff)):
    """List all historical metadata versions for a run."""
    with get_session() as db:
        from app.repositories.metadata_repo import MetadataRepository
        repo = MetadataRepository(db)
        versions = repo.get_all_versions(run_id)
        return [
            {
                "id": str(v.id),
                "run_id": str(v.run_id),
                "omip_id": v.omip_id,
                "title": v.title,
                "authors": v.authors,
                "year": v.year,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in versions
        ]


@router.get("/runs/{run_id}/versions/{version_id}")
def get_run_version_content(run_id: UUID, version_id: UUID, _role: UserRole = Depends(is_staff)):
    """
    Get the full PARSER JSON content for a specific historical version.
    Current elements are combined with the historical metadata.
    """
    with get_session() as db:
        run_repo = RunRepository(db)
        run = run_repo.get(run_id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

        # Get the specific version
        from app.models.models import ParsedMetadata
        version = db.get(ParsedMetadata, version_id)
        if not version or version.run_id != run_id:
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

        # Reconstruct PARSER JSON using historical metadata + CURRENT elements
        # (Assuming elements are not versioned yet as per current schema)
        
        tables = []
        figures = []
        for e in sorted(run.elements, key=lambda x: x.order_index):
            if e.type == MElementType.table:
                c = e.content or {}
                tables.append({
                    "number": c.get("number"),
                    "caption": c.get("caption") or e.caption,
                    "rows": c.get("rows", []),
                    "confidence": c.get("confidence"),
                })
            elif e.type == MElementType.figure:
                c = e.content or {}
                figures.append({
                    "number": c.get("number"),
                    "caption": c.get("caption") or e.caption,
                    "image": c.get("image"),
                    "confidence": c.get("confidence"),
                })

        return {
            "omip_id": version.omip_id,
            "title": version.title,
            "authors": version.authors or [],
            "year": version.year,
            "tables": tables,
            "figures": figures,
            "version_info": {
                "id": str(version.id),
                "created_at": version.created_at.isoformat() if version.created_at else None
            }
        }


@router.post("/runs/{run_id}/retry")
def retry_run(run_id: UUID, _role: UserRole = Depends(is_staff)):
    """Retry a failed run by resetting status and re-queuing the task."""
    from app.services.storage_service import StorageService
    from app.workers.tasks import parse_pdf_task
    from app.models.models import BatchStatus

    with get_session() as db:
        run_repo = RunRepository(db)
        run = run_repo.get(run_id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

        # Reset run state
        run.task_state = BatchStatus.pending
        run.error_msg = None
        db.add(run)
        db.commit() # Commit to ensure worker sees correct state

        # Dispatch task
        try:
            storage = StorageService()
            paper = run.paper
            key = storage.object_key_for_pdf(paper.filename, paper.file_hash)

            parse_pdf_task.delay(
                str(run.batch_id) if run.batch_id else None,
                str(run.id),
                paper.filename,
                key
            )
        except Exception as e:
            # If dispatch fails, revert status (best effort)
            run.task_state = BatchStatus.failed
            run.error_msg = f"Failed to dispatch retry: {str(e)}"
            db.add(run)
            db.commit()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

        return {"success": True, "message": "Run queued for retry"}


@router.post("/runs/retry-failed")
def retry_all_failed(_role: UserRole = Depends(is_staff)):
    """Retry all failed runs by resetting their status and re-queuing tasks."""
    from app.services.storage_service import StorageService
    from app.workers.tasks import parse_pdf_task
    from app.models.models import BatchStatus

    with get_session() as db:
        # Find all failed runs
        stmt = select(ParseRun).where(ParseRun.task_state == BatchStatus.failed)
        failed_runs = db.execute(stmt).scalars().all()

        if not failed_runs:
            return {"success": True, "retried_count": 0}

        retried_count = 0
        storage = StorageService()

        for run in failed_runs:
            try:
                # Reset run state
                run.task_state = BatchStatus.pending
                run.error_msg = None
                db.add(run)
                db.flush()  # Flush to ensure state is updated

                # Dispatch task
                paper = run.paper
                key = storage.object_key_for_pdf(paper.filename, paper.file_hash)

                parse_pdf_task.delay(
                    str(run.batch_id) if run.batch_id else None,
                    str(run.id),
                    paper.filename,
                    key
                )
                retried_count += 1
            except Exception as e:
                # If dispatch fails for this run, revert its status but continue with others
                run.task_state = BatchStatus.failed
                run.error_msg = f"Failed to dispatch retry: {str(e)}"
                db.add(run)

        db.commit()

        return {"success": True, "retried_count": retried_count}
