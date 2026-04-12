# Legal Transcription Platform: Technical Handover (Phase 5)

This document serves as the final technical guide for maintaining and scaling the Legal Transcription Platform.

## 🏛️ System Architecture

The project is built as a **Monorepo** using Vite (React) for the frontend and Express (Node.js) for the API.

### 1. The 3-Layer Precision Pipeline
The core value proposition is the deterministic transcription correction pipeline:
1. **Layer 1: ASR (Automated Speech Recognition)**
   - Provider: **WhisperX** (via Replicate).
   - Features: High-accuracy diarization (speaker identification) and word-level alignment.
2. **Layer 2: LLM Structuring**
   - Model: **Claude 3.5 Sonnet** (Anthropic).
   - Task: Applies jurisdictional style guide rules (PDF/Text) to raw ASR output.
3. **Layer 3: CVLEngine (Clean Verbatim Legal)**
   - Implementation: `@transcribe/cvl-engine`.
   - Task: Deterministic post-processor that enforces exact legal formatting (stutter removal, slang normalization, tag handling).

## 🚀 Key Modules

### `@transcribe/api`
- **Queue**: BullMQ with Redis for non-blocking transcription jobs.
- **Storage**: Cloudflare R2 (S3-compatible) for audio and style guide manuals.
- **Security**: Hardened with Helmet, Express Rate Limit, and centralized error handling.
- **Cache**: Internal memory cache for jurisdictional rules to reduce DB latency.

### `@transcribe/web`
- **Editor**: Custom TipTap/React editor with side-by-side QA comparison.
- **Exports**: Client-side PDF/DOCX generation with approximated courtroom line numbering.
- **Real-time**: Socket.io integration for live transcription progress tracking.

## 🛠️ Maintenance & Operations

### Environmental Configuration
Ensure the following variables are set in production:
- `DATABASE_URL`: Postgres connection string.
- `REDIS_URL`: BullMQ job state.
- `REPLICATE_API_TOKEN`: WhisperX orchestration.
- `ANTHROPIC_API_KEY`: Rule ingestion and LLM styling.
- `R2_STORAGE_CONFIG`: Endpoint/Keys for Cloudflare R2.

### Adding New Jurisdictions
1. Use the **Style Guide Tool** in the Admin dashboard.
2. Upload the courtroom's official manual (PDF).
3. Trigger **Extract Rules**.
4. The system will automatically populate the rule set for that jurisdiction.

## 📈 Performance & Scaling
- **Vertical Scaling**: The API is stateless and can be horizontally scaled behind a load balancer.
- **Horizontal Scaling**: BullMQ workers can be deployed independently on GPU-enabled instances if self-hosting WhisperX.
- **Database**: Postgres indexing is optimized for `audio_file_id` lookups.

---
**Build Status:** Production Hardened
**Compliance:** 100% Deterministic CVL Implementation
