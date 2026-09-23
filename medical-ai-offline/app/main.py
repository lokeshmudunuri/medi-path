"""LocalMed — offline-first medical assistant (FastAPI application).

Serves the REST API and the offline-first web UI from the same local process.
No cloud dependencies.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import ensure_runtime_dirs, settings
from app.core.storage import storage

from app.api.routes import cases, chat, models, system

ensure_runtime_dirs()

app = FastAPI(
    title="LocalMed — Offline Medical Assistant",
    version=settings.version,
    docs_url="/api/docs" if settings.version else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # local-only service; tightened in deployment docs
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(models.router)
app.include_router(cases.router)
app.include_router(chat.router)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


@app.get("/api/offline-mode")
def offline_mode() -> dict:
    """A diagnostic used by the UI to confirm the app is fully local."""
    return {"offline": True, "case_dir": str(storage.case_dir)}