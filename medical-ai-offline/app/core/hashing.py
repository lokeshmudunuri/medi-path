"""Hashing / checksum utilities for model integrity verification."""
from __future__ import annotations

import hashlib
from pathlib import Path


def sha256_hexdigest(path: Path, chunk_size: int = 1 << 20) -> str:
    """Compute the SHA-256 digest of a file without loading it fully in RAM."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def verify_sha256(path: Path, expected: str | None) -> bool:
    """Return True if file matches expected sha256. If no expected digest is
    known for this model, verification is deferred and returns None-safe True
    only for a non-empty file (documented in MODELS.md)."""
    if not path.exists() or path.stat().st_size == 0:
        return False
    if not expected:
        return True
    return sha256_hexdigest(path).lower() == expected.strip().lower()


def md5_hexdigest(path: Path) -> str:
    import hashlib as _h

    h = _h.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()