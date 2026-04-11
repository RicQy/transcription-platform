# Testing & Quality Assurance

**Analysis Date:** 2026-04-11

## Test Strategy

The project employs a **Unified Testing Stack** using `Vitest`, providing high-speed unit and integration tests across the monorepo.

## Component Testing

### 1. Correct Verbatim Legal (CVL) Engine
- **Target:** `packages/cvl-engine`
- **Focus:** 100% deterministic test coverage for all transcription rules (stutter removal, slang normalization, etc.).
- **Tests:** `engine.test.ts` uses extensive datasets of "Raw" vs "Gold Standard" strings to verify compliance.

### 2. Frontend (React/Vite)
- **Target:** `apps/web`
- **Framework:** Vitest + React Testing Library (JSDOM).
- **Tests:**
  - `TranscriptEditor.test.tsx` - Syncing between audio and text highlighting.
  - `AuthFlow.test.tsx` - Login/Logout/Signup logic.

### 3. Backend (API)
- **Target:** `apps/api`
- **Strategy:** Feature-based integration testing for core endpoints using Vitest.
- **Status:** Basic coverage for authentication; priority for worker queue testing.

## Quality Standards

- **Gold Standard (GS) Benchmark:** A collection of 10 official courtroom transcripts used to evaluate the 3-layer pipeline accuracy.
- **WER/CER Monitoring:** The dashboard includes an "Eval" mode that calculates Word Error Rate (WER) against manual corrections.

## Execution

- **All Tests:** `pnpm test` (root)
- **Engine Tests:** `pnpm --filter @transcribe/cvl-engine test`
- **Web Tests:** `pnpm --filter @transcribe/web test`

---

*Testing Map: 2026-04-11*
