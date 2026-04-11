# Research: Prescriptive Stack for Legal Transcription

**Analysis Date:** 2026-04-11
**Objective:** Zero-compromise accuracy and scalable large-file handling.

## Recommended Stack

### 1. Storage & File Handling
- **Service:** AWS S3 or Cloudflare R2.
- **Pattern:** Direct-to-Storage Uploads via **Pre-signed URLs**.
- **Rationale:** Bypasses Node.js memory limits and prevents API server timeouts during multi-hundred-megabyte uploads.
- **Large File Tech:** **AWS S3 Multipart Uploads** for files >100MB to enable chunked parallel uploads and retries.

### 2. Task Orchestration & Queuing
- **System:** **BullMQ** (Node.js) + **Redis**.
- **Pattern:** Asynchronous job processing with separate worker processes.
- **Rationale:** Separates the request/response cycle (API) from long-running ML tasks. BullMQ provides robust retry logic, progress tracking, and concurrency control.
- **Redis:** Managed Redis (e.g., Upstash or Railway Redis) for low-latency state management.

### 3. AI & Transcription (ASR)
- **Model:** **WhisperX** (via Replicate).
- **Rationale:** Provides state-of-the-art ASR with word-level alignment and speaker diarization. Aligning timestamps is critical for legal transcripts where "when" something was said is as important as "what".
- **LLM Layer:** **Claude 3.5 Sonnet** (Anthropic). Specifically tuned for styling and formatting logic due to high instruction-following performance.

### 4. Database
- **Engine:** **PostgreSQL**.
- **Rationale:** Strong support for JSONB (transcripts/metadata) and robust transaction management for legal records.

### 5. Frontend UI
- **Framework:** React 18.
- **Visualization:** **Wavesurfer.js** for interactive waveform seeking.
- **Editing:** **Tiptap** for collaborative/rich-text editing with custom nodes for speaker labels.

## What NOT to Use
- **Synchronous API Uploads:** Will crash under high load or with large files. Banned.
- **Local File Storage in Prod:** Not scalable, loses data on container deployments, and slow for large file reads by workers. Banned.
- **Regex-based Formatting:** Fragile and cannot handle the nuance of "Clean Verbatim" rules. Use the LLM + CVL Engine hybrid approach.

---
*Confidence: High*
