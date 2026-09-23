"""Repository for chat history, scoped to a local case."""
from __future__ import annotations

from app.data.database import Database
from app.domain.entities import ChatMessage
from app.data.repositories.case_repository import _default_db


class ChatRepository:
    def __init__(self, db: Database | None = None) -> None:
        self.db = db or _default_db()

    def add_message(self, message: ChatMessage) -> ChatMessage:
        self.db.execute(
            "INSERT INTO chat_messages (id, case_id, role, content, created_at, source, media_path, input_kind) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                message.id,
                message.case_id,
                message.role,
                message.content,
                message.created_at,
                message.source,
                message.media_path,
                message.input_kind,
            ),
        )
        self.db.commit()
        return message

    def list_messages(self, case_id: str) -> list[ChatMessage]:
        rows = self.db.query_all(
            "SELECT * FROM chat_messages WHERE case_id=? ORDER BY created_at ASC",
            (case_id,),
        )
        messages = []
        for row in rows:
            messages.append(
                ChatMessage(
                    id=row["id"],
                    case_id=row["case_id"],
                    role=row["role"],
                    content=row["content"],
                    created_at=row["created_at"],
                    source=row["source"],
                    media_path=row["media_path"] or "",
                    input_kind=row["input_kind"] or "text",
                )
            )
        return messages

    def update_content(self, message_id: str, content: str) -> None:
        self.db.execute(
            "UPDATE chat_messages SET content=? WHERE id=?",
            (content, message_id),
        )
        self.db.commit()

    def update_media(self, message_id: str, media_path: str) -> None:
        self.db.execute(
            "UPDATE chat_messages SET media_path=? WHERE id=?",
            (media_path, message_id),
        )
        self.db.commit()

    def delete_case_messages(self, case_id: str) -> None:
        self.db.execute("DELETE FROM chat_messages WHERE case_id=?", (case_id,))
        self.db.commit()