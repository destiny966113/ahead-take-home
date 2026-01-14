from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID
from app.models.models import Paper


class PaperRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_hash(self, file_hash: str) -> Paper | None:
        stmt = select(Paper).where(Paper.file_hash == file_hash)
        return self.db.execute(stmt).scalars().first()

    def create(self, filename: str, file_hash: str) -> Paper:
        paper = Paper(filename=filename, file_hash=file_hash)
        self.db.add(paper)
        self.db.flush()
        return paper

    def set_official_version(self, paper_id: UUID, run_id: UUID):
        paper = self.db.get(Paper, paper_id)
        paper.official_run_id = run_id
        self.db.add(paper)

    def get(self, paper_id: UUID) -> Paper | None:
        return self.db.get(Paper, paper_id)

    def delete(self, paper_id: UUID) -> bool:
        """Delete a paper and all associated runs and elements."""
        paper = self.db.get(Paper, paper_id)
        if not paper:
            return False
        self.db.delete(paper)
        self.db.flush()
        return True

