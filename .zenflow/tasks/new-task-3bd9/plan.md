# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 35543c01-bfa1-4fdb-a555-9b4616a82630 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 2fcaf97a-fbc4-4e0a-9ce8-37e3b74102e7 -->

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
<!-- chat-id: 8720c5a5-a11d-4340-acb5-0f5a084a8333 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

### [x] Step 1: Monorepo Scaffold & Infrastructure
<!-- chat-id: 2a53a931-4acd-4e3c-90bd-35970e2e2bf1 -->
Set up the full project skeleton so every subsequent step has a working foundation.

- Initialize pnpm workspace with `apps/web`, `apps/api`, `services/asr-worker`, `packages/shared-types`
- Create root `package.json` with pnpm workspaces config, root `tsconfig.base.json`, `.eslintrc.js`, `.prettierrc`
- Scaffold `apps/api`: Express + TypeScript (`tsconfig.json`, `src/index.ts`, `src/config/env.ts` with Zod-validated env), install all API dependencies listed in spec
- Scaffold `apps/web`: Vite + React 18 + TypeScript + TailwindCSS, install all web dependencies
- Scaffold `packages/shared-types`: shared DTO interfaces and enums (AudioStatus, Role, ErrorType, RuleType, WebSocket event payloads)
- Scaffold `services/asr-worker`: FastAPI app skeleton (`main.py`, `models.py`) with pyproject.toml / requirements.txt
- Create `docker-compose.yml` with services: `postgres`, `redis`, `api`, `web`, `asr-worker`
- Create `.env.example` with all env vars from spec section 6
- Create root `.gitignore` covering `node_modules/`, `dist/`, `build/`, `.cache/`, `*.log`, `uploads/`, `__pycache__/`, `.venv/`
- Write root scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`
- **Verification**: `pnpm install` succeeds; `pnpm typecheck` passes on empty scaffolds; `docker-compose config` validates

### [x] Step 2: Database Schema & Prisma Setup
<!-- chat-id: b5d9bd53-8552-4f2c-8757-8c3362e9b853 -->
Create the complete Prisma schema and generate the first migration.

- Create `apps/api/prisma/schema.prisma` with all models from spec section 5.1: `User`, `AudioFile`, `Transcript`, `TranscriptSegment`, `StyleGuideDocument`, `StyleGuideRule`, `ValidationError` and all enums
- Configure `DATABASE_URL` in `.env` wired to Docker postgres service
- Run `prisma migrate dev --name init` to create and apply the first migration
- Generate Prisma client and export a singleton from `apps/api/src/config/prisma.ts`
- Write API integration tests (Jest + supertest) verifying Prisma client connects and each model can be created/read
- **Verification**: `cd apps/api && pnpm test` passes; `prisma studio` opens without errors

### [x] Step 3: Auth Endpoints & JWT Middleware
<!-- chat-id: a89f0f28-a539-4150-8482-bdc94474269f -->
Implement authentication so all subsequent API routes can be protected.

- Implement `POST /api/auth/login` (email+password → bcrypt compare → issue access + refresh JWT as httpOnly cookies)
- Implement `POST /api/auth/refresh` (verify refresh token → rotate and reissue access token)
- Implement `POST /api/auth/logout` (clear cookies)
- Create `apps/api/src/middleware/auth.ts`: `authenticateToken()` middleware and `requireRole(role)` factory
- Seed script `apps/api/prisma/seed.ts` creating one `admin` and one `transcriptionist` user
- Unit tests: middleware rejects missing/expired/wrong-role tokens; login returns cookies; refresh rotates tokens
- **Verification**: `pnpm test` passes; manual curl sequence login → refresh → logout works

### [x] Step 4: Login UI & Auth Store
<!-- chat-id: 34c1873f-88e5-4869-87bc-1cd5c3dc0793 -->
Build the frontend authentication flow.

- Create `apps/web/src/store/authStore.ts` (Zustand): stores `user`, `isAuthenticated`; exposes `login()`, `logout()`
- Create `apps/web/src/api/auth.ts`: Axios instance with `withCredentials: true`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`; attach response interceptor to auto-refresh on 401
- Create `LoginPage.tsx` with react-hook-form + Zod validation (email required, password min 6 chars)
- Create `AppShell.tsx` layout with `Sidebar.tsx` (role-aware nav: transcriptionist sees Dashboard/Audio; admin sees additional Style Guide section)
- Create `ProtectedRoute` wrapper redirecting unauthenticated users to `/login`
- Set up `react-router-dom` routes in `App.tsx`
- Vitest + React Testing Library tests: LoginPage renders, form validation fires, successful login navigates to dashboard
- **Verification**: `cd apps/web && pnpm test` passes; `pnpm typecheck` passes

### [x] Step 5: Audio Upload API & ASR Job Queue
<!-- chat-id: 5d281b5f-692c-4ff4-9425-bdd3a0ca447a -->
Wire audio upload to the async transcription pipeline.

- Implement `POST /api/audio` with multer (accept mp3/mp4/wav/m4a/flac, max 2 GB), store to `FILE_STORAGE_PATH`, persist `AudioFile` record
- Implement `GET /api/audio`, `GET /api/audio/:id` (metadata + status), `GET /api/audio/:id/stream` (range-request streaming)
- Create `apps/api/src/services/asrQueue.ts`: BullMQ producer that enqueues an `asr` job with `{audioId, audioPath}`
- Create `apps/api/src/services/asrWorker.ts`: BullMQ consumer that calls Python ASR Worker `POST /transcribe` via axios, updates `AudioFile.status`
- Create `apps/api/src/sockets/index.ts`: Socket.io setup; emit `transcript:status` on job progress events
- Implement `POST /internal/asr-complete` webhook: receives word-level payload, creates `Transcript` + `TranscriptSegments`, emits `transcript:ready`
- API integration tests: upload endpoint rejects wrong mime types; job is enqueued after successful upload; asr-complete webhook creates segments; mock BullMQ worker
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [x] Step 6: Python ASR Worker
<!-- chat-id: b986b2aa-d44e-4588-b22c-cf9439ed014d -->
Implement the Python microservice that runs Whisper + pyannote.

- Implement `services/asr-worker/asr.py`: `faster-whisper` wrapper returning `List[WordResult]` with word/start/end/confidence
- Implement `services/asr-worker/diarization.py`: `pyannote.audio` pipeline returning speaker segments
- Implement `services/asr-worker/merger.py`: merge ASR word timestamps with diarization speaker labels → unified `List[UnifiedWord]`
- Implement `services/asr-worker/main.py`: FastAPI `POST /transcribe` endpoint that runs asr+diarization asynchronously, then POSTs results to `callback_url`
- Define Pydantic models in `models.py` matching spec section 5.4 (`TranscribeRequest`, `TranscribeCallback`, `WordResult`)
- `pytest` tests: `merger.py` correctly assigns speaker IDs to words; `asr.py` loads model and returns expected output structure (mock faster-whisper); FastAPI endpoint returns 200 and triggers callback (mock httpx)
- **Verification**: `cd services/asr-worker && pytest` passes; `uvicorn main:app` starts without errors

### [ ] Step 7: Audio Upload UI & Dashboard
<!-- chat-id: fa22a2c8-911a-4b95-b813-46bd05186dac -->
Build the frontend audio management screens.

- Create `apps/web/src/api/audio.ts`: react-query hooks for `uploadAudio`, `listAudio`, `getAudio`, `streamAudioUrl`
- Create `AudioUploadPage.tsx`: drag-and-drop file picker (accepts audio formats), upload progress bar, optimistic status display
- Create `DashboardPage.tsx`: table of uploaded audio files with status badges (QUEUED / PROCESSING / COMPLETE / ERROR); react-query polling + Socket.io `transcript:status` event updates status in real-time
- Create `apps/web/src/store/editorStore.ts` (Zustand): `currentTime`, `isPlaying`, `validationErrors`, `activeGuideRules`
- Vitest tests: DashboardPage renders audio list; status badge updates when Socket.io event fires; upload form validation rejects non-audio files
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 8: Transcript Editor — TipTap Core & Audio Sync
Build the core editor with custom nodes and audio playback sync.

- Create `apps/web/src/components/editor/extensions/TranscriptBlockNode.ts`: custom TipTap node wrapping a speaker segment (`speaker` attribute, renders as labeled block)
- Create `SpeakerLabelNode.ts`: inline non-editable node chip for speaker name
- Create `WordTimestampPlugin.ts`: TipTap plugin that marks each word span with `data-start`, `data-end`, `data-confidence` attributes
- Create `apps/web/src/components/editor/AudioPlayer.tsx`: WaveSurfer.js wrapper; exposes play/pause, seek, speed controls; forwards `timeupdate` events to `editorStore`
- Create `apps/web/src/hooks/useAudioSync.ts`: subscribes to `editorStore.currentTime` → binary search on word data → highlights current word via TipTap transaction
- Create `apps/web/src/hooks/useAutoSave.ts`: debounce 30 s + blur event → `PUT /api/transcripts/:id/segments`
- Create `apps/web/src/api/transcripts.ts`: react-query hooks for `getTranscript`, `saveSegments`
- Create `EditorPage.tsx`: assembles `AudioPlayer`, `TranscriptEditor`, `ValidationPanel`, `ReviewSuggestionsPanel`; loads transcript on mount
- Vitest tests: `TranscriptBlockNode` renders with speaker label; click on word node calls `wavesurfer.seekTo` with correct time; `useAutoSave` triggers save after 30 s
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 9: Transcript Editor — Tag Node, Keyboard Shortcuts & Auto-Save
Complete editor tooling.

- Create `TagNode.ts`: inline TipTap node that renders `[inaudible]`, `[crosstalk]` etc. as visual chips; tag types loaded from active style guide's `TagUsage` rules
- Create `TagPicker.tsx`: dropdown listing available tags sourced from active guide rules; inserts `TagNode` at cursor
- Implement keyboard shortcuts in `TranscriptEditor.tsx`: Space (play/pause), Tab (rewind 5 s), Ctrl+Shift+Up/Down (speed), Ctrl+Z/Y (undo/redo)
- Implement speaker label insertion/reassignment UI (click SpeakerLabelNode → inline dropdown)
- Implement inline timestamp insertion command
- Confirm TipTap undo/redo history depth ≥ 50
- Vitest tests: TagPicker inserts correct TagNode; keyboard shortcut Space fires play/pause; speaker label reassignment updates block attribute
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 10: Style Guide Ingestion API
Implement the PDF parsing and LLM rule extraction pipeline (spec section 3.3).

- Create `apps/api/src/services/pdfParser.ts`: `pdf-parse` wrapper returning `{text: string, pages: {pageNumber: number, text: string}[]}`
- Create `apps/api/src/services/ruleExtractor.ts`: sends page-annotated text to OpenAI GPT-4o with structured output prompt; receives `{rule_type, rule_text, source_page}[]`; validates with Zod schema; persists `StyleGuideRule` records via Prisma
- Implement `POST /api/style-guide`: multer upload → pdfParser → ruleExtractor → return `{guideId, rules[]}`
- Implement `GET /api/style-guide` (list versions), `GET /api/style-guide/:id/rules` (rule list)
- Implement manual rule CRUD: `POST /api/style-guide/:id/rules`, `PUT /api/style-guide/:id/rules/:ruleId`, `DELETE /api/style-guide/:id/rules/:ruleId`
- API integration tests: PDF upload creates guide + rules; Zod validates extracted rule shape; CRUD operations mutate rules; OpenAI client mocked
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 11: Style Guide Versioning & Activation
Implement guide version management and re-validation trigger.

- Implement `POST /api/style-guide/:id/activate`: sets `isActive=true` on selected guide (unsets all others), triggers `validationCodegen` for each rule, enqueues re-validation BullMQ jobs for all transcripts
- Create `apps/api/src/services/validationCodegen.ts`: calls GPT-4o with each rule's `rule_text` → generates JS `ValidationFn` string → stores in `StyleGuideRule.validationLogic`; OpenAI call mocked in tests
- Create `apps/api/src/services/revalidationQueue.ts` + `revalidationWorker.ts`: BullMQ producer/consumer; consumer fetches active rules + all segments for a transcript, runs server-side validation, persists `ValidationError` records, emits `transcript:revalidated` Socket.io event
- Emit `transcript:revalidating` Socket.io event when job starts
- API integration tests: activation flips `isActive`; codegen called for each rule; re-validation job enqueued; re-validation worker stores errors; socket events emitted; all OpenAI + BullMQ mocked
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 12: Admin Style Guide UI
Build the admin-only style guide management pages.

- Create `apps/web/src/api/styleGuide.ts`: react-query hooks for `uploadGuide`, `listGuides`, `listRules`, `activateGuide`, `addRule`, `updateRule`, `deleteRule`
- Create `StyleGuideListPage.tsx`: table of guide versions with version label, upload date, active badge; "Activate" button; links to rule editor
- Create `StyleGuideUploadPage.tsx`: PDF upload form, upload progress, displays extracted rules summary on success
- Create `RuleEditorPage.tsx`: editable table of rules (`rule_type`, `rule_text`, `source_page`); inline edit/delete; "Add Rule" form
- Create `apps/web/src/store/styleGuideStore.ts` (Zustand): caches active guide rules; refreshed on `transcript:revalidated` Socket.io event
- Show re-validation progress notification (toast) when `transcript:revalidating` / `transcript:revalidated` events arrive
- Vitest tests: StyleGuideListPage renders versions; activate button calls API; RuleEditorPage inline edit updates rule; upload form validates PDF mime type
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 13: Rule Validation in Editor
Wire LLM-generated validation functions into the TipTap editor.

- Create `apps/web/src/components/editor/extensions/ValidationPlugin.ts`: TipTap plugin that reads `styleGuideStore.activeRules`, compiles each `validationLogic` string via `new Function()` inside try/catch, runs all `ValidationFn[]` debounced 500 ms on editor content change, produces `DecorationSet` with colored underlines per violation
- Create `LowConfidencePlugin.ts`: reads `word_data` confidence values; highlights words with confidence < 0.7 in yellow using TipTap decorations
- Create `ValidationPanel.tsx`: lists all current `ValidationError` items (from `editorStore`); each entry shows error type, message, location; clicking navigates editor cursor to the error position
- Implement `POST /api/transcripts/:id/validate` endpoint: server-side validation runner using stored `validationLogic` (executed via Node.js `vm.runInNewContext()` sandbox); persists errors; returns error list
- `GET /api/transcripts/:id/errors` + `PATCH /api/transcripts/:id/errors/:errId` (mark resolved)
- Vitest tests: ValidationPlugin fires after 500 ms debounce; `new Function()` compile failure is caught gracefully; ValidationPanel renders error list; clicking error moves cursor
- API integration tests: validate endpoint runs rules and returns errors; mark-resolved updates DB
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 14: AI Accuracy Review Panel
Implement the low-confidence word review workflow.

- Create `ReviewSuggestionsPanel.tsx`: lists all words from `TranscriptSegment.wordData` where `confidence < 0.7`, sorted ascending; each item shows word, confidence %, timestamp; "Seek" button calls `wavesurfer.seekTo(start_time)`
- Add "Mark Verified" button per suggestion that calls `PATCH /api/transcripts/:id/segments/:segId/words/:wordIdx/verify`; removes the highlight and the list entry
- Implement `PATCH /api/transcripts/:id/segments/:segId/words/:wordIdx/verify` API endpoint: updates `wordData` JSONB to set `verified: true` on the specific word
- Vitest tests: panel renders only words below threshold; seek button fires correct time; mark-verified removes entry from list
- API integration test: verify endpoint patches correct word in JSONB array
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 15: Export System
Implement all four export formats server-side.

- Create `apps/api/src/services/exportService.ts` with functions: `toTxt(transcript, activeRules)`, `toDocx(transcript, activeRules)`, `toJson(transcript)`, `toTranscribeMe(transcript, activeRules)`
  - TXT/TranscribeMe: dynamically resolve speaker format and timestamp format from active `SpeakerFormatting` / `TimestampRequirement` rules; no hardcoded templates
  - DOCX: use `docx` npm package; speaker labels as bold paragraphs; timestamps inline
  - JSON: direct serialization of segments with full `wordData`
- Implement `GET /api/transcripts/:id/export?format=txt|docx|json|transcribeme`: calls appropriate export function, sets `Content-Disposition` header, streams response
- API integration tests: each format returns correct `Content-Type`; TXT output respects speaker format from mock active rules; JSON output includes `wordData`
- **Verification**: `pnpm test` passes; `pnpm typecheck` passes

### [ ] Step 16: Accessibility, Polish & NFR Verification
Finalize UI quality and non-functional requirements.

- Audit all pages with axe-core (via `@axe-core/react`) and fix WCAG 2.1 AA violations: focus management, ARIA labels on icon buttons, color contrast
- Implement configurable keyboard shortcuts: store shortcut map in `editorStore`; render shortcut hints in UI
- Verify large-file upload: confirm multer limit set to 2 GB; add chunked upload fallback if needed
- Performance test: load a 50,000-word transcript in TipTap; measure input latency; apply virtualization if > 100 ms
- Write Playwright E2E tests (`pnpm e2e`):
  - Full flow: login → upload audio → wait for transcription → open editor → edit text → validate → export TXT
  - Admin flow: login as admin → upload PDF guide → review rules → activate → see re-validation notification
- Run full test suite and lint: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`
- Document all env vars and startup steps in `README.md` (only, not additional docs)
- **Verification**: `pnpm lint` 0 errors; `pnpm typecheck` 0 errors; `pnpm test` all pass; `pnpm e2e` all pass
