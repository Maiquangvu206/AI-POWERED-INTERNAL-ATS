"""Xác thực service-to-service bằng header `X-Internal-Token`.

AI Service không bao giờ được expose ra Internet (ADR-0001); mọi endpoint
`/internal/*` phải đi qua dependency này.
"""

import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status

from app.settings import get_settings


def verify_internal_token(
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
) -> None:
    expected = get_settings().ai_internal_token

    if not x_internal_token or not secrets.compare_digest(x_internal_token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Internal-Token không hợp lệ",
        )
