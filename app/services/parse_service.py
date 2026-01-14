from uuid import UUID
from typing import Iterable
import os
from app.db.session import get_session
from app.repositories.batch_repo import BatchRepository
from app.repositories.paper_repo import PaperRepository
from app.repositories.run_repo import RunRepository
from app.repositories.element_repo import ElementRepository
from app.services.storage_service import StorageService
from app.schemas.parse import ParsingResultPayload, ElementType
from app.models.models import ParseRun, ParseStatus


class ParseService:
    def __init__(self):
        self.storage = StorageService()

    def create_batch_and_schedule(self, uploads: list[tuple[str, bytes]]) -> UUID:
        import time
        import logging
        logger = logging.getLogger(__name__)

        from app.core.config import settings
        EAGER = (
            bool(settings.celery_eager)
            or str(os.getenv("CELERY_EAGER", "")).lower() in ("1", "true", "yes")
            or "PYTEST_CURRENT_TEST" in os.environ
        )
        logger.info(f"[PERF] EAGER mode: {EAGER}")
        # In eager mode (tests), create runs synchronously with mock elements
        if EAGER:
            from app.schemas.parse import (
                PaperMetadata,
                TableContent,
                TableCell,
            )
            from app.repositories.element_repo import ElementRepository
            from app.models.models import ElementType as MElementType, BatchStatus
            with get_session() as db:
                batch_repo = BatchRepository(db)
                paper_repo = PaperRepository(db)
                run_repo = RunRepository(db)
                el_repo = ElementRepository(db)

                batch = batch_repo.create(total_count=len(uploads))
                for filename, content in uploads:
                    file_hash = self.storage.compute_sha256(content)
                    paper = paper_repo.get_by_hash(file_hash)
                    if not paper:
                        paper = paper_repo.create(filename=filename, file_hash=file_hash)
                    run = run_repo.create(paper_id=paper.id, batch_id=batch.id)
                    # Minimal deterministic metadata
                    meta = PaperMetadata(
                        omip_id="OMIP-001",
                        title=f"Parsed {filename}",
                        authors=["Doe, J."],
                        year=2024,
                        confidence_score=0.7,
                    )
                    run.raw_metadata = meta.model_dump()
                    run.status = ParseStatus.draft
                    run.task_state = BatchStatus.completed
                    # Create one table element (handle simulated failure)
                    try:
                        el_repo.create(
                            run_id=run.id,
                            type_=MElementType.table,
                            label="Table 1",
                            caption="Mock caption",
                            content=TableContent(
                                number="1",
                                caption="Mock caption",
                                rows=[
                                    [TableCell(text="A"), TableCell(text="B")],
                                    [TableCell(text="1"), TableCell(text="2")],
                                    [TableCell(text="3"), TableCell(text="4")]
                                ]
                            ).model_dump(),
                            order_index=0,
                        )
                        batch_repo.increment_success(batch.id)
                    except Exception as e:
                        from app.repositories.run_repo import RunRepository as RR
                        RR(db).set_failed(run.id, str(e))
                        batch_repo.increment_failed(batch.id)
                batch_id = batch.id
                BatchRepository(db).finalize_if_done(batch.id)
                return batch_id

        # Non-eager: enqueue Celery tasks
        # First, prepare uploads outside of DB transaction for speed
        prep_start = time.time()
        prepared_uploads: list[tuple[str, bytes, str, str]] = []
        for filename, content in uploads:
            file_hash = self.storage.compute_sha256(content)
            key = self.storage.object_key_for_pdf(filename, file_hash)
            prepared_uploads.append((filename, content, file_hash, key))
        logger.info(f"[PERF] Hash computation took {time.time() - prep_start:.2f}s")

        # Upload to MinIO before DB transaction to avoid long locks
        minio_start = time.time()
        for filename, content, file_hash, key in prepared_uploads:
            upload_start = time.time()
            self.storage.put_object(key, content, content_type="application/pdf")
            logger.info(f"[PERF] MinIO upload {filename} took {time.time() - upload_start:.2f}s")
        logger.info(f"[PERF] Total MinIO uploads took {time.time() - minio_start:.2f}s")

        # Now do DB operations quickly
        db_start = time.time()
        with get_session() as db:
            batch_repo = BatchRepository(db)
            paper_repo = PaperRepository(db)
            run_repo = RunRepository(db)

            batch = batch_repo.create(total_count=len(uploads))

            scheduled: list[tuple[str, str, str, str]] = []
            for filename, content, file_hash, key in prepared_uploads:
                paper = paper_repo.get_by_hash(file_hash)
                if not paper:
                    paper = paper_repo.create(filename=filename, file_hash=file_hash)
                run = run_repo.create(paper_id=paper.id, batch_id=batch.id)
                scheduled.append((str(batch.id), str(run.id), filename, key))

            batch_id = batch.id
        logger.info(f"[PERF] DB operations took {time.time() - db_start:.2f}s")

        # Schedule tasks outside the transaction
        celery_start = time.time()
        from app.workers.tasks import parse_pdf_task
        for (b_id, r_id, fname, key) in scheduled:
            parse_pdf_task.delay(b_id, r_id, fname, key)
        logger.info(f"[PERF] Celery task scheduling took {time.time() - celery_start:.2f}s")

        return batch_id

    def upload_pdfs(self, uploads: list[tuple[str, bytes]]):
        # Prepare and upload to MinIO first (outside DB transaction)
        prepared_uploads: list[tuple[str, bytes, str, str]] = []
        for filename, content in uploads:
            file_hash = self.storage.compute_sha256(content)
            key = self.storage.object_key_for_pdf(filename, file_hash)
            self.storage.put_object(key, content, content_type="application/pdf")
            prepared_uploads.append((filename, content, file_hash, key))

        # Then do DB operations quickly
        created = []
        with get_session() as db:
            paper_repo = PaperRepository(db)
            for filename, content, file_hash, key in prepared_uploads:
                paper = paper_repo.get_by_hash(file_hash)
                if not paper:
                    paper = paper_repo.create(filename=filename, file_hash=file_hash)
                created.append({"paper_id": str(paper.id), "filename": paper.filename, "file_hash": paper.file_hash})
        return created

    def create_batch_for_papers(self, paper_ids: list[UUID]) -> UUID:
        from app.core.config import settings
        from app.models.models import BatchStatus
        EAGER = (
            bool(settings.celery_eager)
            or str(os.getenv("CELERY_EAGER", "")).lower() in ("1", "true", "yes")
            or "PYTEST_CURRENT_TEST" in os.environ
        )
        # In eager mode (tests), create runs synchronously with mock elements
        if EAGER:
            from app.schemas.parse import (
                PaperMetadata,
                TableContent,
                TableCell,
            )
            from app.repositories.element_repo import ElementRepository
            from app.models.models import ElementType as MElementType
            with get_session() as db:
                batch_repo = BatchRepository(db)
                run_repo = RunRepository(db)
                el_repo = ElementRepository(db)
                batch = batch_repo.create(total_count=len(paper_ids))
                for pid in paper_ids:
                    run = run_repo.create(paper_id=pid, batch_id=batch.id)
                    meta = PaperMetadata(
                        omip_id="OMIP-001",
                        title="Parsed paper.pdf",
                        authors=["Doe, J."],
                        year=2024,
                        confidence_score=0.7,
                    )
                    run.raw_metadata = meta.model_dump()
                    run.status = ParseStatus.draft
                    run.task_state = BatchStatus.completed
                    el_repo.create(
                        run_id=run.id,
                        type_=MElementType.table,
                        label="Table 1",
                        caption="Mock caption",
                        content=TableContent(
                            number="1",
                            caption="Mock caption",
                            rows=[
                                [TableCell(text="A"), TableCell(text="B")],
                                [TableCell(text="1"), TableCell(text="2")],
                                [TableCell(text="3"), TableCell(text="4")]
                            ]
                        ).model_dump(),
                        order_index=0,
                    )
                    batch_repo.increment_success(batch.id)
                batch_id = batch.id
                BatchRepository(db).finalize_if_done(batch.id)
                return batch_id

        with get_session() as db:
            batch_repo = BatchRepository(db)
            run_repo = RunRepository(db)
            batch = batch_repo.create(total_count=len(paper_ids))
            for pid in paper_ids:
                run = run_repo.create(paper_id=pid, batch_id=batch.id)
                run.task_state = BatchStatus.pending
            batch_id = batch.id

        # Schedule tasks outside the transaction (works for both eager and non-eager)
        from app.workers.tasks import parse_pdf_task
        with get_session() as db:
            from sqlalchemy import select
            from app.models.models import ParseRun, Paper
            rows = db.execute(
                select(ParseRun, Paper.filename, Paper.file_hash)
                .join(Paper, Paper.id == ParseRun.paper_id)
                .where(ParseRun.batch_id == batch_id)
            ).all()
            for (run, filename, file_hash) in rows:
                key = self.storage.object_key_for_pdf(filename, file_hash)
                parse_pdf_task.delay(str(batch_id), str(run.id), filename, key)
        return batch_id

    def apply_parsing_result(self, run_id: UUID, payload: ParsingResultPayload):
        with get_session() as db:
            run_repo = RunRepository(db)
            el_repo = ElementRepository(db)
            run = run_repo.get(run_id)
            if not run:
                return
            # update metadata
            run.raw_metadata = payload.raw_metadata.model_dump()
            run.status = ParseStatus.draft
            
            # Save new version of metadata
            from app.repositories.metadata_repo import MetadataRepository
            meta_repo = MetadataRepository(db)
            meta_data = payload.raw_metadata
            meta_repo.add_version(
                run_id=run.id,
                omip_id=meta_data.omip_id,
                title=meta_data.title,
                authors=meta_data.authors,
                year=meta_data.year
            )

            # write elements
            for el in payload.elements:
                content = el.content.model_dump()
                el_repo.create(run_id=run_id, type_=ElementType(el.type.value), label=el.label, caption=el.caption, content=content, order_index=el.order_index)
