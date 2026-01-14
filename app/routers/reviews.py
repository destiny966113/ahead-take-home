from uuid import UUID
from fastapi import APIRouter, Depends
from app.core.deps import is_reviewer, UserRole
from app.controllers.review_controller import ReviewController
from app.schemas.api import ApproveResponse


router = APIRouter()


@router.post("/reviews/{run_id}/approve", response_model=ApproveResponse)
def approve(run_id: UUID, _role: UserRole = Depends(is_reviewer)):
    controller = ReviewController()
    result = controller.approve(run_id)
    return result


@router.post("/reviews/{run_id}/reject", response_model=ApproveResponse)
def reject(run_id: UUID, _role: UserRole = Depends(is_reviewer)):
    controller = ReviewController()
    result = controller.reject(run_id)
    return result
