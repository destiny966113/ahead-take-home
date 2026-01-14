from uuid import UUID
from typing import List, Tuple
from app.services.parse_service import ParseService


class BatchController:
    def __init__(self):
        self.service = ParseService()

    def create_batch(self, uploads: List[Tuple[str, bytes]]) -> UUID:
        return self.service.create_batch_and_schedule(uploads)

