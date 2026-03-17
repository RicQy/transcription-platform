# Technical Specification
## TranscribeMe-Compatible Transcription Platform

**Version**: 1.0  
**Date**: 2026-03-15  
**Based on PRD**: requirements.md

---

## 1. Technical Context

### Monorepo Layout

```
transcribe-platform/
├── apps/
│   ├── web/              # React 18 SPA (TypeScript)
│   └── api/              # Node.js Express API (TypeScript)
├── services/
│   └── asr-worker/       # Python FastAPI microservice
├── packages/
│   └── shared-types/     # Shared TypeScript types (DTOs, enums)
├── docker-compose.yml
├── .env.example
└── package.json          # Root workspace (pnpm workspaces)
```

### Language & Runtime Versions

| Layer | Runtime | Version |
|-------|---------|---------|
| Frontend | Node.js | 20 LTS |
| Backend API | Node.js | 20 LTS |
| ASR Worker | Python | 3.11 |
| Database | PostgreSQL | 15 |
| Cache / Queue | Redis | 7 |

---

## 2. Dependency Inventory

### `apps/web` (React SPA)

| Package | Purpose |
|---------|---------|
| `react` `react-dom` | UI framework |
| `typescript` | Static typing |
| `vite` | Build tooling |
| `tailwindcss` | Utility CSS |
| `@tiptap/react` `@tiptap/starter-kit` | Rich-text transcript editor |
| `wavesurfer.js` | Audio waveform + playback |
| `@tanstack/react-query` | Server state management |
| `zustand` | Client-side UI state |
| `react-router-dom` v6 | SPA routing |
| `axios` | HTTP client |
| `socket.io-client` | Real-time job status |
| `docx` | Client-side DOCX export |
| `zod` | Runtime form validation |
| `react-hook-form` | Form management |

### `apps/api` (Express API)

| Package | Purpose |
|---------|---------|
| `express` | HTTP framework |
| `typescript` `ts-node` | Language + runtime |
| `prisma` `@prisma/client` | ORM + migrations |
| `bullmq` | Job queue |
| `ioredis` | Redis client |
| `socket.io` | WebSocket server |
| `pdf-parse` | PDF text extraction |
| `openai` | GPT-4o rule extraction & validation codegen |
| `multer` | Multipart file upload |
| `jsonwebtoken` | JWT auth |
| `bcrypt` | Password hashing |
| `zod` | Request validation |
| `cors` `helmet` | Security middleware |
| `winston` | Structured logging |
| `jest` `ts-jest` `supertest` | Testing |

### `services/asr-worker` (Python)

| Package | Purpose |
|---------|---------|
| `fastapi` `uvicorn` | HTTP microservice |
| `faster-whisper` | ASR (word-level timestamps) |
| `pyannote.audio` | Speaker diarization |
| `pydantic` v2 | Request/response models |
| `httpx` | Callback to API on completion |
| `pytest` | Testing |

---

## 3. Architecture & Implementation Approach

### 3.1 Service Communication

```
Browser (React SPA)
    │  REST + WS
    ▼
apps/api  (Express + Socket.io)
    │
    ├── PostgreSQL (Prisma)
    ├── Redis (BullMQ jobs)
    │       │
    │       └──► ASR Worker (Python FastAPI)
    │                  └── calls back to api/webhooks/asr-complete
    │
    └── OpenAI API  (rule extraction, validation codegen)
```

**Job flow**:
1. `POST /api/audio` → store file → enqueue `asr` BullMQ job → return `audio_id`
2. BullMQ worker calls Python ASR Worker via HTTP `POST /transcribe`
3. ASR Worker returns word-level JSON → BullMQ worker writes to DB → emits WebSocket event `transcript:ready`

### 3.2 Auth Strategy

- JWT access tokens (15 min expiry) + refresh tokens (7 days) stored in `httpOnly` cookies
- Two roles: `admin`, `transcriptionist` enforced via middleware `requireRole()`
- `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`

### 3.3 Style Guide Ingestion Pipeline

```
PDF Upload
    │
    ▼
pdf-parse → raw text with page markers
    │
    ▼
OpenAI GPT-4o (structured output / JSON mode)
    Prompt: "Extract all transcription rules from the following style guide text.
             Return a JSON array of {rule_type, rule_text, source_page}."
    │
    ▼
Validate with Zod schema
    │
    ▼
Persist to StyleGuideRules (Prisma)
    │
    ▼ (on guide activation)
OpenAI GPT-4o (validation codegen)
    Prompt: "Convert this rule into a JavaScript function:
             (segmentText: string) => ValidationError[]
             Rule: <rule_text>"
    │
    ▼
Store validation_logic (JS function string) in StyleGuideRules.validation_logic
```

**Rule type enum** (extensible):
```typescript
type RuleType =
  | 'SpeakerFormatting'
  | 'TagUsage'
  | 'FillerWordHandling'
  | 'PunctuationConvention'
  | 'CapitalizationRule'
  | 'TimestampRequirement'
  | 'FormattingExample'
  | 'Other'
```

### 3.4 Runtime Validation Execution

Stored `validation_logic` strings are executed in the browser using `new Function()` inside a try/catch sandbox. Each rule function has the signature:

```typescript
type ValidationFn = (text: string) => Array<{
  start: number
  end: number
  message: string
  errorType: ErrorType
}>
```

The frontend fetches active rules on editor mount, compiles them into `ValidationFn[]`, runs them debounced (500 ms) on every editor change, and renders inline decorations via TipTap's `Decoration` API.

### 3.5 Audio–Text Alignment

- Word-level `{word, start_time, end_time, confidence, speaker_id}` stored in `TranscriptSegments.word_data` (JSONB)
- Frontend maps editor character positions → word tokens using a cursor-position index built on segment load
- WaveSurfer `timeupdate` event → binary search on `word_data` array → TipTap mark highlights current word
- Click on TipTap node → read data attribute `data-start` → `wavesurfer.seekTo()`

### 3.6 Transcript Editor Architecture

TipTap document model:

```
Document
  └── TranscriptBlock (custom node, per speaker segment)
        ├── SpeakerLabel (inline node, contenteditable=false)
        └── Paragraph
              └── WordMark (decoration, carries data-start/end/confidence)
```

Custom TipTap extensions required:
- `TranscriptBlockNode` — wraps a speaker segment
- `SpeakerLabelNode` — non-editable inline speaker chip
- `WordTimestampDecoration` — decorates each word span
- `ValidationUnderlineDecoration` — overlaid underline for rule violations
- `LowConfidenceDecoration` — yellow highlight for confidence < 0.7
- `TagNode` — renders `[inaudible]`, `[crosstalk]` etc. as inline chips

### 3.7 Export Implementation

All exports generated server-side at `GET /api/transcripts/:id/export?format=txt|docx|json|transcribeme`:

- **TXT**: template string built from active style guide's `SpeakerFormatting` and `TimestampRequirement` rules
- **DOCX**: `docx` npm package (server-side), paragraphs built from segments
- **JSON**: direct Prisma query result serialized
- **TranscribeMe**: TXT variant where speaker format and timestamp format are resolved from active guide rules (no hardcoded template)

---

## 4. Source Code Structure

### `apps/api/src/`

```
apps/api/src/
├── index.ts                     # Server bootstrap
├── config/
│   ├── env.ts                   # Zod-validated env vars
│   └── prisma.ts                # Prisma singleton
├── middleware/
│   ├── auth.ts                  # JWT verify, requireRole()
│   ├── errorHandler.ts
│   └── upload.ts                # multer config
├── routes/
│   ├── auth.ts
│   ├── audio.ts
│   ├── transcripts.ts
│   ├── styleGuide.ts
│   └── export.ts
├── services/
│   ├── asrQueue.ts              # BullMQ producer
│   ├── asrWorker.ts             # BullMQ consumer (calls Python)
│   ├── pdfParser.ts             # pdf-parse wrapper
│   ├── ruleExtractor.ts         # OpenAI GPT-4o rule extraction
│   ├── validationCodegen.ts     # OpenAI GPT-4o JS function generation
│   ├── revalidationQueue.ts     # BullMQ producer for re-validation
│   ├── revalidationWorker.ts    # BullMQ consumer: runs server-side validation
│   └── exportService.ts         # TXT / DOCX / JSON / TranscribeMe
├── sockets/
│   └── index.ts                 # Socket.io event handlers
└── utils/
    └── logger.ts
```

### `apps/web/src/`

```
apps/web/src/
├── main.tsx
├── App.tsx                      # Router root
├── api/                         # Axios + react-query hooks
│   ├── audio.ts
│   ├── transcripts.ts
│   ├── styleGuide.ts
│   └── auth.ts
├── store/
│   ├── authStore.ts             # Zustand: user session
│   ├── editorStore.ts           # Zustand: playback time, validation errors
│   └── styleGuideStore.ts       # Zustand: active rules cache
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── AudioUploadPage.tsx
│   ├── EditorPage.tsx
│   └── admin/
│       ├── StyleGuideListPage.tsx
│       ├── StyleGuideUploadPage.tsx
│       └── RuleEditorPage.tsx
├── components/
│   ├── editor/
│   │   ├── TranscriptEditor.tsx      # TipTap root
│   │   ├── AudioPlayer.tsx           # WaveSurfer wrapper
│   │   ├── ValidationPanel.tsx
│   │   ├── ReviewSuggestionsPanel.tsx
│   │   ├── TagPicker.tsx
│   │   └── extensions/
│   │       ├── TranscriptBlockNode.ts
│   │       ├── SpeakerLabelNode.ts
│   │       ├── WordTimestampPlugin.ts
│   │       ├── ValidationPlugin.ts
│   │       └── LowConfidencePlugin.ts
│   ├── ui/                           # Reusable primitives (Button, Modal, etc.)
│   └── layout/
│       ├── AppShell.tsx
│       └── Sidebar.tsx
└── hooks/
    ├── useValidation.ts          # Debounced validation runner
    ├── useAudioSync.ts           # WaveSurfer ↔ TipTap sync
    └── useAutoSave.ts            # 30 s interval + blur save
```

### `services/asr-worker/`

```
services/asr-worker/
├── main.py                      # FastAPI app
├── models.py                    # Pydantic request/response models
├── asr.py                       # faster-whisper wrapper
├── diarization.py               # pyannote.audio wrapper
├── merger.py                    # Merge ASR + diarization → unified output
└── tests/
    └── test_asr.py
```

---

## 5. Data Model & API Interface Changes

### 5.1 Prisma Schema (key models)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(TRANSCRIPTIONIST)
  createdAt    DateTime @default(now())
  transcripts  Transcript[]
}

enum Role { ADMIN TRANSCRIPTIONIST }

model AudioFile {
  id         String      @id @default(uuid())
  filename   String
  filePath   String
  duration   Float?
  uploadDate DateTime    @default(now())
  status     AudioStatus @default(QUEUED)
  transcripts Transcript[]
}

enum AudioStatus { QUEUED PROCESSING COMPLETE ERROR }

model Transcript {
  id                  String              @id @default(uuid())
  audioFileId         String
  audioFile           AudioFile           @relation(fields: [audioFileId], references: [id])
  version             Int                 @default(1)
  styleGuideVersionId String?
  styleGuideVersion   StyleGuideDocument? @relation(fields: [styleGuideVersionId], references: [id])
  lastModified        DateTime            @updatedAt
  segments            TranscriptSegment[]
  validationErrors    ValidationError[]
}

model TranscriptSegment {
  id           String   @id @default(uuid())
  transcriptId String
  transcript   Transcript @relation(fields: [transcriptId], references: [id])
  speaker      String
  text         String
  startTime    Float
  endTime      Float
  confidence   Float?
  wordData     Json
  validationErrors ValidationError[]
}

model StyleGuideDocument {
  id          String    @id @default(uuid())
  pdfFilePath String
  uploadDate  DateTime  @default(now())
  version     String
  isActive    Boolean   @default(false)
  parsedAt    DateTime?
  rules       StyleGuideRule[]
  transcripts Transcript[]
}

model StyleGuideRule {
  id               String    @id @default(uuid())
  guideId          String
  guide            StyleGuideDocument @relation(fields: [guideId], references: [id])
  ruleType         String
  ruleText         String
  validationLogic  String?
  sourcePage       Int?
  isActive         Boolean   @default(true)
  validationErrors ValidationError[]
}

model ValidationError {
  id            String    @id @default(uuid())
  transcriptId  String
  transcript    Transcript @relation(fields: [transcriptId], references: [id])
  segmentId     String
  segment       TranscriptSegment @relation(fields: [segmentId], references: [id])
  ruleId        String?
  rule          StyleGuideRule? @relation(fields: [ruleId], references: [id])
  errorType     String
  positionStart Int
  positionEnd   Int
  message       String
  isResolved    Boolean   @default(false)
}
```

### 5.2 REST API Endpoints

#### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Email+password → JWT cookies |
| POST | `/api/auth/refresh` | Rotate access token |
| POST | `/api/auth/logout` | Clear cookies |

#### Audio
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/audio` | Upload audio file (multipart) |
| GET | `/api/audio` | List audio files for current user |
| GET | `/api/audio/:id` | Audio file metadata + status |
| GET | `/api/audio/:id/stream` | Serve audio bytes (range requests) |

#### Transcripts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transcripts/:id` | Full transcript with segments |
| PUT | `/api/transcripts/:id/segments` | Batch save edited segments |
| POST | `/api/transcripts/:id/validate` | Trigger on-demand validation |
| GET | `/api/transcripts/:id/errors` | List validation errors |
| PATCH | `/api/transcripts/:id/errors/:errId` | Mark error resolved |

#### Style Guide
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/style-guide` | Upload PDF → parse + extract rules |
| GET | `/api/style-guide` | List all guide versions |
| GET | `/api/style-guide/:id/rules` | List rules for a guide version |
| POST | `/api/style-guide/:id/activate` | Set as active, queue re-validation |
| POST | `/api/style-guide/:id/rules` | Manually add a rule |
| PUT | `/api/style-guide/:id/rules/:ruleId` | Edit a rule |
| DELETE | `/api/style-guide/:id/rules/:ruleId` | Delete a rule |

#### Export
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transcripts/:id/export` | `?format=txt\|docx\|json\|transcribeme` |

### 5.3 WebSocket Events (Socket.io)

| Event | Direction | Payload |
|-------|-----------|---------|
| `transcript:status` | Server → Client | `{audioId, status, progress}` |
| `transcript:ready` | Server → Client | `{transcriptId}` |
| `transcript:revalidating` | Server → Client | `{transcriptId, guideVersion}` |
| `transcript:revalidated` | Server → Client | `{transcriptId, errorCount}` |

### 5.4 ASR Worker HTTP API

`POST /transcribe`
```json
{
  "audio_path": "/data/audio/uuid.mp3",
  "audio_id": "uuid",
  "model_size": "medium",
  "callback_url": "http://api:3001/internal/asr-complete"
}
```

`POST /internal/asr-complete` (callback to API)
```json
{
  "audio_id": "uuid",
  "status": "complete",
  "words": [
    {"word": "Hello", "start": 0.0, "end": 0.4, "confidence": 0.98, "speaker_id": "SPEAKER_00"}
  ]
}
```

---

## 6. Environment Variables

```env
# apps/api
DATABASE_URL=postgresql://user:pass@localhost:5432/transcribe
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
JWT_REFRESH_SECRET=...
OPENAI_API_KEY=...
ASR_WORKER_URL=http://asr-worker:8000
FILE_STORAGE_PATH=/data
WHISPER_MODEL_SIZE=medium

# services/asr-worker
PYANNOTE_AUTH_TOKEN=...   # HuggingFace token for pyannote model
FILE_STORAGE_PATH=/data
```

---

## 7. Delivery Phases

### Phase 1 — Infrastructure & Auth (Milestone: Login works)
- Monorepo scaffold (pnpm workspaces, tsconfig, eslint, prettier)
- Docker Compose: postgres, redis, api, web, asr-worker
- Prisma schema + migrations
- Auth endpoints + JWT middleware
- Login/logout UI

### Phase 2 — Audio Upload & ASR (Milestone: Audio transcribed, viewable as raw JSON)
- `POST /api/audio` with multer
- BullMQ ASR job producer + consumer
- Python ASR Worker (`faster-whisper` + `pyannote.audio`)
- Callback → store segments in DB
- Audio status WebSocket updates
- Dashboard listing audio files + status

### Phase 3 — Transcript Editor (Milestone: Edit transcript in sync with audio)
- TipTap editor with custom nodes (TranscriptBlock, SpeakerLabel, WordMark)
- WaveSurfer.js audio player
- Audio ↔ text sync (click-to-seek, word highlight on playback)
- Auto-save + undo/redo
- `PUT /api/transcripts/:id/segments`

### Phase 4 — Style Guide Ingestion (Milestone: Upload PDF, view extracted rules)
- `POST /api/style-guide` → pdf-parse → GPT-4o extraction → DB persist
- Admin rule review table
- Manual rule CRUD
- Style guide versioning + activation endpoint

### Phase 5 — Rule Validation (Milestone: Violations highlighted while editing)
- GPT-4o validation codegen on guide activation
- Frontend rule fetching + `new Function()` compilation
- TipTap ValidationPlugin (debounced, decoration API)
- ValidationPanel sidebar
- `POST /api/transcripts/:id/validate` (server-side re-validation)
- BullMQ re-validation queue (triggered on guide version change)

### Phase 6 — AI Accuracy Review (Milestone: Low-confidence words flagged)
- LowConfidencePlugin (confidence < 0.7 → yellow highlight)
- ReviewSuggestionsPanel (sorted list, click-to-seek)
- Mark-as-verified PATCH endpoint

### Phase 7 — Export (Milestone: Download TXT, DOCX, JSON)
- `GET /api/transcripts/:id/export`
- TXT, DOCX, JSON, TranscribeMe format implementations in `exportService.ts`
- Export formats parameterized by active style guide rules

### Phase 8 — Polish & NFRs (Milestone: Production-ready)
- WCAG 2.1 AA audit + fixes
- Keyboard shortcuts (configurable)
- Large file handling (2 GB, streaming upload)
- Performance test: 50,000-word transcript editor responsiveness
- End-to-end tests (Playwright)

---

## 8. Verification Approach

### Linting & Formatting
```bash
# Root
pnpm lint          # eslint across all apps
pnpm format:check  # prettier
```

### Type Checking
```bash
pnpm typecheck     # tsc --noEmit across all TS packages
```

### Unit & Integration Tests
```bash
# API
cd apps/api && pnpm test          # jest + supertest
# Web
cd apps/web && pnpm test          # vitest + react-testing-library
# ASR Worker
cd services/asr-worker && pytest
```

### E2E Tests
```bash
pnpm e2e   # Playwright (Phase 8)
```

### Key test scenarios:
- PDF upload → rules extracted → stored in DB (API integration test)
- Guide activation → `validation_logic` generated for each rule (API integration test + OpenAI mock)
- Validation plugin fires on editor change and decorates violations (vitest + TipTap test harness)
- ASR callback → segments stored → WebSocket event emitted (API integration test with mock Python worker)
- Export endpoint returns correct format for each `format` param (API integration test)
- Auth middleware blocks unauthenticated and wrong-role requests (API unit test)

---

## 9. Key Technical Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| TipTap over ProseMirror direct | TipTap provides a React-native API; raw ProseMirror is lower-level and requires more boilerplate |
| `new Function()` for validation | Allows LLM-generated JS to run in browser without a separate server round-trip per keystroke; sandboxed to string input only |
| Server-side re-validation queue | Ensures all transcripts are re-checked on guide change without blocking the UI; results stored in DB |
| Python microservice for ASR | `faster-whisper` and `pyannote.audio` are Python-only libraries; isolating them avoids forcing Node.js to shell-exec Python |
| JSONB for word_data | Word arrays vary in length and don't need relational queries; JSONB avoids a large join table |
| GPT-4o structured output | Reliable JSON extraction without brittle regex parsing of the PDF text |
| pnpm workspaces | Monorepo dependency deduplication; faster installs vs npm workspaces |
