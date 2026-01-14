from uuid import UUID
from fastapi import HTTPException, status
from app.db.session import get_session
from app.repositories.element_repo import ElementRepository
from app.repositories.run_repo import RunRepository
from app.models.models import ParseStatus


class ElementService:
    def update_element(self, element_id: UUID, caption: str | None, row_index: int | None, col_index: int | None, new_value: str | None):
        with get_session() as db:
            elem_repo = ElementRepository(db)
            run_repo = RunRepository(db)
            el = elem_repo.get(element_id)
            if not el:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Element not found")
            run = run_repo.get(el.run_id)
            if run.status != ParseStatus.draft:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft elements can be edited")

            if caption is not None:
                el = elem_repo.update_caption(element_id, caption)

            if row_index is not None and col_index is not None and new_value is not None:
                el = elem_repo.update_table_cell(element_id, row_index, col_index, new_value)

            return {
                "element_id": str(el.id),
                "caption": el.caption,
                "content": el.content,
            }

