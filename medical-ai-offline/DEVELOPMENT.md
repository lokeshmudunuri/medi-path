# Development

## Requirements

- Python 3.11+ (tested on 3.13)
- No internet required after models are installed

```bash
pip install -r requirements-dev.txt      # base app + pytest
pip install -r requirements-ai.txt       # optional: real OCR / STT / TTS providers
```

## Run the app

```bash
python run.py --port 8000
# or with auto-reload during development
python run.py --port 8000 --reload
```

Open http://127.0.0.1:8000. The UI, API and all data are local.

### Health check

```bash
curl http://127.0.0.1:8000/api/health
```

## Tests

```bash
python -m pytest -q              # full suite
python -m pytest tests/test_medicine_parsing.py -q
python -m pytest -k download -q  # by keyword
```

Tests force mock AI providers via `LOCALMED_FORCE_MOCK=1` (set in `tests/conftest.py`) and isolate all storage under pytest's `tmp_path`, so your real cases and models are never touched.

Key fixtures in `tests/conftest.py`:

| Fixture | Provides |
|---|---|
| `isolated_model_state` (autouse) | Temp data/model/case dirs + force-mock env |
| `fresh_db` | New SQLite database with case/chat repositories |
| `case_service` | `CaseService` wired to mock AI + fresh DB |
| `chat_service` | `ChatService` wired to mock AI + fresh DB |
| `byte_server` | Local HTTP server with Range support (download resume tests) |

Mock OCR routes by **image filename**: a file named `paracetamol_sample.jpg` returns the bundled paracetamol prescription; any other name returns a low-confidence fallback that exercises the verification path.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `LOCALMED_DATA_DIR` | `<repo>/data` | Root for cases, models, database |
| `LOCALMED_FORCE_MOCK` | `0` | `1` forces mock OCR/STT/TTS/LLM |
| `LOCALMED_OLLAMA_HOST` | `http://127.0.0.1:11434` | Local Ollama endpoint (never remote) |
| `LOCALMED_OLLAMA_MODEL` | `qwen3-coder-16k:latest` | Ollama model tag |

Settings are defined in `app/config.py` via pydantic-settings with the `LOCALMED_` prefix.

## Local LLM (Ollama)

```bash
# install Ollama, then:
ollama pull qwen3-coder-16k:latest
```

The app detects the model via `GET /api/tags` on localhost through the single
`LocalLLMProvider` facade (see `app/ai/llm/local_provider.py`). If Ollama or the
model is absent, chat falls back to the clearly-labelled mock provider and the
UI points you to Settings → Models. The configured model is a general-purpose
coding model used strictly as an explanation layer — it is not a medical model
and never contributes medical facts.

## Optional AI dependencies

| Package | Enables |
|---|---|
| `rapidocr-onnxruntime` | Real prescription OCR |
| `vosk` | Real speech-to-text |
| `pyttsx3` | Platform text-to-speech (baseline before Piper) |

Each is imported lazily; the base application runs without them and reports the provider unavailable until installed.

## Project conventions

- **No comments unless asked** in application code; docstrings explain module purpose.
- **No cloud imports.** Any new network call must be model-download or localhost-Ollama only.
- **Medical facts only from `app/medical/`.** Never embed medical text in UI, LLM prompts (beyond grounding), or logs.
- **Privacy-aware logging** (`app/utils/logging.py`): never log prescription content; use `redact()` when in doubt.
- **Deterministic tests.** Prefer fixtures and mock providers over sleeps or real network.

## Adding a new medicine to the knowledge base

Edit `app/medical/data/medicine_knowledge.json`:

```json
"your_medicine": {
  "aliases": ["brand names"],
  "category": "...",
  "indications_summary": "...",
  "common_side_effects": ["..."],
  "cautions": ["..."],
  "takeaways": ["..."],
  "diet_rules": ["..."]
}
```

Interactions go under the top-level `"interactions"` object (symmetric lookup is automatic). Add a test in `tests/test_medical_engine.py`.

## Adding an API route

1. Create/extend a router under `app/api/routes/`.
2. Register it in `app/main.py` with `app.include_router(...)`.
3. Resolve services via `app/api/deps.py` dependencies — routes stay thin.
4. Add a test that exercises the endpoint through the service layer or `TestClient`.

## Debugging the pipeline in a shell

```bash
python - <<'PY'
from app.parsing.extractor import MedicineExtractor
from app.medical.engine import MedicalEngine

text = open("tests/fixtures/sample_prescriptions/paracetamol.txt").read()
result = MedicineExtractor().extract(text)
for m in result.prescription.medicines:
    print(m.to_dict())
analysis = MedicalEngine().analyze(result.prescription)
for f in analysis.safety_flags:
    print(f.severity, f.message)
PY
```
