# External Integrations

**Analysis Date:** 2026-04-11

## AI & Data Processing

### 1. Replicate (WhisperX)
- **Role:** Primary ASR (Automated Speech Recognition) provider.
- **Model:** `whisperX` with word-level alignment and speaker diarization.
- **Workflow:** API calls via `@replicate/sdk` to perform inference on audio stored in the cloud.

### 2. Anthropic (Claude 3.5 Sonnet)
- **Role:** Jurisdictional Styling & Formatting.
- **Workflow:** 
  - **Rule Extraction:** Parses legal manual PDFs to extract transcription constraints.
  - **Layer 2 Correction:** Applies extracted rules to raw ASR output before deterministic CVL processing.

### 3. OpenAI (Optional/Fallback)
- **Role:** Supplementary LLM tasks or fallback for rule parsing.

## Infrastructure & Storage

### 4. Cloudflare R2 (S3-Compatible)
- **Role:** Large file storage for audio uploads, jurisdictional manuals, and finalized transcripts.
- **Access:** Pre-signed URLs for secure, direct browser-to-storage uploads.

### 5. PostgreSQL
- **Role:** Relational database for system state, user management, and metadata.
- **Driver:** `pg` with custom Supabase-style query shim (`apps/api/src/db.ts`).

### 6. Redis
- **Role:** Background worker state and message queue backing for `BullMQ`.

## Real-time & Communication

### 7. Socket.io
- **Role:** Real-time event bus between ASR workers and the React dashboard.
- **Events:** `transcription:progress`, `transcription:finished`, `transcription:error`.

### 8. SMTP (Placeholder)
- **Role:** Future user notifications for completed batch jobs.

---

*Integrations Map: 2026-04-11*
