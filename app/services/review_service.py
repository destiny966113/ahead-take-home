from uuid import UUID
from fastapi import HTTPException, status
from app.db.session import get_session
from app.repositories.run_repo import RunRepository
from app.repositories.paper_repo import PaperRepository
from app.models.models import ParseStatus


class ReviewService:
    def approve(self, run_id: UUID):
        with get_session() as db:
            run_repo = RunRepository(db)
            paper_repo = PaperRepository(db)
            run = run_repo.get(run_id)
            if not run:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
            if run.status != ParseStatus.draft:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft can be approved")
            run_repo.approve(run_id)
            paper_repo.set_official_version(run.paper_id, run_id)
            return {"run_id": str(run_id), "status": "approved"}

    def reject(self, run_id: UUID):
        with get_session() as db:
            run_repo = RunRepository(db)
            run = run_repo.get(run_id)
            if not run:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
            if run.status != ParseStatus.draft:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft can be rejected")
            run_repo.reject(run_id)
            return {"run_id": str(run_id), "status": "rejected"}

