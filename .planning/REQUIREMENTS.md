# Requirements: Legal Transcribe (Production Upgrade)

**Defined:** 2026-04-11
**Core Value:** Zero-compromise legal accuracy (100% CVL compliance) delivered at enterprise scale.

## v1 Requirements

### Infrastructure & Large Files
- [ ] **INFRA-01**: Migrated from local storage to S3/R2 object storage.
- [ ] **INFRA-02**: Implement Direct-to-S3 uploads via Pre-signed URLs to prevent API timeouts.
- [ ] **INFRA-03**: Implement S3 Multipart uploads for browser-side handling of files >100MB.
- [ ] **INFRA-04**: Implement background worker queue (BullMQ + Redis) for transcription processing.
- [ ] **INFRA-05**: Implement sequential job processing to ensure server stability during high load.
- [ ] **INFRA-06**: Implement real-time job progress tracking in the UI (ASR, Styling, CVL stages).

### API Refactoring
- [ ] **API-01**: Refactor monolithic `index.ts` into modular routes, controllers, and services.
- [ ] **API-02**: Decentralize database logic from the core handler into a service layer.
- [ ] **API-03**: Standardize error handling and logging across all backend modules.

### CVL Compliance
- [ ] **CVL-01**: Define a "Gold Standard" validation suite (test cases with expected outputs).
- [ ] **CVL-02**: Achieve 100% compliance with Clean Verbatim Legal (CVL) rules in automated tests.
- [ ] **CVL-03**: Integrate LLM-based styling (Claude 3.5 Sonnet) with the deterministic CVL engine.
- [ ] **CVL-04**: Support user-defined "Pluggable Style Guides" via a flexible JSON rules engine.

### Speaker Management
- [ ] **SPK-01**: Visual separation of speakers in the transcript editor based on diarization.
- [ ] **SPK-02**: Global speaker renaming (renaming "Speaker 1" updates all occurrences).
- [ ] **SPK-03**: Global speaker merging (merging Speaker A and B into one label).
- [ ] **SPK-04**: Persistence of speaker metadata in the database linked to the transcript.

### Features & Export
- [ ] **FEAT-01**: Bulk audio upload dashboard for handling multiple files in a single queue.
- [ ] **FEAT-02**: "Legal Grade" DOCX export (custom margins, line numbering, speaker bolding).
- [ ] **FEAT-03**: PDF export with similar legal formatting.
- [ ] **FEAT-04**: E2E testing coverage (Playwright) for critical user flows (Upload -> Process -> Edit -> Export).

## v2 Requirements
- **SRT-01**: SRT/VTT caption export for video evidence.
- **AUDT-01**: Full audit log tracking every change made by users to a transcript.
- **ALRT-01**: Low-confidence word highlighting in the UI for manual review.

## Out of Scope
| Feature | Reason |
|---------|--------|
| Local Whisper Hosting | Hardware constraints and prioritization of the superior WhisperX model accuracy. |
| Fully Free Operation | User prioritized "Perfection" in results over absolute cost-free operation. |
| Mobile Transcription | Legal workflow is desktop-heavy; mobile is deferred. |

## Traceability
| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 2 | Pending |
| INFRA-05 | Phase 2 | Pending |
| INFRA-06 | Phase 2 | Pending |
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| CVL-01 | Phase 3 | Pending |
| CVL-02 | Phase 3 | Pending |
| CVL-03 | Phase 3 | Pending |
| CVL-04 | Phase 3 | Pending |
| SPK-01 | Phase 4 | Pending |
| SPK-02 | Phase 4 | Pending |
| SPK-03 | Phase 4 | Pending |
| SPK-04 | Phase 4 | Pending |
| FEAT-01 | Phase 5 | Pending |
| FEAT-02 | Phase 5 | Pending |
| FEAT-03 | Phase 5 | Pending |
| FEAT-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after project initialization*
