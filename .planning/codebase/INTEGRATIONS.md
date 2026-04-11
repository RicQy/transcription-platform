# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**ASR / Transcription:**
- Replicate (WhisperX) - High-accuracy transcription with alignment (victor-upmeet/whisperx)
  - SDK/Client: `replicate` npm package v1.4.0
  - Auth: API token in `REPLICATE_API_TOKEN` env var
  - Implementation: `transcribeAsync` function in `apps/api/src/index.ts`

**LLM Styling:**
- Anthropic (Claude 3.5 Sonnet) - Post-ASR styling and formatting based on style guides
  - SDK/Client: `@anthropic-ai/sdk` npm package v0.82.0
  - Auth: API key in `ANTHROPIC_API_KEY` env var
  - Implementation: `applyStyleGuideDirect` function in `apps/api/src/index.ts`

**Diarization (Planned/Infrastructure):**
- Hugging Face (Pyannote) - Speaker diarization support
  - Auth: Token in `PYANNOTE_AUTH_TOKEN` env var
  - Note: Used by WhisperX worker if enabled.

## Data Storage

**Databases:**
- PostgreSQL - Primary data store (users, audio_files, transcripts)
  - Connection: via `DATABASE_URL` env var
  - Client: `pg` pool with a Supabase-like shim in `apps/api/src/db.ts`
  - Migrations: `schema.sql` at root or in `apps/api/src/`

**Caching & Queues:**
- Redis - Used for caching and potentially queue coordination
  - Connection: via `REDIS_URL` env var
  - Client: `ioredis` and `redis` packages

**File Storage:**
- Local Storage - Audio file uploads stored locally in `uploads/`
  - Implementation: `multer.diskStorage` in `apps/api/src/index.ts`
  - Access: Exposed via `express.static` on `/uploads`

## Authentication & Identity

**Auth Provider:**
- Custom JWT - Local email/password authentication
  - Implementation: `bcrypt` for hashing, `jsonwebtoken` for token issuance
  - Token storage: `accessToken` returned to client, managed in client state (Zustand)

## Monitoring & Observability

**Logs:**
- Morgan - HTTP request logging in API
- Console logs - Standard output for errors and events

**Real-time:**
- Socket.io - Real-time progress updates for transcription pipeline
  - Namespace: Root `/`
  - Events: `audio:{id}:status`, `audio:{id}:progress`, `audio:{id}:finished`

## CI/CD & Deployment

**Hosting:**
- Local/Docker - Development and potentially production via containerization
- Target Platforms: Railway, Google Cloud Run (as suggested by MCP tools)

## Environment Configuration

**Development:**
- Required env vars: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`
- Secrets location: `.env` (gitignored)

---

*Integration audit: 2026-04-11*
*Update when adding/removing external services*
