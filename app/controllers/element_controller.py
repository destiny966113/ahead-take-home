from uuid import UUID
from app.services.element_service import ElementService


class ElementController:
    def __init__(self):
        self.service = ElementService()

    def patch_element(self, element_id: UUID, caption: str | None, row_index: int | None, col_index: int | None, new_value: str | None):
        return self.service.update_element(element_id, caption, row_index, col_index, new_value)

