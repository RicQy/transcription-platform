# Legal Transcribe - Production Grade Transcription & Correction Engine

## What This Is
A high-accuracy, production-ready legal transcription platform designed for legal professionals. It transforms raw audio into "Gold Standard" transcripts using a triple-layer processing pipeline (WhisperX ASR, LLM Styling, and a deterministic CVL Enforcement Engine) with full speaker management, jurisdictional manual ingestion, and advanced legal exports.

## Core Value
Zero-compromise legal accuracy (100% CVL compliance) delivered at enterprise scale.

## Requirements

### Validated
- ✓ Base Monorepo structure (pnpm, Express, React)
- ✓ WhisperX integration (Word-level alignment & Diarization)
- ✓ Claude 3.5 Sonnet styling layer
- ✓ Deterministic CVL Engine (@transcribe/cvl-engine)
- ✓ Large Audio File handling (R2 Storage + Pre-signed URLs)
- ✓ Background Worker Queue (BullMQ + Redis)
- ✓ Full Speaker Management (Identity Injection)
- ✓ Automated "Gold Standard" Evaluation (WER/CER QA Dashboard)
- ✓ Immutable Style Guide Versioning
- ✓ Jurisdictional Style Guide Upload (PDF/Text)
- ✓ Automated Rule Extraction (LLM parsing of legal manuals)
- ✓ Multi-Jurisdiction Tagging (US, EU, CA specific formats)
- ✓ Advanced Export Formats (Legal PDF with line numbers, DOCX)
- ✓ Batch Processing (Multi-transcript ZIP exports)
- ✓ Production Hardening (Helmet, Rate Limiting, Global Error Handling)

### Out of Scope
- Local Whisper Hosting — Prioritizing WhisperX accuracy via Replicate.
- Fully free operation — Prioritizing transcription perfection over infrastructure cost.

## Technical Arch (The 3-Layer Pipeline)
1. **Layer 1: ASR**: WhisperX (Word alignment, Speaker diarization).
2. **Layer 2: LLM**: Claude 3.5 (Jurisdictional styling, legal nuances).
3. **Layer 3: Deterministic**: CVLEngine (filler removal, slang normalization, punctuation).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prioritize Results over Cost | User explicitly requested "perfection" for courtroom use. | Success |
| S3/R2 direct-to-storage | Bypasses memory limits for massive (2hr+) audio files. | Success |
| 3-Layer Correction Pipeline | Guarantees TranscribeMe-level legal compliance. | Success |
| Jurisdictional Ingestion | Automates rule entry for new court manual onboarding. | Success |
| Client-side Exports | High-fidelity legal layout with line numbers using jsPDF. | Success |

---
**Status: PROJECT COMPLETED (2026-04-11)**
**Handover Document: [HANDOVER.md](./HANDOVER.md)**
