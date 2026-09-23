# LocalMed — Offline Medical Assistant

A fully offline, on-device medical assistant. Scans a prescription (OCR), extracts medicines with deterministic rules, runs a local medical engine for safety information, stores cases in local SQLite, and answers questions via a grounded local LLM — with no cloud services of any kind.

## What it does

1. **Scan** — upload or photograph a prescription image.
2. **OCR** — RapidOCR (ONNX, on-device) reads the text; a deterministic mock is used before the model is installed.
3. **Extract** — rule-based parser pulls medicine name, strength, dose, frequency, duration, timing and route. No LLM is involved in parsing safety-critical data.
4. **Analyze** — the deterministic `MedicalEngine` looks up each medicine in the bundled knowledge base and produces medicine information, safety flags, interactions, takeaways and diet rules. Unknown medicines return an explicit "not available" message — never a guess.
5. **Verify** — the user reviews and confirms extracted medicines before the analysis is treated as final.
6. **Chat** — text and voice questions are grounded in the case (medicines + engine results) and answered by a local LLM (Ollama / Qwen2.5 0.5B). A response validator ensures the LLM never contradicts the engine or invents facts.
7. **Models** — all AI models (OCR, STT, TTS, LLM) are downloaded, resumed, and SHA-256 verified by a local model manager. Nothing is fetched at runtime except during an explicit user-initiated model download.

## Guarantees

- **100% offline after model install.** No OpenAI, Gemini, Claude, cloud OCR, cloud TTS/STT, Firebase, Supabase, or analytics.
- **Deterministic medical truth.** The LLM is an explanation layer only. Every medical fact comes from `app/medical/`.
- **No fabrication.** Unknown medicines produce `Information is not available in the local medical database.`
- **Local data only.** Cases, images, OCR text and chat live under `data/` on this machine.

## Quick start

```bash
pip install -r requirements-dev.txt
python -m pytest -q          # run the full test suite
python run.py --port 8000    # start the server
# open http://127.0.0.1:8000
```

Optional real AI providers:

```bash
pip install -r requirements-ai.txt   # rapidocr-onnxruntime, vosk, pyttsx3
```

Local LLM (Ollama):

```bash
ollama pull qwen3-coder-16k:latest
```

## Project layout

| Path | Purpose |
|---|---|
| `app/config.py` | Runtime settings (paths, Ollama host, chunk size) |
| `app/domain/` | Entities and enums shared across the app |
| `app/core/` | Storage layout, SHA-256 hashing, model registry, model download manager |
| `app/parsing/` | OCR text normalization + rule-based medicine extractor |
| `app/medical/` | Knowledge base, safety, interactions, takeaways, diet, engine |
| `app/data/` | SQLite database and repositories (cases, chat) |
| `app/services/` | Case pipeline, grounding, response validation, chat |
| `app/ai/` | OCR / STT / TTS / LLM providers (real + mock) and the `LocalAIEngine` facade |
| `app/api/` | FastAPI routes and dependency wiring |
| `frontend/` | Offline-first web UI (no CDN, no external fonts) |
| `models/registry/` | Centralized model registry JSON |
| `tests/` | Pytest suite (mock AI providers forced via `LOCALMED_FORCE_MOCK=1`) |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — component diagram, data flow, boundaries
- [MODELS.md](MODELS.md) — model registry, download lifecycle, verification
- [DEVELOPMENT.md](DEVELOPMENT.md) — running, testing, extending

## License

Application code: see repository license. Bundled model licenses are declared per-entry in `models/registry/model_registry.json`.
