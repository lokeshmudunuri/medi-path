"""Pytest shared fixtures.

Tests run against an isolated temporary data directory so the developer's own
cases/models are never touched. A fresh SQLite database is created per test.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("LOCALMED_FORCE_MOCK", "1")
os.environ.setdefault("LOCALMED_DATA_DIR", str(ROOT / "data"))


@pytest.fixture(autouse=True)
def isolated_model_state(tmp_path, monkeypatch):
    """Point the shared storage singleton at a temp dir so tests never touch
    the developer's real cases/models, and force mock AI providers."""
    from app.core.storage import storage

    storage.data_dir = tmp_path / "data"
    storage.model_dir = tmp_path / "models"
    storage.case_dir = tmp_path / "cases"
    storage.ensure_dirs()
    os.environ["LOCALMED_FORCE_MOCK"] = "1"


@pytest.fixture
def fresh_db(tmp_path):
    """A fresh local database per test with repositories attached."""
    from app.data.database import Database
    from app.data.repositories.case_repository import CaseRepository
    from app.data.repositories.chat_repository import ChatRepository

    db = Database(path=tmp_path / "test.db")
    yield {
        "db": db,
        "cases": CaseRepository(db=db),
        "chat": ChatRepository(db=db),
    }
    db.close()


@pytest.fixture
def mock_ai():
    os.environ["LOCALMED_FORCE_MOCK"] = "1"
    from app.ai.engine import LocalAIEngine
    from app.core.model_manager import ModelDownloadManager

    return LocalAIEngine(manager=ModelDownloadManager())


@pytest.fixture
def case_service(fresh_db, mock_ai):
    from app.parsing.extractor import MedicineExtractor
    from app.medical.engine import MedicalEngine

    from app.services.case_service import CaseService

    return CaseService(
        repo=fresh_db["cases"],
        ai=mock_ai,
        extractor=MedicineExtractor(),
        medical=MedicalEngine(),
    )


@pytest.fixture
def chat_service(fresh_db, mock_ai):
    from app.services.chat_service import ChatService

    return ChatService(
        case_repo=fresh_db["cases"],
        chat_repo=fresh_db["chat"],
        ai=mock_ai,
    )


@pytest.fixture
def paracetamol_image_bytes() -> bytes:
    """A small real JPEG whose file name determines the mock OCR sample."""
    from PIL import Image

    import io

    image = Image.new("RGB", (120, 60), "white")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


@pytest.fixture
def byte_server():
    """Threaded local HTTP(S) server serving byte blobs with Range support.

    Mirrors how model hosts serve files so the download manager's resume
    logic can be tested without internet.
    """
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    payloads: dict[str, bytes] = {}
    requests: list[dict] = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # silence
            pass

        def do_GET(self):
            name = self.path.lstrip("/")
            body = payloads.get(name)
            if body is None:
                self.send_response(404)
                self.end_headers()
                return
            start = 0
            rng = self.headers.get("Range")
            if rng and rng.startswith("bytes="):
                parts = rng[len("bytes="):].split("-")
                start = int(parts[0]) if parts[0] else 0
            if start >= len(body):
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{len(body)}")
                self.end_headers()
                return
            chunk = body[start:]
            requests.append({"name": name, "start": start})
            self.send_response(200 if start == 0 else 206)
            self.send_header("Content-Length", str(len(chunk)))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", f"bytes {start}-{len(body) - 1}/{len(body)}")
            self.end_headers()
            self.wfile.write(chunk)

        def do_HEAD(self):
            name = self.path.lstrip("/")
            body = payloads.get(name)
            if body is None:
                self.send_response(404)
            else:
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
            self.end_headers()

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    class ServerHandle:
        def url(self, name: str) -> str:
            return f"http://127.0.0.1:{server.server_port}/{name}"

        def put(self, name: str, data: bytes) -> None:
            payloads[name] = data

        def hit_headers(self) -> list[dict]:
            return list(requests)

        def stop(self) -> None:
            server.shutdown()
            server.server_close()

    yield ServerHandle()
    server.shutdown()
    server.server_close()