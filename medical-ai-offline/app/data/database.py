"""Local SQLite database layer.

UI never touches this module directly — repositories sit on top. Uses the
standard library sqlite3 driver (zero extra dependencies). WAL mode for
concurrent reads while the download worker writes.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path

from app.config import settings
from app.utils.logging import get_logger

log = get_logger("data.database")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    archived    INTEGER NOT NULL DEFAULT 0,
    data        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          TEXT PRIMARY KEY,
    case_id     TEXT NOT NULL,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    source      TEXT NOT NULL,
    media_path  TEXT,
    input_kind  TEXT NOT NULL DEFAULT 'text'
);

CREATE INDEX IF NOT EXISTS idx_cases_updated ON cases(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_case ON chat_messages(case_id, created_at);
"""


class Database:
    """Small thread-safe wrapper around a single sqlite3 connection."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path or settings.database_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self.path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    # ---------------------------------------------------------------- api
    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self._lock:
            cursor = self._conn.execute(sql, params)
            return cursor

    def executemany(self, sql: str, seq: list[tuple]) -> None:
        with self._lock:
            self._conn.executemany(sql, seq)
            self._conn.commit()

    def commit(self) -> None:
        with self._lock:
            self._conn.commit()

    def query_all(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            cursor = self._conn.execute(sql, params)
            return cursor.fetchall()

    def query_one(self, sql: str, params: tuple = ()) -> sqlite3.Row | None:
        with self._lock:
            cursor = self._conn.execute(sql, params)
            return cursor.fetchone()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


def decode_json(raw: str) -> dict:
    return json.loads(raw)


def encode_json(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False)


default_db = Database()