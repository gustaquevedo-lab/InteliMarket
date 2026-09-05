"""Gerente General IA — chat conversacional con contexto real del negocio"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.general_agent import service
from api.src.general_agent.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/v1/general-agent", tags=["general-agent"], dependencies=[Depends(require_auth)])


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    try:
        history = [{"role": m.role, "content": m.content} for m in body.history]
        reply = await service.chat(db, str(body.company_id), body.message, history)
        return ChatResponse(reply=reply)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"El Gerente General IA no pudo responder: {e}")
