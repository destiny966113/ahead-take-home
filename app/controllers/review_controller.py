from uuid import UUID
from app.services.review_service import ReviewService


class ReviewController:
    def __init__(self):
        self.service = ReviewService()

    def approve(self, run_id: UUID):
        return self.service.approve(run_id)

    def reject(self, run_id: UUID):
        return self.service.reject(run_id)

