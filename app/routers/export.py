from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.core.deps import is_staff, UserRole, is_viewer_or_higher
from app.db.session import get_session
from app.repositories.run_repo import RunRepository
from app.models.models import ParseRun, Paper, ParseStatus
from sqlalchemy import select
from uuid import UUID
import json
import io

router = APIRouter()

@router.get("/export")
def export_data(
    format: str = Query("json", regex="^(json|parquet)$"),
    role: UserRole = Depends(is_viewer_or_higher)
):
    """
    Export approved data in JSON or Parquet format.
    Only includes papers with an approved official run.
    """
    with get_session() as db:
        # Select all approved runs
        # Join with Paper to get filename if needed
        stmt = (
            select(ParseRun, Paper)
            .join(Paper, Paper.id == ParseRun.paper_id)
            .where(ParseRun.status == ParseStatus.approved)
        )
        rows = db.execute(stmt).all()
        
        data_list = []
        for run, paper in rows:
            # Construct the export record
            record = {
                "paper_id": str(paper.id),
                "filename": paper.filename,
                "omip_id": run.raw_metadata.get("omip_id"),
                "title": run.raw_metadata.get("title"),
                "authors": run.raw_metadata.get("authors"),
                "year": run.raw_metadata.get("year"),
                "run_id": str(run.id),
                "approved_at": run.updated_at.isoformat() if run.updated_at else None, # using updated_at as proxy if reviewed_at not reliable, checking model...
                # elements: let's include simplified elements
                "tables": [
                    {
                        "number": e.content.get("number"),
                        "caption": e.content.get("caption"),
                        "rows": e.content.get("rows")
                    }
                    for e in sorted(run.elements, key=lambda x: x.order_index)
                    if e.type.value == "table"
                ],
                "figures": [
                    {
                        "number": e.content.get("number"),
                        "caption": e.content.get("caption")
                    }
                    for e in sorted(run.elements, key=lambda x: x.order_index)
                    if e.type.value == "figure"
                ]
            }
            data_list.append(record)

        if format == "json":
            # Stream JSON
            json_str = json.dumps(data_list, indent=2, ensure_ascii=False)
            return StreamingResponse(
                io.StringIO(json_str),
                media_type="application/json",
                headers={"Content-Disposition": "attachment; filename=approved_data.json"}
            )
            
        elif format == "parquet":
            try:
                import pandas as pd
                df = pd.DataFrame(data_list)
                # Convert complex columns to string or handle appropriately for Parquet
                # For simplicity, let's dump nested JSONs to strings or keep as object if supported
                # JSON/Arrays in parquet can be tricky for basic viewers, often stringified
                # Let's stringify lists/dicts
                for col in ["authors", "tables", "figures"]:
                    df[col] = df[col].apply(json.dumps)
                
                buffer = io.BytesIO()
                df.to_parquet(buffer, index=False)
                buffer.seek(0)
                return StreamingResponse(
                    buffer,
                    media_type="application/octet-stream",
                    headers={"Content-Disposition": "attachment; filename=approved_data.parquet"}
                )
            except ImportError:
                 raise HTTPException(status_code=501, detail="Parquet export requires pandas and pyarrow libraries installed on server.")

