from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID
from app.models.models import ExtractedElement, ElementType
from sqlalchemy import update, text
import json


class ElementRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, run_id: UUID, type_: ElementType, label: str | None, caption: str | None, content: dict, order_index: int) -> ExtractedElement:
        el = ExtractedElement(run_id=run_id, type=type_, label=label, caption=caption, content=content, order_index=order_index)
        self.db.add(el)
        self.db.flush()
        return el

    def get(self, element_id: UUID) -> ExtractedElement | None:
        return self.db.get(ExtractedElement, element_id)

    def update_caption(self, element_id: UUID, caption: str | None):
        el = self.get(element_id)
        if el is None:
            return None
        self.db.execute(
            update(ExtractedElement).where(ExtractedElement.id == element_id).values(caption=caption)
        )
        self.db.flush()
        return self.get(element_id)

    def update_table_cell(self, element_id: UUID, row_index: int, col_index: int, new_value: str):
        el = self.get(element_id)
        if el is None:
            return None
        content = el.content or {}
        rows = content.get("rows", [])
        # ensure the row exists
        while len(rows) <= row_index:
            rows.append([])
        row = rows[row_index]
        # ensure the column exists
        while len(row) <= col_index:
            row.append("")
        row[col_index] = new_value
        content["rows"] = rows
        # Persist via ORM bulk update to ensure DB write
        self.db.query(ExtractedElement).filter(ExtractedElement.id == element_id).update({"content": content}, synchronize_session=False)
        self.db.flush()
        return self.get(element_id)

    def delete_by_run(self, run_id: UUID) -> int:
        """Delete all elements for a run. Returns deleted count."""
        from sqlalchemy import delete
        result = self.db.execute(delete(ExtractedElement).where(ExtractedElement.run_id == run_id))
        self.db.flush()
        return result.rowcount or 0
