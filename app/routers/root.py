from fastapi import APIRouter
from fastapi.responses import HTMLResponse


router = APIRouter()


@router.get("/", response_class=HTMLResponse)
def index():
    # Extremely simplified UI for quick manual testing
    with open("app/static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

