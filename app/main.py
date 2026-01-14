from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from app.routers import batches, papers, elements, reviews, health, root
from app.routers import uploads, parse_ops, runs, export
from app.routers import uploads, parse_ops


def create_app() -> FastAPI:
    app = FastAPI(title="OMIP PDF HITL System", version="0.1.0")

    # Routers
    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(batches.router, prefix="/api", tags=["batches"])
    app.include_router(uploads.router, prefix="/api", tags=["uploads"])
    app.include_router(parse_ops.router, prefix="/api", tags=["parse"])
    app.include_router(runs.router, prefix="/api", tags=["runs"])
    app.include_router(export.router, prefix="/api", tags=["export"])
    app.include_router(papers.router, prefix="/api", tags=["papers"])
    app.include_router(elements.router, prefix="/api", tags=["elements"])
    app.include_router(reviews.router, prefix="/api", tags=["reviews"])
    app.include_router(root.router, tags=["ui"])  # serves /

    # Static mount (if needed later)
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    return app


app = create_app()
