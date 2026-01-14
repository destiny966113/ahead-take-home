from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID
from app.models.models import ParseRun, ParseStatus


class RunRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, paper_id: UUID, batch_id: UUID | None, raw_metadata: dict | None = None) -> ParseRun:
        from app.models.models import BatchStatus
        run = ParseRun(
            paper_id=paper_id,
            batch_id=batch_id,
            status=ParseStatus.draft,
            task_state=BatchStatus.pending,
            raw_metadata=raw_metadata or {},
        )
        self.db.add(run)
        self.db.flush()
        
        # Create initial metadata version if raw_metadata is provided
        if raw_metadata:
             from app.repositories.metadata_repo import MetadataRepository
             metadata_repo = MetadataRepository(self.db)
             metadata_repo.add_version(
                run_id=run.id,
                omip_id=raw_metadata.get("omip_id"),
                title=raw_metadata.get("title"),
                authors=raw_metadata.get("authors"),
                year=raw_metadata.get("year")
             )
        
        return run

    def get(self, run_id: UUID) -> ParseRun | None:
        return self.db.get(ParseRun, run_id)

    def set_failed(self, run_id: UUID, error: str):
        run = self.get(run_id)
        if run:
            run.status = ParseStatus.failed
            run.error_msg = error
            # mark queue state
            try:
                from app.models.models import BatchStatus

                run.task_state = BatchStatus.failed
            except Exception:
                pass
            self.db.add(run)

    def approve(self, run_id: UUID):
        run = self.get(run_id)
        if run:
            run.status = ParseStatus.approved
            self.db.add(run)

    def reject(self, run_id: UUID):
        run = self.get(run_id)
        if run:
            run.status = ParseStatus.rejected
            self.db.add(run)

    def get_latest_draft_for_paper(self, paper_id: UUID) -> ParseRun | None:
        from sqlalchemy import text
        # Prefer runs that have materialized metadata (processed)
        stmt = (
            select(ParseRun)
            .where(
                ParseRun.paper_id == paper_id,
                ParseRun.status == ParseStatus.draft,
                text("(raw_metadata <> '{}'::jsonb)"),
            )
            .order_by(ParseRun.created_at.desc(), ParseRun.id.desc())
        )
        return self.db.execute(stmt).scalars().first()

    def get_by_batch(self, batch_id: UUID) -> list[ParseRun]:
        """Get all runs for a given batch."""
        stmt = select(ParseRun).where(ParseRun.batch_id == batch_id).order_by(ParseRun.created_at)
        return list(self.db.execute(stmt).scalars().all())
