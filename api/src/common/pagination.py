"""Reusable pagination dependency for list endpoints."""

from math import ceil

from fastapi import Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


class PaginationParams(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def pagination_dep(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=200, description="Items per page"),
) -> PaginationParams:
    """Use as: params: PaginationParams = Depends(pagination_dep)"""
    return PaginationParams(page=page, page_size=page_size)


class PaginatedResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    data: list
    total: int
    page: int
    page_size: int
    total_pages: int


async def paginate_query(
    db: AsyncSession,
    stmt: select,
    params: PaginationParams,
) -> PaginatedResult:
    """Execute a SELECT query with pagination and return metadata."""
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    result = await db.execute(stmt.offset(params.offset).limit(params.limit))
    rows = result.scalars().all()
    return PaginatedResult(
        data=list(rows),
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=max(1, ceil(total / params.page_size)),
    )
