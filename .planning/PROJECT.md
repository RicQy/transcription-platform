# Legal Transcribe - Production Grade Transcription & Correction Engine

## What This This
A high-accuracy, production-ready legal transcription platform designed for legal professionals. It transforms raw audio into "Gold Standard" transcripts using a triple-layer processing pipeline (WhisperX ASR, LLM Styling, and a deterministic CVL Enforcement Engine) with full speaker management and scale-ready infrastructure.

## Core Value
Zero-compromise legal accuracy (100% CVL compliance) delivered at enterprise scale.

## Requirements

### Validated
<!-- Inferred from existing codebase -->
- ✓ Base Monorepo structure (pnpm, Express, React) — existing
- ✓ Basic WhisperX integration (via Replicate) — existing
- ✓ Anthropic Claude 3.5 Sonnet styling layer — existing
- ✓ Local Audio storage & Processing — existing
- ✓ Deterministic CVL Engine core logic — existing
- ✓ Basic Auth (JWT/Bcrypt) — existing
- ✓ Real-time progress updates (Socket.io) — existing

### Active
<!-- Current focus: Perfection and Scalability -->
- [ ] 100% CVL Compliance validation suite (Automated "Gold Standard" testing)
- [ ] Large Audio File handling (Support for 30-60min+ files)
- [ ] Direct S3/R2 Storage migration (Pre-signed URLs for browser upload)
- [ ] Background Worker Queue (BullMQ + Redis) for sequential file processing
- [ ] API Refactoring (Modular routes and decentralized logic)
- [ ] Full Speaker Management UI (Global labeling, merging, and state persistence)
- [ ] Advanced Export Formats (PDF, DOCX with legal formatting, SRT)
- [ ] Batch Processing Dashboard (Bulk uploads and queue management)
- [ ] Comprehensive E2E Testing suite (Playwright)

### Out of Scope
- Local Whisper Hosting — Prioritizing WhisperX accuracy via Replicate; local hosting is deferred due to hardware/free-tier constraints on production servers.
- Fully free operation — Prioritizing "Perfection" and results over cost savings; using premium APIs (Claude, Replicate) where necessary.

## Context
- The project is transitioning from a functional prototype to a robust production platform.
- Current technical debt includes a monolithic `index.ts` handler and reliance on local disk storage for audio.
- The user demands "perfection" in results, specifically regarding speaker identification and CVL (Clean Verbatim Legal) compliance.

## Constraints
- **Tech Stack**: TypeScript, Node.js, React, PostgreSQL (currently shimmed).
- **External Dependencies**: Replicate (WhisperX), Anthropic (Claude 3.5), S3/R2 (Future).
- **Accuracy**: Final output must strictly follow deterministic CVL rules.
- **Performance**: Large files must be processed reliably without timing out or crashing the API.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prioritize Results over Cost | User explicitly requested "perfection" over a free-only operation. | — Pending |
| Move to S3/R2 + Pre-signed URLs | Bypasses Node.js memory limits for large audio uploads. | — Pending |
| Implement Background Queue | Ensures server stability by processing heavy tasks sequentially. | — Pending |

## Evolution
This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-11 after initialization*
