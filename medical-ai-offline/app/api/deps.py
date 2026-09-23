"""Dependency wiring for the FastAPI application.

Single place that assembles repositories/services so routes stay thin and UI
code never touches the database.
"""
from __future__ import annotations

from app.ai.engine import LocalAIEngine, engine
from app.core.model_manager import default_manager
from app.data.repositories.case_repository import CaseRepository
from app.data.repositories.chat_repository import ChatRepository
from app.services.case_service import CaseService
from app.services.chat_service import ChatService

_case_repo = CaseRepository()
_chat_repo = ChatRepository()


def get_ai_engine() -> LocalAIEngine:
    return engine


def get_case_service() -> CaseService:
    return CaseService(repo=_case_repo, ai=engine)


def get_chat_service() -> ChatService:
    return ChatService(case_repo=_case_repo, chat_repo=_chat_repo, ai=engine)


def get_model_manager():
    return default_manager