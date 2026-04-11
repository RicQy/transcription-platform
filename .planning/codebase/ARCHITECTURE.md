# Architecture

**Analysis Date:** 2026-04-11

## System Pattern

The application follows a **Monorepo Architecture** using `pnpm` workspaces, separating the frontend, backend, and shared logic.

- **Frontend (apps/web):** Single Page Application (SPA) built with React and Vite.
- **Backend (apps/api):** Node.js Express server providing REST endpoints and WebSocket communication.
- **Shared Logic (packages/cvl-engine, packages/shared-types):** Internal packages for business logic and type definitions.

## Key Layers

### 1. Presentation Layer (apps/web)
- **Pages:** Modular screens like Dashboard, Login, and Audio Upload.
- **Components:** Reusable UI elements built with Tailwind CSS.
- **State Management:** Zustand for global state (auth, ui) and React Query for server state.
- **Multimedia:** Wavesurfer.js for audio visualization and Tiptap for transcript editing.

### 2. Service Layer (apps/api)
- **REST Endpoints:** Authentication, file uploads, and transcription management.
- **Real-time Gateway:** Socket.io for streaming pipeline status.
- **Business Logic:** Orchestrates communication between external AI services (Replicate, Anthropic) and the CVL engine.

### 3. Business Logic (packages/cvl-engine)
- **Deterministic Processing:** A dedicated engine that applies strict legal transcription rules (filler removal, slang normalization, etc.) to transcript text.

### 4. Data Access (apps/api/src/db.ts)
- **Custom Shim:** A lightweight database wrapper that mimics the Supabase `from().select().eq()` API on top of raw PostgreSQL using the `pg` driver.

## Data Flow

1. **Upload:** User uploads audio file via Web UI -> API `multer` storage -> DB `audio_files` record.
2. **Transcription Trigger:** Frontend calls `/transcribe` -> API starts `transcribeAsync` worker.
3. **Pipeline:**
   - **ASR:** WhisperX (via Replicate) generates raw text with timestamps.
   - **Styling:** LLM (via Anthropic) applies user-specific style guide rules.
   - **Compliance:** CVL Engine enforces deterministic legal formatting.
4. **Completion:** Results saved to DB `transcripts` -> Socket.io emits `finished` event to Frontend.

## Design Patterns

- **Monorepo Workspaces:** Ensures type safety across the stack via `@transcribe/shared-types`.
- **Observer Pattern:** Real-time updates via WebSockets for long-running transcription tasks.
- **Strategy Pattern (Implicit):** Support for multiple transcription providers (WhisperX, alternative stubs).
- **Rule-Based Engine:** Decoupled CVL enforcement for consistent formatting.

---

*Architecture map: 2026-04-11*
