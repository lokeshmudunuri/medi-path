# Architecture

LocalMed is a single local process: a FastAPI server that serves both the REST API and the offline-first web UI. All state lives on the device.

## High-level flow

```
Image upload
    │
    ▼
ImagePreprocessor ──► OcrProvider (RapidOCR | Mock)
    │                         │
    │                         ▼
    │              MedicineExtractor (rule-based)
    │                         │
    │                         ▼
    │              CaseService.create_from_image
    │                         │
    │          ┌──────────────┼──────────────┐
    │          ▼              ▼              ▼
    │   MedicalEngine   CaseRepository   ChatService
    │   (deterministic)  (SQLite+FS)          │
    │          │                              ▼
    │          ▼                    GroundingContextBuilder
    │   MedicalAnalysis                      │
    │   (info, flags,                        ▼
    │    takeaways, diet)          LlmProvider (Ollama | Mock)
    │                                       │
    │                                       ▼
    │                              ResponseValidator
    │                                       │
    └──────────────► Case (stored) ◄────────┘
                          │
                          ▼
                     Web UI (cases, chat, models, scan)
```

## Layers

### 1. Domain (`app/domain/`)
Plain dataclasses (`Case`, `Prescription`, `Medicine`, `MedicalAnalysis`, `SafetyFlag`, `ChatMessage`, …) and string enums. No framework dependencies; fully JSON-serialisable.

### 2. Core (`app/core/`)
- **Storage** — owns the on-disk layout: `data/models/`, `data/cases/<id>/`, download temp dirs.
- **Hashing** — streaming SHA-256 for model verification.
- **Registry** — loads `models/registry/model_registry.json`; the single source of model URLs, sizes, checksums, licences.
- **ModelDownloadManager** — state machine, Range-resumable downloads, `.part` files, SHA-256 verification, post-install extraction (e.g. Vosk zip), Ollama-managed LLM handling.

### 3. AI providers (`app/ai/`)
Four capabilities behind provider protocols:

| Capability | Real provider | Mock provider |
|---|---|---|
| OCR | `RapidOcrProvider` (ONNX) | `MockOcrProvider` (fixture-keyed) |
| STT | `VoskSttProvider` | `MockSttProvider` |
| TTS | `PiperTtsProvider`, `PlatformTtsProvider` | `MockTtsProvider` (writes a WAV) |
| LLM | `OllamaProvider` via `LocalLLMProvider` (localhost only) | `MockLlmProvider` (reflects context) |

`LocalAIEngine` is the facade: it inspects the model manager (or `LOCALMED_FORCE_MOCK=1`) and returns the appropriate provider. The LLM capability is reached exclusively through `LocalLLMProvider` (see `app/ai/llm/local_provider.py`), which selects the local Ollama backend when the configured model tag is detected and falls back to the clearly-labelled mock otherwise. Its `status()` drives the UI's Model Status panel. Mock providers always report `engine="mock"` so synthetic output can never be confused with model output.

### 4. Parsing (`app/parsing/`)
- `normalize_text` — lower-cases, fixes OCR confusions, expands abbreviations (`tab.` → `tablet`, `od` → known frequency, units unified).
- `MedicineExtractor` — pure regex/lexicon rules. Dash schedules (`1-1-1`, `1-0-1`, `1-1-1/2`) are matched before plain digits; frequency abbreviations and word forms are expanded; duration, timing and route are extracted. Lines that cannot be attributed to a medicine go to `unmatched_lines`.

### 5. Medical engine (`app/medical/`)
Deterministic, knowledge-base backed. Never calls an LLM.

- `MedicineKnowledgeBase` — loads the curated JSON (`app/medical/data/medicine_knowledge.json`).
- `SafetyChecker` — flags unreadable medicines (critical) and unknown medicines (warning: "not available in the local medical database").
- `InteractionChecker` — pairwise lookup in the interaction matrix; serious keywords escalate to critical.
- `ImportantTakeawayEngine`, `DietRuleEngine` — per-medicine takeaways and food rules from the KB.
- `MedicalEngine.analyze` — orchestrates all of the above into a `MedicalAnalysis` with an `engine_version`.

### 6. Services (`app/services/`)
- `CaseService` — full pipeline: image → preprocess → OCR → extract → medical analysis → SQLite. User can update/verify medicines, which re-runs the engine.
- `GroundingContextBuilder` — builds the exact bounded context the LLM sees: medicines, engine results, safety flags, takeaways, diet rules, recent chat, and a `NOT_ENOUGH_LOCAL_INFORMATION` marker when any medicine is missing from the KB.
- `ResponseValidator` — post-LLM guard: appends the canonical missing-information phrase when the engine reported gaps and the LLM omitted them; appends the critical safety alert when a critical flag exists.
- `ChatService` — text and voice share one pipeline; voice only adds STT at the front and TTS at the end.

### 7. API (`app/api/`)
Thin FastAPI routers:

| Route group | Purpose |
|---|---|
| `GET /api/health` | Offline posture, free storage |
| `GET /api/models`, `/api/models/required` | Model listing + required total |
| `POST /api/models/{id}/download\|pause\|resume\|cancel\|verify` | Download lifecycle |
| `POST /api/cases` | Create case from image upload |
| `GET/PATCH/DELETE /api/cases/...` | Case CRUD, medicine verification |
| `GET /api/cases/{id}/image` | Serve stored prescription image |
| `GET/POST /api/cases/{id}/chat`, `/voice` | Text and voice chat |

### 8. Frontend (`frontend/`)
Vanilla JS single-page app with hash routing. No CDN, no external fonts, no analytics. Views: splash, model setup, home, cases, case detail (with chat panel), scan, settings (model management).

## Data flow boundaries

- **OCR/extraction** never sees the LLM. Safety-critical parsing is deterministic.
- **MedicalEngine** never sees the LLM. All medical facts come from the local KB.
- **LLM** only sees the rendered grounding context, never the raw database or other cases.
- **ResponseValidator** runs after every LLM reply before it is stored or displayed.
- **Model downloads** are the only network activity, and only when the user explicitly starts them.

## Persistence

- **SQLite** (`data/localmed.db`) — `cases` (one JSON document per case) and `chat_messages`.
- **Filesystem** (`data/cases/<id>/`) — original image, preprocessed image, voice audio.
- **Model state** (`data/models/<id>/state.json`) — download records for resume-after-restart.

## Offline model selection

```
LOCALMED_FORCE_MOCK=1     → always mock providers (tests)
model not installed       → mock provider + Model Setup UI prompt
model installed           → real provider
Ollama unavailable        → MockLlmProvider with clear labelling
```
