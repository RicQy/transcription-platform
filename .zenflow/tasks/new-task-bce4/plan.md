# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: c8e390ef-0b18-47a2-bcbf-23f8a7610fc0 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: bf2fc3e7-d09a-449a-9ae7-2626b07e936f -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

### [ ] Step 1: Project Scaffolding & Infrastructure
<!-- chat-id: 0d3bbc73-68a0-4d7c-b899-e3c10e1ff385 -->

Set up the full monorepo structure, Docker environment, and base application skeletons.

- Create `transcription-platform/` monorepo with `backend/` and `frontend/` directories
- Create `.gitignore` at repo root covering `node_modules/`, `dist/`, `build/`, `__pycache__/`, `*.pyc`, `.env`, `uploads/`, `*.log`, `.cache/`
- Create `docker-compose.yml` with services: `postgres` (PostgreSQL 15), `redis` (Redis 7), `backend` (FastAPI), `frontend` (Vite dev server), `worker` (Celery)
- Bootstrap FastAPI app:
  - `backend/app/main.py` — app factory with CORS, router registration, `/health` endpoint
  - `backend/app/config.py` — `pydantic-settings` `BaseSettings` loading all env vars from spec §9
  - `backend/app/database.py` — async SQLAlchemy engine + `AsyncSession` dependency
  - `backend/pyproject.toml` — all Python deps from spec §1
  - `backend/.env.example` — all env var keys with placeholder values
- Bootstrap all SQLAlchemy ORM models in `backend/app/models/` (audio, transcript, style_guide, validation) with all columns from requirements §6 schema; UUID PKs via `gen_random_uuid()`
- Configure Alembic: `alembic/env.py` using async engine; create initial migration generating all tables
- Bootstrap Celery app in `backend/app/tasks/celery_app.py` connected to Redis
- Bootstrap Vite + React + TypeScript + Tailwind frontend:
  - `frontend/package.json` with all frontend deps from spec §1
  - `frontend/vite.config.ts`, `frontend/tsconfig.json`
  - `frontend/src/main.tsx`, `frontend/src/App.tsx` with React Router skeleton (Dashboard, Editor, Admin pages)
  - Tailwind configured via `tailwind.config.js` and `postcss.config.js`
- Shared TypeScript types in `frontend/src/types/` (transcript.ts, styleGuide.ts, validation.ts)
- **Tests**:
  - `backend/tests/conftest.py` — async test DB setup (SQLite in-memory via `aiosqlite`)
  - `backend/tests/test_routers/test_health.py` — assert `/health` returns 200
  - `frontend/src/tests/App.test.tsx` — renders without crash
- **Verification**: `docker compose up --build` starts all services; `ruff check .` passes; `mypy app/` passes; `npm run build` succeeds; `pytest tests/ -v` passes; `npm run test` passes

### [ ] Step 2: Style Guide Ingestion & PDF Rule Extraction

Implement the PDF upload, parsing, and AI-powered rule extraction pipeline.

- `backend/app/services/storage.py` — `StorageService` abstraction: `save_file(bytes, filename) -> str` and `get_file(path) -> bytes`; local-fs backend (reads `STORAGE_BACKEND` and `STORAGE_PATH` from config); S3 backend stub
- `backend/app/routers/style_guides.py`:
  - `POST /api/style-guides/upload` — accept `multipart/form-data` PDF; save via `StorageService`; create `StyleGuideDocuments` row with auto-incremented version; enqueue `extract_rules_from_pdf` Celery task; return `{guide_id, status: "processing"}`
  - `GET /api/style-guides` — list all guide versions ordered by version desc
  - `GET /api/style-guides/{guide_id}/rules` — list extracted `StyleGuideRules` for a guide
  - `PATCH /api/style-guides/{guide_id}/activate` — set `is_active=True` for guide, `is_active=False` for all others (atomic); enqueue `revalidate_all_transcripts` task; return updated guide
- `backend/app/services/pdf_parser.py` — `parse_pdf(path: str) -> list[PageChunk]`: uses `pdfplumber` to extract text page-by-page; splits into heading-based chunks; returns `[{page: int, text: str}]`
- `backend/app/services/rule_extractor.py` — `extract_rules(chunks: list[PageChunk], guide_id: UUID) -> list[RuleCreate]`: sends each chunk to OpenAI GPT-4o with structured output schema `{rules: [{rule_type, rule_text, source_page}]}`; validates via Pydantic; returns rule list
- `backend/app/tasks/pdf_tasks.py` — `extract_rules_from_pdf(guide_id)` Celery task: load PDF from storage → `parse_pdf` → `extract_rules` → bulk-insert into `StyleGuideRules`; update guide status to `ready`
- `backend/app/schemas/style_guide.py` — Pydantic request/response schemas for all style guide endpoints
- **Tests**:
  - `backend/tests/test_services/test_pdf_parser.py` — fixture: minimal 2-page PDF bytes; assert chunks extracted with correct page numbers
  - `backend/tests/test_services/test_rule_extractor.py` — mock OpenAI client; assert rules parsed and typed correctly for each `rule_type` enum value
  - `backend/tests/test_routers/test_style_guides.py` — upload PDF endpoint returns 200 with `guide_id`; list guides; get rules; activate guide (mock Celery tasks)
- **Verification**: `ruff check .`, `mypy app/`, `pytest tests/ -v`

### [ ] Step 3: Style Guide Admin UI

Build the React admin interface for style guide management.

- `frontend/src/api/styleGuideApi.ts` — typed Axios functions: `uploadStyleGuide(file)`, `listStyleGuides()`, `getGuideRules(guideId)`, `activateGuide(guideId)`
- `frontend/src/store/styleGuideStore.ts` — Zustand store: `activeGuide`, `rules`, `guides` list; actions `setActiveGuide`, `setRules`
- `frontend/src/components/admin/StyleGuideUpload.tsx` — drag-and-drop PDF upload; shows upload progress via SSE (`GET /api/events/{job_id}`); displays success/error state
- `frontend/src/components/admin/RuleViewer.tsx` — table of extracted rules grouped by `rule_type`; shows `rule_text` and `source_page`; read-only
- `frontend/src/components/admin/VersionSwitcher.tsx` — dropdown/list of all guide versions; "Activate" button per version; shows currently active badge; confirmation dialog before activation
- `frontend/src/pages/AdminPage.tsx` — composes `StyleGuideUpload`, `VersionSwitcher`, `RuleViewer`; uses React Query for data fetching
- SSE endpoint `GET /api/events/{job_id}` in `backend/app/routers/style_guides.py` — streams `{status, progress}` events for Celery task progress (poll Celery result backend)
- **Tests**:
  - `frontend/src/tests/StyleGuideUpload.test.tsx` — renders upload zone; shows error on non-PDF
  - `frontend/src/tests/RuleViewer.test.tsx` — renders rule rows from mock data
  - `frontend/src/tests/VersionSwitcher.test.tsx` — shows active badge on active version; calls activate on button click
- **Verification**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

### [ ] Step 4: Audio Upload & ASR Transcription

Implement audio upload, AssemblyAI transcription, and transcript storage.

- `backend/app/routers/audio.py`:
  - `POST /api/audio/upload` — accept audio file (MP3/WAV/M4A/FLAC/OGG); save via `StorageService`; create `AudioFiles` row; create `Transcripts` row with `status=processing`; enqueue `transcribe_audio` task; return `{audio_id, transcript_id}`
  - `GET /api/audio/{audio_id}/status` — return ASR job status from Celery result
- `backend/app/routers/transcripts.py`:
  - `GET /api/transcripts/{transcript_id}` — return transcript with nested `TranscriptSegments` and `WordTimestamps`; include `status`
  - `PATCH /api/transcripts/{transcript_id}/segments/{segment_id}` — update segment `text`; mark affected word timestamps `alignment_source=manual`; return updated segment
- `backend/app/services/asr.py` — `AssemblyAIService`: `submit(audio_path) -> job_id`; `get_result(job_id) -> ASRResult`; uses `assemblyai` SDK with `speaker_labels=True`; maps SDK response to internal `ASRResult(segments, words)` dataclass
- `backend/app/tasks/asr_tasks.py` — `transcribe_audio(audio_id, transcript_id)` Celery task: load audio from storage → `asr.submit` → poll until complete → store `TranscriptSegments` and `WordTimestamps` → update `Transcripts.status=ready`; emit SSE progress events
- `backend/app/schemas/audio.py`, `backend/app/schemas/transcript.py` — Pydantic schemas for all audio/transcript endpoints
- **Tests**:
  - `backend/tests/test_services/test_asr.py` — mock `assemblyai` SDK; assert `AssemblyAIService.submit` sends correct params; assert result mapping produces correct `TranscriptSegments` and `WordTimestamps`
  - `backend/tests/test_routers/test_audio.py` — upload endpoint returns 200 with ids; status endpoint returns processing/ready; transcript GET returns nested structure with segments and words
  - `backend/tests/test_routers/test_transcripts.py` — segment PATCH updates text; marks word as manual
- **Verification**: `ruff check .`, `mypy app/`, `pytest tests/ -v`

### [ ] Step 5: Dashboard & Audio Upload UI

Build the frontend dashboard and audio upload flow.

- `frontend/src/api/audioApi.ts` — `uploadAudio(file)`, `getAudioStatus(audioId)`, `getTranscript(transcriptId)`, `updateSegment(transcriptId, segmentId, text)`
- `frontend/src/api/transcriptApi.ts` — typed Axios wrappers for transcript endpoints
- `frontend/src/components/audio/AudioUpload.tsx` — file input accepting audio MIME types; upload progress bar; polls `/api/audio/{id}/status` (or SSE) until `ready`; navigates to editor on completion
- `frontend/src/pages/DashboardPage.tsx` — lists all transcripts with status badges; `AudioUpload` component embedded; link to editor per transcript
- `frontend/src/store/editorStore.ts` — Zustand store: `transcript`, `segments`, `wordTimestamps`, `currentTime`, `activeWordId`, `playbackRate`; actions `setTranscript`, `updateSegment`, `setCurrentTime`
- **Tests**:
  - `frontend/src/tests/AudioUpload.test.tsx` — renders input; shows progress on upload
  - `frontend/src/tests/DashboardPage.test.tsx` — renders transcript list from mock data
- **Verification**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

### [ ] Step 6: Transcription Editor — Audio Player & Alignment

Implement the WaveSurfer audio player and audio–text synchronization.

- `frontend/src/components/audio/AudioPlayer.tsx` — WaveSurfer.js wrapper component:
  - Renders waveform canvas
  - Exposes play/pause, seek, playback rate controls (0.5×–2×)
  - Rewind 5s button + `F2` keyboard shortcut
  - Emits `onTimeUpdate(time)` callback on `timeupdate` event
- `frontend/src/hooks/useAudioSync.ts`:
  - Subscribes to `AudioPlayer` time updates via `editorStore.currentTime`
  - Binary search over sorted `wordTimestamps` array to find active word at current time
  - Sets `editorStore.activeWordId`
  - `seekTo(wordId)` function: finds word's `start_time`, calls `wavesurfer.seekTo(start_time / duration)`
- `frontend/src/components/editor/WordSpan.tsx` — renders a single word as a `<span>`; reads `activeWordId` from store; applies `highlighted` CSS class when this word is active; `onClick` calls `seekTo(wordId)`; shows low-confidence styling when `confidence_score < threshold`
- `frontend/src/hooks/useKeyboardShortcuts.ts` — registers global `keydown` listeners: `F2`/configurable rewind; `Ctrl+Space` play/pause; `Ctrl+T` insert timestamp; `Ctrl+I` insert tag
- **Tests**:
  - `frontend/src/tests/useAudioSync.test.ts` — binary search finds correct word for given timestamps; edge cases (before first word, after last word)
  - `frontend/src/tests/WordSpan.test.tsx` — renders word text; applies highlight class when activeWordId matches; calls seekTo on click
- **Verification**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

### [ ] Step 7: Transcription Editor — Slate.js Editor & Toolbar

Build the rich-text transcript editor with Slate.js.

- `frontend/src/components/editor/TranscriptEditor.tsx` — Slate.js editor root:
  - Each `TranscriptSegment` is a Slate `Element` node of type `segment` with `speaker`, `segmentId`, `startTime`, `endTime` props
  - Each word within a segment is a Slate `Text` leaf with custom properties: `wordId`, `startTime`, `endTime`, `confidence`, `validationErrors[]`
  - Decorations computed from `validationErrors` and `confidence` applied as Slate decorations (non-destructive overlays)
  - On text change: debounced `updateSegment` API call (500ms); marks affected word timestamps as `manual`
  - Renders `SpeakerSegment` and `WordSpan` custom elements
- `frontend/src/components/editor/SpeakerSegment.tsx` — renders speaker label (bold, formatted per style guide) + editable content area
- `frontend/src/components/editor/EditorToolbar.tsx`:
  - "Insert Tag" dropdown (tags populated from active style guide `TagUsage` rules via store)
  - "Insert Speaker Label" button
  - "Insert Timestamp" button
  - Playback speed selector
  - Keyboard shortcut hints
- `frontend/src/pages/EditorPage.tsx` — composes `AudioPlayer`, `TranscriptEditor`, `EditorToolbar`, `ValidationPanel`; loads transcript on mount; handles save state
- **Tests**:
  - `frontend/src/tests/TranscriptEditor.test.tsx` — renders segments from mock transcript; editing a word calls updateSegment after debounce
  - `frontend/src/tests/EditorToolbar.test.tsx` — tag dropdown shows tags from mock style guide rules; insert tag appends correct text
  - `frontend/src/tests/SpeakerSegment.test.tsx` — renders speaker label and text content
- **Verification**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

### [ ] Step 8: Rule Validation Engine & Validation API

Implement the server-side rule validation engine and validation endpoints.

- `backend/app/services/validator.py` — `ValidationEngine`:
  - `validate(transcript_id, guide_id) -> list[ValidationError]`
  - Rule-type dispatch table:
    - `FillerWords`: regex scan for words listed in `rule_text`
    - `SpeakerFormatting`: regex match speaker label pattern extracted from `rule_text`
    - `TagUsage`: check required/forbidden tags via regex
    - `Punctuation`: sentence-ending punctuation + comma rules
    - `Capitalization`: first word of sentence capitalization check
    - `Timestamps`: detect missing/malformed timestamp markers
    - `Other`: LLM-as-judge via GPT-4o (`does this segment violate this rule?`); cache results by `hash(rule_id + segment_text)`
  - Returns list of `ValidationError` with `segment_id`, `rule_id`, `error_type`, `location` JSONB, `message`
- `backend/app/routers/validation.py`:
  - `POST /api/validation/run` — body `{transcript_id}`; run `ValidationEngine`; upsert `ValidationErrors` rows (mark previous errors resolved); return error list
  - `GET /api/validation/{transcript_id}` — return all unresolved `ValidationErrors` for transcript
- `backend/app/tasks/revalidation_tasks.py` — `revalidate_all_transcripts(guide_id)` Celery task: find all transcripts with this `active_guide_id`; run `validate()` for each; update DB
- `backend/app/schemas/validation.py` — Pydantic schemas
- **Tests**:
  - `backend/tests/test_services/test_validator.py` — unit tests for each rule_type strategy:
    - FillerWords: segment containing "um" flagged; clean segment not flagged
    - SpeakerFormatting: incorrect speaker label format flagged
    - TagUsage: missing `[inaudible]` where required flagged
    - Punctuation: missing period at sentence end flagged
    - Capitalization: lowercase sentence start flagged
    - Other: mock GPT-4o response; assert error created on violation response
  - `backend/tests/test_routers/test_validation.py` — POST run returns errors; GET returns stored errors; revalidation task triggered on guide activation
- **Verification**: `ruff check .`, `mypy app/`, `pytest tests/ -v`

### [ ] Step 9: Validation UI — Inline Highlights & Validation Panel

Integrate validation errors into the Slate editor and build the validation panel.

- `frontend/src/hooks/useValidation.ts`:
  - Debounced (2s) call to `POST /api/validation/run` after transcript edits
  - Stores errors in `editorStore` by `segment_id`
  - Exposes `errors`, `isValidating` state
- Update `TranscriptEditor.tsx` — Slate decorations for validation errors:
  - Color-coded underlines by `error_type`: `FORMATTING`=blue, `TAG_MISUSE`=orange, `PUNCTUATION`=yellow, `SPEAKER_LABEL`=purple, `FILLER_WORD`=red, `RULE_VIOLATION`=pink
  - Tooltip on hover showing `message` and violated `rule_text`
- Update `WordSpan.tsx` — apply low-confidence highlight (amber background) when `confidence_score < CONFIDENCE_THRESHOLD`
- `frontend/src/components/editor/ValidationPanel.tsx`:
  - Lists all current `ValidationErrors` grouped by `error_type`
  - Each error item shows message + "Jump to" link (calls `seekTo` or scrolls editor to segment)
  - Error count badge per category
  - "Review Queue" sub-panel: lists low-confidence words sorted by confidence ascending; click to jump to word
- Update `EditorPage.tsx` — integrate `useValidation` hook; display `ValidationPanel` in sidebar
- **Tests**:
  - `frontend/src/tests/useValidation.test.ts` — debounce fires after 2s; calls validation API; updates store
  - `frontend/src/tests/ValidationPanel.test.tsx` — renders error list from mock data; jump-to link calls seekTo
- **Verification**: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

### [ ] Step 10: Export System

Implement all export formats and the export UI.

- `backend/app/services/exporter.py` — `ExportService`:
  - `export_txt(transcript_id) -> bytes` — speaker-labeled plain text; applies active `SpeakerFormatting` rule for label format
  - `export_docx(transcript_id) -> bytes` — `python-docx`; bold speaker labels as paragraph headings; body text per segment
  - `export_json(transcript_id) -> bytes` — JSON serialization of `TranscriptSegments` + `WordTimestamps` including all timing data
  - `export_transcribeme(transcript_id) -> bytes` — `.txt` with header/footer pattern from style guide `Other` rules tagged with "submission format" context; falls back to plain TXT format if no such rule found
- `backend/app/routers/export.py`:
  - `POST /api/export` — body `{transcript_id, format: "txt"|"docx"|"json"|"transcribeme"}`; run appropriate exporter; return `FileResponse` with correct MIME type and `Content-Disposition: attachment` header
- `frontend/src/api/exportApi.ts` — `exportTranscript(transcriptId, format)` — triggers file download via Blob URL
- `frontend/src/components/export/ExportDialog.tsx`:
  - Modal with format selector (TXT, DOCX, JSON, TranscribeMe)
  - Shows count of unresolved validation errors
  - "Auto-fix and Export" checkbox — if checked, calls `POST /api/validation/run` auto-fix variants before export (filler word removal, speaker label correction)
  - Download button triggers export API call
- Update `EditorPage.tsx` — "Export" button opens `ExportDialog`
- **Tests**:
  - `backend/tests/test_services/test_exporter.py` — fixture transcript with 2 segments, 2 speakers: assert TXT contains speaker labels; assert DOCX has correct paragraphs; assert JSON contains `word_timestamps` array; assert TranscribeMe format matches rule-derived template
  - `backend/tests/test_routers/test_export.py` — POST with each format returns 200 with correct `Content-Type`
  - `frontend/src/tests/ExportDialog.test.tsx` — renders format options; download button calls export API
- **Verification**: `ruff check .`, `mypy app/`, `pytest tests/ -v`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

### [ ] Step 11: Integration Polish & End-to-End Smoke Test

Final wiring, error handling, and manual acceptance criteria verification.

- Add global error boundary in `frontend/src/App.tsx`
- Add toast notifications (use `sonner` or similar lightweight lib) for async operation feedback (upload complete, ASR done, export ready)
- Ensure all API error responses return consistent `{detail: string}` JSON shape from FastAPI exception handlers
- Verify Docker Compose `docker compose up --build` starts all 5 services cleanly
- Run manual acceptance criteria walkthrough from `requirements.md §8`:
  - [ ] Upload PDF → rules appear in RuleViewer
  - [ ] Upload audio → transcript appears in editor with speaker labels + playback highlights
  - [ ] Introduce style guide violation → highlighted within 2 seconds
  - [ ] Activate new guide version → validation errors update without page reload
  - [ ] Export produces valid `.txt`, `.docx`, `.json`
  - [ ] Swap style guide → validation behavior changes without code deployment
- Record any failures and fix before marking complete
- **Verification**: All backend and frontend lint/type/test commands pass; Docker build succeeds
