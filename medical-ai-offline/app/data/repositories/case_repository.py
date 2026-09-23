"""Repository for local case files (SQLite index + filesystem artifacts).

Cases are stored as:
- one JSON document row in SQLite (structured prescription + analysis)
- files under data/cases/<case_id>/  (prescription image, audio, etc.)
"""
from __future__ import annotations

from app.core.storage import storage
from app.data.database import Database, decode_json, encode_json
from app.domain.entities import Case
from app.utils.logging import get_logger

log = get_logger("data.case_repo")


class CaseRepository:
    def __init__(self, db: Database | None = None) -> None:
        self.db = db or _default_db()

    # -------------------------------------------------------------- writes
    def create(self, case: Case) -> Case:
        case.touch()
        self.db.execute(
            "INSERT INTO cases (id, name, created_at, updated_at, archived, data) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (case.id, case.name, case.created_at, case.updated_at, int(case.archived), encode_json(case.to_dict())),
        )
        self.db.commit()
        return case

    def update(self, case: Case) -> Case:
        case.touch()
        self.db.execute(
            "UPDATE cases SET name=?, updated_at=?, archived=?, data=? WHERE id=?",
            (case.name, case.updated_at, int(case.archived), encode_json(case.to_dict()), case.id),
        )
        self.db.commit()
        return case

    def delete(self, case_id: str) -> bool:
        self.db.execute("DELETE FROM chat_messages WHERE case_id=?", (case_id,))
        cursor = self.db.execute("DELETE FROM cases WHERE id=?", (case_id,))
        self.db.commit()
        folder = storage.case_dir_for(case_id)
        if folder.exists():
            import shutil

            shutil.rmtree(folder, ignore_errors=True)
        return cursor.rowcount > 0

    # --------------------------------------------------------------- reads
    def get(self, case_id: str) -> Case | None:
        row = self.db.query_one("SELECT data FROM cases WHERE id=?", (case_id,))
        if row is None:
            return None
        return Case.from_dict(decode_json(row["data"]))

    def list_all(self, include_archived: bool = False) -> list[Case]:
        sql = "SELECT data FROM cases"
        if not include_archived:
            sql += " WHERE archived=0"
        sql += " ORDER BY updated_at DESC"
        return [Case.from_dict(decode_json(row["data"])) for row in self.db.query_all(sql)]

    def count(self) -> int:
        row = self.db.query_one("SELECT COUNT(*) AS n FROM cases")
        return int(row["n"]) if row else 0

    def search(self, query: str) -> list[Case]:
        term = f"%{query}%"
        rows = self.db.query_all(
            "SELECT data FROM cases WHERE name LIKE ? OR data LIKE ? ORDER BY updated_at DESC",
            (term, term),
        )
        return [Case.from_dict(decode_json(row["data"])) for row in rows]


_db_instance: Database | None = None


def _default_db() -> Database:
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance