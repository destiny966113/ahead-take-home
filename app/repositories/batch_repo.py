from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.models.models import Batch, BatchStatus


class BatchRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, total_count: int) -> Batch:
        batch = Batch(status=BatchStatus.processing, total_count=total_count, success_count=0, failed_count=0)
        self.db.add(batch)
        self.db.flush()
        return batch

    def get(self, batch_id: UUID) -> Batch | None:
        return self.db.get(Batch, batch_id)

    def increment_success(self, batch_id: UUID):
        stmt = (
            update(Batch)
            .where(Batch.id == batch_id)
            .values(success_count=Batch.success_count + 1)
        )
        self.db.execute(stmt)

    def increment_failed(self, batch_id: UUID):
        stmt = (
            update(Batch)
            .where(Batch.id == batch_id)
            .values(failed_count=Batch.failed_count + 1)
        )
        self.db.execute(stmt)

    def finalize_if_done(self, batch_id: UUID):
        batch = self.get(batch_id)
        if not batch:
            return
        processed = int(batch.success_count or 0) + int(batch.failed_count or 0)
        if processed >= batch.total_count:
            new_status = BatchStatus.completed if batch.failed_count == 0 else BatchStatus.failed
            batch.status = new_status
            self.db.add(batch)
