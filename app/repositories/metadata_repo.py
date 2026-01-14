from sqlalchemy.orm import Session
from sqlalchemy import select
from uuid import UUID
from app.models.models import ParsedMetadata

class MetadataRepository:
    def __init__(self, db: Session):
        self.db = db

    def add_version(self, run_id: UUID, omip_id: str = None, title: str = None, authors: list = None, year: int = None) -> ParsedMetadata:
        metadata = ParsedMetadata(
            run_id=run_id,
            omip_id=omip_id,
            title=title,
            authors=authors,
            year=year
        )
        self.db.add(metadata)
        self.db.flush()
        return metadata

    def get_latest(self, run_id: UUID) -> ParsedMetadata | None:
        stmt = (
            select(ParsedMetadata)
            .where(ParsedMetadata.run_id == run_id)
            .order_by(ParsedMetadata.created_at.desc())
        )
        return self.db.execute(stmt).scalars().first()

    def get_all_versions(self, run_id: UUID) -> list[ParsedMetadata]:
        stmt = (
            select(ParsedMetadata)
            .where(ParsedMetadata.run_id == run_id)
            .order_by(ParsedMetadata.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())
