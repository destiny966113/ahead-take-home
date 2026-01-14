from uuid import UUID
from fastapi import APIRouter, Depends
from app.core.deps import is_annotator, UserRole
from app.schemas.api import ElementPatchRequest
from app.controllers.element_controller import ElementController


router = APIRouter()


@router.patch("/tables/{element_id}")
def patch_table(element_id: UUID, payload: ElementPatchRequest, _role: UserRole = Depends(is_annotator)):
    controller = ElementController()
    return controller.patch_element(
        element_id,
        caption=payload.caption,
        row_index=payload.row_index,
        col_index=payload.col_index,
        new_value=payload.new_value,
    )


@router.patch("/figures/{element_id}")
def patch_figure(element_id: UUID, payload: ElementPatchRequest, _role: UserRole = Depends(is_annotator)):
    controller = ElementController()
    # For figures we only support caption edits in v1
    return controller.patch_element(
        element_id, caption=payload.caption, row_index=None, col_index=None, new_value=None
    )
