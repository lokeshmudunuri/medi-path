"""Development entry point: start the offline LocalMed server.

Usage:
    python run.py [--port 8000] [--host 127.0.0.1]

Fully local; works in airplane mode after AI models are installed.
"""
from __future__ import annotations

import argparse

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="LocalMed offline server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload, log_level="info")


if __name__ == "__main__":
    main()