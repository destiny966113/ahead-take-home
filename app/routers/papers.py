from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_role, UserRole
from app.db.session import get_session
from app.repositories.paper_repo import PaperRepository
from app.repositories.run_repo import RunRepository
from app.services.storage_service import StorageService

from app.repositories.run_repo import RunRepository
from app.repositories.element_repo import ElementRepository
from app.models.models import ElementType as MElementType
from sqlalchemy import select, func

router = APIRouter()


@router.get("/papers/count")
def count_papers(role: UserRole = Depends(get_current_role)):
    with get_session() as db:
        from app.models.models import Paper
        total = db.execute(select(func.count()).select_from(Paper)).scalar() or 0
        return {"count": int(total)}


@router.get("/papers")
def list_papers(limit: int = 20, offset: int = 0, role: UserRole = Depends(get_current_role)):
    with get_session() as db:
        from app.models.models import Paper
        rows = db.execute(select(Paper).order_by(Paper.created_at.desc()).offset(offset).limit(limit)).scalars().all()
        return [
            {
                "id": str(p.id),
                "filename": p.filename,
                "official_run_id": str(p.official_run_id) if p.official_run_id else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in rows
        ]


@router.get("/papers/{paper_id}")
def get_paper_official(paper_id: UUID, role: UserRole = Depends(get_current_role)):
    with get_session() as db:
        paper_repo = PaperRepository(db)
        run_repo = RunRepository(db)
        paper = paper_repo.get(paper_id)
        if not paper:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")
        if not paper.official_run_id:
            # viewer cannot see data unless approved
            if role == UserRole.viewer:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No approved data")
            else:
                return {"paper_id": str(paper.id), "official_run_id": None, "runs": []}
        run = run_repo.get(paper.official_run_id)
        return {
            "paper_id": str(paper.id),
            "filename": paper.filename,
            "official_run_id": str(paper.official_run_id),
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
                for e in run.elements
            ],
        }


@router.get("/papers/{paper_id}/draft")
def get_paper_draft(paper_id: UUID, role: UserRole = Depends(get_current_role)):
    if role == UserRole.viewer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot access drafts")
    with get_session() as db:
        paper_repo = PaperRepository(db)
        run_repo = RunRepository(db)
        paper = paper_repo.get(paper_id)
        if not paper:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")
        run = run_repo.get_latest_draft_for_paper(paper.id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No draft found")
        return {
            "paper_id": str(paper.id),
            "run_id": str(run.id),
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
                for e in run.elements
            ],
        }


@router.get("/papers/{paper_id}/parser")
def get_paper_parser_raw(paper_id: UUID, role: UserRole = Depends(get_current_role)):
    """
    Return stored parse result rendered in exact PARSER OMIP JSON shape.

    - Uses the latest draft run for the paper
    - Converts persisted elements back to PARSER's `tables[]` / `figures[]`
    - Viewer is blocked (same as draft visibility)
    """
    if role == UserRole.viewer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot access drafts")

    with get_session() as db:
        paper_repo = PaperRepository(db)
        run_repo = RunRepository(db)
        el_repo = ElementRepository(db)

        paper = paper_repo.get(paper_id)
        if not paper:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")

        run = run_repo.get_latest_draft_for_paper(paper_id)
        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No draft found")

        # If we have the preserved raw PARSER payload, return it directly
        base = run.raw_metadata or {}
        if isinstance(base, dict) and base.get("parser_raw"):
            return base.get("parser_raw")

        # Otherwise, build PARSER-shaped JSON from stored elements
        omip_id = base.get("omip_id")
        title = base.get("title")
        authors = base.get("authors", [])
        year = base.get("year")

        tables = []
        figures = []
        # run.elements already loaded; rebuild arrays
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


@router.delete("/papers/{paper_id}")
def delete_paper(paper_id: UUID, role: UserRole = Depends(get_current_role)):
    """Delete a paper and all associated data (runs, elements, etc.)."""
    # Only annotators and reviewers can delete papers
    if role == UserRole.viewer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot delete papers")

    with get_session() as db:
        paper_repo = PaperRepository(db)
        paper = paper_repo.get(paper_id)

        if not paper:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")

        success = paper_repo.delete(paper_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete paper")

        db.commit()
        return {"message": "Paper deleted successfully", "paper_id": str(paper_id)}


@router.delete("/papers")
def delete_all_papers(role: UserRole = Depends(get_current_role)):
    """Delete ALL papers and associated runs/elements. Dangerous operation."""
    if role == UserRole.viewer:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Viewer cannot delete papers")

    with get_session() as db:
        from app.models.models import Paper
        paper_repo = PaperRepository(db)
        rows = db.execute(select(Paper)).scalars().all()
        count = 0
        for p in rows:
            ok = paper_repo.delete(p.id)
            if ok:
                count += 1
        db.commit()
        return {"message": "All papers deleted", "deleted": count}
