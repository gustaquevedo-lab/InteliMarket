from pydantic import BaseModel
from typing import Literal
from uuid import UUID


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    company_id: UUID
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
