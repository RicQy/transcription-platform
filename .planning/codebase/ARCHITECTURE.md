# System Architecture

**Analysis Date:** 2026-04-11

## Overview

The platform uses a **Modern Monorepo Architecture** (pnpm workspaces) with a **3-Layer Precision Transcription Pipeline**. It decouples concern between data ingestion, intensive AI processing, and deterministic legal rule enforcement.

## System Pattern

### 1. Separation of Concerns (Monorepo)
- **apps/web:** React/Vite SPA for editor and dashboard.
- **apps/api:** Express Node.js server for orchestration and API.
- **packages/cvl-engine:** Shared, deterministic logic package for CVL enforcement.
- **packages/shared-types:** Centralized TypeScript definitions for end-to-end type safety.

### 2. The 3rd Layer Precision Pipeline (The Core)
1. **Layer 1: ASR (Automated Speech Recognition)**
   - External: WhisperX (Word-alignment, Diarization).
2. **Layer 2: LLM (Jurisdictional Styling)**
   - External: Claude 3.5 Sonnet applied via Jurisdictional Rule Extracts.
3. **Layer 3: Deterministic (CVLEngine)**
   - Internal Code: Enforces Clean Verbatim Legal (CVL) rules (stutter removal, slang normalization, False Starts) with 100% predictability.

## Key Layers

### Presentation Layer (apps/web)
- **Editor:** Custom TipTap/React editor providing side-by-side QA comparison between raw ASR and corrected CVL output.
- **State:** Zustand handles authentication and UI state; React Query handles server data synchronization.

### Services Layer (apps/api)
- **Queueing:** BullMQ + Redis for processing long-running transcription tasks.
- **Gateway:** Socket.io provides push-based status updates to the client.
- **Database:** PostgreSQL stores user data, transcript metadata, and jurisdictional rules.

### Business Logic (packages/cvl-engine)
- **Rule Parser:** Interprets jurisdictional manuals for rule execution.
- **Processor:** Deterministic text transformer that requires no AI inference for final formatting pass.

## Data Flow

1. **User Action:** Uploads file to R2 via Pre-signed URL.
2. **API Trigger:** `/transcribe` endpoint starts a background job.
3. **Worker Processing:**
   - Raw transcription using WhisperX.
   - Styling using LLM + Jurisdictional Rules.
   - Final pass using CVLEngine.
4. **Completion:** Result stored in DB; Socket.io emits completion notification.

---

*Architecture Map: 2026-04-11*
