# Models

All AI model metadata lives in a single registry file:

```
models/registry/model_registry.json
```

No URL, filename, size, licence or install path is hard-coded anywhere else in the application.

## Registry entry shape

```json
{
  "id": "ocr-rapidocr",
  "name": "Prescription OCR (RapidOCR PaddleOCR-lite)",
  "type": "ocr",
  "runtime": "onnxruntime",
  "version": "1.3.24",
  "required": true,
  "files": [
    {
      "name": "ch_PP-OCRv4_det_infer.onnx",
      "url": "https://github.com/.../ch_PP-OCRv4_det_infer.onnx",
      "size_bytes": 4702936,
      "sha256": null
    }
  ],
  "total_size_bytes": 15730000,
  "minimum_storage_bytes": 35000000,
  "minimum_ram_bytes": 536870912,
  "quantization": "int8",
  "accelerator": "onnxruntime-CPU",
  "license": "Apache-2.0",
  "install_path_relative": "ocr/rapidocr",
  "languages": ["en", "hi", "ta", "bn", "mr"]
}
```

## Bundled models

| id | Type | Runtime | Required | Notes |
|---|---|---|---|---|
| `ocr-rapidocr` | OCR | onnxruntime | yes | 3 ONNX files (det, rec, cls) |
| `stt-vosk-en` | STT | vosk | yes | Small English zip, extracted on install |
| `llm-qwen3-coder` | LLM | ollama | yes | Managed by local Ollama (`ollama://` URL) |
| `tts-piper-en` | TTS | piper | yes | ONNX voice + JSON config |
| `medical-base-en` | other | json | yes | Bundled knowledge base (no download) |

## Checksums (`sha256`)

- When `sha256` is a non-null hex digest, verification is **exact**: the downloaded file's SHA-256 must match.
- When `sha256` is `null` (current state for all entries), verification falls back to a **non-empty size check**: the file must exist and be at least `size_bytes`. This is documented behaviour until digests are pinned for each release.
- Verification always runs before a model is marked `INSTALLED`. Incomplete or corrupt files are never treated as valid.

To pin a digest:

```bash
python -c "from app.core.hashing import sha256_hexdigest; from pathlib import Path; print(sha256_hexdigest(Path('file.onnx')))"
```

Then set the `sha256` field in the registry.

## Download lifecycle

```
NOT_INSTALLED
     │  user taps Download
     ▼
DOWNLOADING ──── pause ────► PAUSED ──── resume ────┐
     │                                               │
     │ all files streamed to .download/<name>.part   │
     │ (HTTP Range resume on restart)                │
     ▼                                               │
DOWNLOAD_FINISHED                                    │
     │                                               │
     ▼                                               │
VERIFYING ── checksum/size fail ──► VERIFICATION_FAILED
     │                                   │
     │ pass                            re-download
     ▼                                   │
INSTALLED / READY ◄──────────────────────┘
```

Additional states: `FAILED` (network/IO error), `QUEUED`, `CORRUPTED`.

### Resume behaviour

- Partial data is always written to `<model_dir>/<id>/.download/<filename>.part`.
- On the next download attempt a `Range: bytes=<offset>-` header is sent; the server replies `206 Partial Content`.
- If the server replies `416 Range Not Satisfiable` (part is already complete or stale), the manager deletes the `.part` and restarts from zero.
- State is persisted to `<model_dir>/<id>/state.json` so progress survives process restarts.
- If the state file says `DOWNLOADING` but no worker thread is alive (e.g. the app was restarted), calling `download_model` starts a fresh thread that resumes from the existing `.part`.

### Storage check

Before starting, `check_storage_before_download` compares free disk space to `max(total_size_bytes, minimum_storage_bytes)`. If insufficient, the API returns **507 Insufficient Storage** with a human-readable message.

## Ollama-managed LLM

`llm-qwen3-coder` uses an `ollama://` URL scheme. The manager:

1. Checks `GET http://127.0.0.1:11434/api/tags` for the model tag (cached probe).
2. If present → `INSTALLED`.
3. If absent → triggers a best-effort `ollama pull qwen3-coder-16k:latest` in a background thread (or the user can run it manually).

Note: the configured LLM is a general-purpose coding model (`qwen3-coder-16k:latest`).
It is used purely as an explanation layer over the local medical engine and is
never described as a medical model.

Pause/cancel of Ollama-managed downloads are no-ops (Ollama owns the lifecycle). Delete issues `DELETE /api/delete` to the local Ollama runtime.

## Install paths

Verified files are moved from `.download/` to:

```
data/models/<id>/<install_path_relative>/
```

Zip archives (Vosk) are extracted into the install directory. Providers load models exclusively from these paths — never from package data or the network.

## Adding a model

1. Add an entry to `models/registry/model_registry.json` with correct `files`, `total_size_bytes`, `minimum_storage_bytes`, `license`, and `install_path_relative`.
2. Pin `sha256` digests where possible.
3. Point the corresponding provider (`app/ai/*/`) at the install path via `settings.model_dir / <id> / <install_path_relative>`.
4. Add/adjust a test in `tests/test_model_registry.py` and `tests/test_model_download.py`.
