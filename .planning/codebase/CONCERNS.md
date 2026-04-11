# Technical Concerns & Risk Log

**Analysis Date:** 2026-04-11

## Risks & Fragility

### 1. Large Audio Processing (Memory Limits)
- **Description:** Processing 2-hour+ audio files using Multer and in-memory LLM correction can hit container memory limits (GCP Cloud Run standard is 512MB-1GB).
- **Mitigation:** Implemented Cloudflare R2 direct-to-storage and BullMQ background workers to decouple ingestion from processing.

### 2. Multi-Step Pipeline Reliability
- **Description:** A failure in WhisperX (ASR) or Claude (Styling) stops the entire pipeline.
- **Mitigation:** Implemented robust retry logic in BullMQ workers and granular Socket.io status reporting for debugging.

### 3. Jurisdictional Extraction Accuracy
- **Description:** LLM may hallucinate transcription rules from dense legal manuals (PDFs).
- **Mitigation:** Use Claude 3.5 Sonnet with a strict "Rule Schema" prompt; allow Admin review of extracted rules before activation.

## Technical Debt

### 1. Supabase Query Shim
- **Description:** `apps/api/src/db.ts` uses a manual shim to mimic the Supabase JS API on raw SQL. This is functional but lacks full ORM power (migrations, complex joins).
- **Plan:** Consider migrating to Prisma if database complexity grows significantly.

### 2. hard-coded AI Parameters
- **Description:** Model versions and temperature settings are currently hard-coded in worker logic.
- **Plan:** Move to a centralized `config.ts` or DB-driven configuration provider.

## Infrastructure & Security

### 3. Billing & Resource Scaling (GCP)
- **Description:** Cloud Run deployment requires an active billing account and proper `gserviceaccount` permissions for storage access.
- **Concern:** If billing is not active, the prod platform remains offline.

### 4. JWT Secret Rotation
- **Description:** Currently using static strings in `.env`.
- **Plan:** Migrate to GCP Secret Manager for production environment variables.

---

*Concerns Log: 2026-04-11*
