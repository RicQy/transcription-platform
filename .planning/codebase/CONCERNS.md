# Technical Concerns

**Analysis Date:** 2026-04-11

## Technical Debt

- **Monolithic API Handler:** `apps/api/src/index.ts` is growing large and contains all routes, logic, and external service orchestration. It needs refactoring into separate routes/controllers.
- **Supabase Shim:** The `db.ts` shim is functional but basic. It lacks robust error handling, transactions, and full query capability compared to a real ORM (like Prisma or Drizzle).
- **Hard-coded Models:** AI model versions are hard-coded in transcription logic (e.g., `claude-3-5-sonnet-20240620`).

## Risks & Fragility

- **Transcription Pipeline Complexity:** The three-step process (WhisperX -> Anthropic -> CVL Engine) has multiple points of potential failure. Error handling at each step is present but may not be robust enough for long audio files.
- **Local Storage Reliance:** Audio files are stored on the local disk (`uploads/` folder). This will not scale to multi-instance/serverless deployments without moving to S3 or similar.
- **Large Audio Handling:** Multer and the in-memory processing pattern in `transcribeAsync` might struggle with very large files without streaming or worker queues (e.g., BullMQ).

## Security Concerns

- **JWT Secret:** Default secrets in `index.ts` and `.env` template (`change_me...`) could be leaked if not properly managed during deployment.
- **CORS Configuration:** Currently set to `*`. Should be restricted to specific domains in production.

## Known Bugs & Issues

- **ASR Worker URL:** The `.env` references `http://asr-worker:8000`, which implies a Docker environment that might not be running in all local dev setups.
- **Database Connection Error Handling:** Application crashes if DB is not available on startup (common in local dev if docker is not up).

---

*Concerns log: 2026-04-11*
