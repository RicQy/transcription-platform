# Research: System Architecture for Scale & Accuracy

**Analysis Date:** 2026-04-11
**Objective:** Designing for "The Record" and high-throughput processing.

## Logical Architecture

### 1. Data Ingestion Layer
- **Client Side:** Direct S3 Upload via Pre-signed URLs. Multipart support for files >100MB.
- **Backend Trigger:** API validates request -> Generates URL -> Client uploads -> Client hits "Confirm" -> API creates DB record & adds to BullMQ.

### 2. Processing Layer (Worker Fleet)
- **Worker Node:** Consumes key from BullMQ.
  - **Stage A (ASR):** Fetch from S3, send to WhisperX (Replicate).
  - **Stage B (Alignment):** Receive segments with speaker labels.
  - **Stage C (Correction Engine):**
    - **LLM Agent:** Uses Claude 3.5 to apply specific "Style Guide" rules (e.g., "Always capitalize Case IDs").
    - **CVL Engine:** Deterministic post-processor for punctuation and filler removal.
  - **Stage D (Persistence):** Store result in Postgres and update Redis for real-time notification.

### 3. Communication Layer
- **WebSocket (Socket.io):** Reliable progress streaming (e.g., "Diarizing... 60%").
- **State Store:** Redis for transient job state; Postgres for long-term record.

## Component Boundaries
- **API Server:** Stateless, handles Auth and UI requests.
- **Worker Process:** Stateful during a job, heartbeats back to Redis.
- **S3 Bucket:** The source of truth for raw audio and generated artifacts (DOCX, PDF).

## Data Flow Pattern
```text
User -> [Browser] -> (S3 Upload) 
User -> [API] -> (Create Job) -> [BullMQ] -> [Redis]
                                    |
                                [Worker] <-> [ASR/LLM APIs]
                                    |
                                [Postgres] <-> [User]
```

## Security Design
- **Encryption:** All audio data encrypted at rest (AES-256).
- **Isolation:** Each user's data isolated by `user_id` in Postgres and S3 prefixes.
- **Expiration:** Auto-cleanup of raw audio from S3 after 30 days (optional legal requirement).

---
*Confidence: Very High*
