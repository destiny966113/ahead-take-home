from uuid import UUID
from app.db.session import get_session
from app.repositories.paper_repo import PaperRepository
from app.repositories.run_repo import RunRepository


class PaperController:
    def get_official(self, paper_id: UUID):
        with get_session() as db:
            paper_repo = PaperRepository(db)
            run_repo = RunRepository(db)
            paper = paper_repo.get(paper_id)
            if not paper or not paper.official_run_id:
                return None
            run = run_repo.get(paper.official_run_id)
            return paper, run

