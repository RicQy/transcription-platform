# Technical Specification
## TranscribeMe-Compatible Transcription Platform

---

## 1. Technical Context

### Language & Runtime
| Layer | Technology | Version |
|---|---|---|
| Frontend | React (TypeScript) | 18.x |
| Frontend build | Vite | 5.x |
| Backend | Python / FastAPI | 3.11+  / 0.111+ |
| Database | PostgreSQL | 15+ |
| Task queue | Celery + Redis | 5.x / 7.x |
| Object storage | Local filesystem (dev) / S3-compatible (prod) |

### Key Dependencies

**Backend (Python)**
| Package | Purpose |
|---|---|
| `fastapi` | REST API framework |
| `sqlalchemy` + `alembic` | ORM + migrations |
| `celery[redis]` | Async task processing (ASR, PDF parsing) |
| `pdfplumber` | PDF text extraction |
| `openai` | LLM rule extraction (GPT-4o structured output) |
| `assemblyai` | ASR + speaker diarization + word timestamps |
| `python-docx` | `.docx` export |
| `boto3` | S3-compatible file storage |
| `pydantic` v2 | Data validation / settings management |
| `pytest` + `httpx` | Testing |
| `ruff` | Linting + formatting |
| `mypy` | Type checking |

**Frontend (TypeScript)**
| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI framework |
| `@slate-js/slate` + `slate-react` | Rich-text editor with inline decorations |
| `wavesurfer.js` | Waveform visualization + audio alignment |
| `@tanstack/react-query` | Server state management |
| `zustand` | Client UI state management |
| `tailwindcss` | Utility-first styling |
| `axios` | HTTP client |
| `docx` | Client-side .docx generation (fallback) |
| `vitest` + `@testing-library/react` | Unit + component testing |
| `eslint` + `typescript-eslint` | Linting |

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                     React SPA (Vite)                   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Admin UI │  │ Editor UI    │  │ Export / Review  │ │
│  └──────────┘  └──────────────┘  └──────────────────┘ │
└────────────────────────┬───────────────────────────────┘
                         │ REST + SSE
┌────────────────────────▼───────────────────────────────┐
│                  FastAPI Backend                        │
│  /api/style-guides   /api/audio   /api/transcripts     │
│  /api/validation     /api/export  /api/rules           │
└───────┬──────────────────────────────┬─────────────────┘
        │ Celery tasks                 │ SQLAlchemy
┌───────▼──────────┐         ┌────────▼────────┐
│  Celery Workers  │         │   PostgreSQL     │
│  • PDF→Rules     │         │   (all tables)  │
│  • Audio→ASR     │         └─────────────────┘
│  • Revalidate    │
└───────┬──────────┘
        │
┌───────▼──────────────────────────────────┐
│  External Services                        │
│  • AssemblyAI  (ASR + diarization)        │
│  • OpenAI GPT-4o  (rule extraction)       │
│  • S3 / local fs  (file storage)          │
└──────────────────────────────────────────┘
```

---

## 3. Source Code Structure

```
transcription-platform/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory
│   │   ├── config.py                # Pydantic Settings (env vars)
│   │   ├── database.py              # SQLAlchemy engine + session
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   ├── audio.py
│   │   │   ├── transcript.py
│   │   │   ├── style_guide.py
│   │   │   └── validation.py
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   │   ├── audio.py
│   │   │   ├── transcript.py
│   │   │   ├── style_guide.py
│   │   │   └── validation.py
│   │   ├── routers/                 # FastAPI routers (one per domain)
│   │   │   ├── audio.py
│   │   │   ├── transcripts.py
│   │   │   ├── style_guides.py
│   │   │   ├── rules.py
│   │   │   ├── validation.py
│   │   │   └── export.py
│   │   ├── services/                # Business logic
│   │   │   ├── storage.py           # File storage abstraction (local / S3)
│   │   │   ├── asr.py               # AssemblyAI wrapper
│   │   │   ├── pdf_parser.py        # pdfplumber PDF text extraction
│   │   │   ├── rule_extractor.py    # OpenAI LLM rule extraction
│   │   │   ├── validator.py         # Rule validation engine
│   │   │   └── exporter.py          # TXT / DOCX / JSON export
│   │   └── tasks/                   # Celery task definitions
│   │       ├── celery_app.py
│   │       ├── asr_tasks.py
│   │       ├── pdf_tasks.py
│   │       └── revalidation_tasks.py
│   ├── alembic/                     # DB migrations
│   ├── tests/
│   │   ├── test_routers/
│   │   ├── test_services/
│   │   └── conftest.py
│   ├── pyproject.toml
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/                     # Axios API clients (one per domain)
│   │   │   ├── audioApi.ts
│   │   │   ├── transcriptApi.ts
│   │   │   ├── styleGuideApi.ts
│   │   │   └── exportApi.ts
│   │   ├── store/                   # Zustand stores
│   │   │   ├── editorStore.ts       # Current transcript, playback state
│   │   │   └── styleGuideStore.ts   # Active guide + rules cache
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   │   ├── StyleGuideUpload.tsx
│   │   │   │   ├── RuleViewer.tsx
│   │   │   │   └── VersionSwitcher.tsx
│   │   │   ├── editor/
│   │   │   │   ├── TranscriptEditor.tsx   # Slate editor root
│   │   │   │   ├── EditorToolbar.tsx
│   │   │   │   ├── SpeakerSegment.tsx
│   │   │   │   ├── WordSpan.tsx           # Renders word with timestamp + highlight
│   │   │   │   └── ValidationPanel.tsx
│   │   │   ├── audio/
│   │   │   │   ├── AudioPlayer.tsx        # WaveSurfer wrapper
│   │   │   │   └── AudioUpload.tsx
│   │   │   └── export/
│   │   │       └── ExportDialog.tsx
│   │   ├── hooks/
│   │   │   ├── useAudioSync.ts      # Audio↔text alignment logic
│   │   │   ├── useValidation.ts     # Debounced validation calls
│   │   │   └── useKeyboardShortcuts.ts
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── EditorPage.tsx
│   │   │   └── AdminPage.tsx
│   │   └── types/                   # Shared TypeScript types
│   │       ├── transcript.ts
│   │       ├── styleGuide.ts
│   │       └── validation.ts
│   ├── tests/
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── docker-compose.yml               # PostgreSQL + Redis + backend + frontend
└── .gitignore
```

---

## 4. Data Model

All models map directly to the schema defined in `requirements.md §6`. Key implementation notes:

- PostgreSQL `UUID` primary keys using `gen_random_uuid()`.
- `ValidationErrors.location` stored as `JSONB` for flexibility.
- `StyleGuideDocuments.is_active` enforced via a partial unique index: only one active row at a time.
- `TranscriptSegments.sequence` is an integer used for ordering; gaps allowed for future inserts.
- `WordTimestamps.alignment_source` enum: `asr` (default) | `manual`.

### Alembic migrations
One migration file per delivery phase; never edit previously applied migrations.

---

## 5. API Contracts

### Style Guides
```
POST   /api/style-guides/upload          # Upload PDF; returns guide_id; triggers Celery task
GET    /api/style-guides                 # List all versions
GET    /api/style-guides/{guide_id}/rules  # List extracted rules
PATCH  /api/style-guides/{guide_id}/activate  # Set as active; triggers revalidation
```

### Audio & Transcripts
```
POST   /api/audio/upload                 # Upload audio; returns audio_id; triggers ASR task
GET    /api/audio/{audio_id}/status      # Poll ASR job status
GET    /api/transcripts/{transcript_id}  # Full transcript with segments + word timestamps
PATCH  /api/transcripts/{transcript_id}/segments/{segment_id}  # Save edited segment text
```

### Validation
```
POST   /api/validation/run               # Body: {transcript_id}; runs validation; returns errors
GET    /api/validation/{transcript_id}   # Get current errors for transcript
```

### Export
```
POST   /api/export                       # Body: {transcript_id, format}; returns file download
```

### SSE (Server-Sent Events)
```
GET    /api/events/{job_id}              # Stream task progress (ASR processing, PDF parsing)
```

---

## 6. Key Implementation Details

### 6.1 PDF Rule Extraction Pipeline

1. `pdfplumber` extracts raw text page-by-page, preserving page numbers.
2. Text is chunked into sections (heading-based splitting).
3. Each chunk is sent to OpenAI GPT-4o with a structured output schema:
   ```json
   {
     "rules": [
       {
         "rule_type": "SpeakerFormatting",
         "rule_text": "Speaker labels must be formatted as ...",
         "source_page": 3
       }
     ]
   }
   ```
4. The response is validated with Pydantic and bulk-inserted into `StyleGuideRules`.
5. Admin sees extracted rules in `RuleViewer` before activating the version.

### 6.2 ASR Integration (AssemblyAI)

1. Audio file is uploaded to AssemblyAI via their SDK.
2. `speaker_labels=True`, `word_boost` populated from active filler-word rules.
3. Polling loop (or webhook) waits for completion; Celery task updates job status.
4. On completion, word-level `utterances` are stored in `WordTimestamps`; speaker segments stored in `TranscriptSegments`.

### 6.3 Validation Engine

The validator is rule-type–driven. For each active `StyleGuideRule`:

| rule_type | Validation strategy |
|---|---|
| `FillerWords` | Regex scan for each word listed in `rule_text` |
| `SpeakerFormatting` | Regex match against speaker label pattern extracted from `rule_text` |
| `TagUsage` | Check for required/forbidden tags via regex |
| `Punctuation` | Pattern matching (sentence-ending punctuation, comma rules, etc.) |
| `Capitalization` | First word of sentence capitalization check |
| `Timestamps` | Detect missing/malformed timestamp markers |
| `Other` | LLM-based check: send segment + rule to GPT-4o, ask "does this text violate this rule?" (cached per rule+segment hash) |

The `Other` category uses LLM-as-judge with response caching to avoid repeated API calls for unchanged text.

### 6.4 Editor (Slate.js)

- Each transcript segment is a Slate `Element` node.
- Each word within a segment is a Slate `Text` leaf with custom properties: `wordId`, `startTime`, `endTime`, `confidence`, `validationErrors[]`.
- Decorations are computed from `validationErrors` and `confidence` and applied as Slate decorations (non-destructive overlays).
- `useAudioSync` hook subscribes to WaveSurfer's `timeupdate` event and sets the currently active word via Zustand, which re-renders the relevant `WordSpan`.

### 6.5 Audio Alignment

- On editor load, word timestamps are fetched and stored in a sorted array in `editorStore`.
- Binary search (`O(log n)`) maps current playback time → active word index.
- Click on a word → call `wavesurfer.seekTo(startTime / duration)`.
- On manual edit of a word, the word's `alignment_source` is set to `manual`; timestamp range preserved from original ASR output.

### 6.6 Export

| Format | Implementation |
|---|---|
| `.txt` | Python string template; applies active speaker label format from rules |
| `.docx` | `python-docx` — paragraphs per segment with speaker bold label |
| `.json` | Direct serialization of `TranscriptSegments` + `WordTimestamps` |
| TranscribeMe | `.txt` with header/footer pattern extracted from style guide rules tagged as `Other` with "submission format" context |

---

## 7. Delivery Phases

### Phase 1 — Project Scaffolding & Infrastructure
- Initialize monorepo structure (backend + frontend dirs)
- Docker Compose: PostgreSQL 15, Redis, backend, frontend
- FastAPI app factory with health endpoint
- Alembic migration: all tables from schema
- Vite + React + TypeScript + Tailwind bootstrap
- `.env.example` with all required env var keys
- `.gitignore` covering `node_modules/`, `dist/`, `__pycache__/`, `*.env`, `uploads/`

### Phase 2 — Style Guide Ingestion & Versioning
- `POST /api/style-guides/upload` endpoint + file storage
- `pdf_parser.py` service (pdfplumber)
- `rule_extractor.py` service (OpenAI GPT-4o structured output)
- Celery task: `extract_rules_from_pdf`
- `PATCH /api/style-guides/{id}/activate` + revalidation trigger
- Admin UI: `StyleGuideUpload`, `RuleViewer`, `VersionSwitcher`
- Tests: PDF parsing with fixture PDF, rule extraction with mocked OpenAI

### Phase 3 — Audio Upload & ASR
- `POST /api/audio/upload` endpoint + file storage
- `asr.py` service (AssemblyAI SDK)
- Celery task: `transcribe_audio`
- Store `WordTimestamps` + `TranscriptSegments` on completion
- SSE endpoint for job progress
- `GET /api/transcripts/{id}` returning full structured response
- Tests: ASR service with mocked AssemblyAI, segment/word storage

### Phase 4 — Transcription Editor
- `EditorPage` with Slate.js editor
- `AudioPlayer` with WaveSurfer.js waveform
- `useAudioSync` hook (click-to-seek, highlight-on-playback)
- `EditorToolbar` with tag/speaker/timestamp insertion
- Keyboard shortcut hook
- `PATCH` segment save endpoint + optimistic update
- Tests: `useAudioSync` hook, `WordSpan` rendering

### Phase 5 — Rule Validation & Confidence Review
- `validator.py` service implementing all rule_type strategies
- `POST /api/validation/run` + background revalidation task
- `ValidationPanel` component with jump-to-error links
- Inline Slate decorations for validation errors
- Confidence threshold highlighting in editor
- Review Queue panel
- Tests: validator unit tests for each rule_type, ValidationPanel rendering

### Phase 6 — Export System
- `exporter.py` service (TXT, DOCX, JSON, TranscribeMe)
- `POST /api/export` endpoint returning file download
- `ExportDialog` frontend component
- Auto-fix prompt before export
- Tests: exporter unit tests for all four formats

---

## 8. Verification Approach

### Backend
```bash
# From backend/
ruff check .              # lint
mypy app/                 # type check
pytest tests/ -v          # unit + integration tests
```

### Frontend
```bash
# From frontend/
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm run test              # vitest
npm run build             # production build (must succeed with 0 errors)
```

### Integration smoke test (manual, per phase)
Each phase ends with a manual walkthrough of the new feature against the acceptance criteria in `requirements.md §8`.

---

## 9. Environment Variables

```ini
# Backend .env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/transcribe
REDIS_URL=redis://localhost:6379/0
STORAGE_BACKEND=local          # local | s3
STORAGE_PATH=./uploads         # used when STORAGE_BACKEND=local
S3_BUCKET=
S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
OPENAI_API_KEY=
ASSEMBLYAI_API_KEY=
LLM_MODEL=gpt-4o
CONFIDENCE_THRESHOLD=0.75
```

All keys are loaded via `pydantic-settings` `BaseSettings`; missing required keys raise a startup error.

---

## 10. Security Notes

- Uploaded files are stored in `STORAGE_PATH` (outside web root).
- File type validation on upload: MIME type check + extension whitelist.
- All API keys loaded from environment; never logged or returned in API responses.
- SQL injection prevented by SQLAlchemy parameterized queries.
- No authentication system in v1 (assumed single-user local deployment); JWT middleware stub to be enabled in v2.
