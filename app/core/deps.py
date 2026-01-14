from fastapi import Header, HTTPException, status, Depends
from enum import Enum


class UserRole(str, Enum):
    viewer = "viewer"
    annotator = "annotator"
    reviewer = "reviewer"


def get_current_role(x_role: str | None = Header(default=None)) -> UserRole:
    # Extremely simplified role retrieval via header for demo & tests
    if x_role is None:
        # default to viewer if not provided
        return UserRole.viewer
    try:
        return UserRole(x_role)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role header")


class RequireRole:
    def __init__(self, allowed: list[UserRole]):
        self.allowed = allowed

    def __call__(self, role: UserRole = Depends(get_current_role)) -> UserRole:
        if role not in self.allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return role


is_viewer = RequireRole([UserRole.viewer])
is_annotator = RequireRole([UserRole.annotator])
is_reviewer = RequireRole([UserRole.reviewer])
is_staff = RequireRole([UserRole.annotator, UserRole.reviewer])
is_viewer_or_higher = RequireRole([UserRole.viewer, UserRole.annotator, UserRole.reviewer])

