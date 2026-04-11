# Roadmap: Legal Transcribe (Production Upgrade)

## Overview
This roadmap outlines the transition of the Legal Transcribe platform from a local-monolith prototype to a scalable, production-grade transcription engine. The journey focuses on decoupling the infrastructure (S3, BullMQ), achieving 100% CVL compliance via automated validation, and delivering a premium speaker management experience for legal professionals.

## Phases

- [ ] **Phase 1: Scale-Ready Foundation** - API modularization and direct-to-S3 infrastructure.
- [ ] **Phase 2: Robust Orchestration** - Background job processing with BullMQ and real-time UI tracking.
- [ ] **Phase 3: The "Perfection" Engine** - CVL validation suite and Claude 3.5 styling optimization.
- [ ] **Phase 4: Elite Speaker Management** - Advanced diarization UI and global speaker correction tools.
- [ ] **Phase 5: Production Polish & Export** - Legal-grade exports (DOCX/PDF), bulk dashboard, and E2E verification.

## Phase Details

### Phase 1: Scale-Ready Foundation
**Goal**: Decouple the API from local storage and prepare for large-file handling.
**Depends on**: Initial Project Map
**Requirements**: [INFRA-01, INFRA-02, INFRA-03, API-01, API-02, API-03]
**Success Criteria**:
  1. API `index.ts` is refactored into modular routes and controllers.
  2. Large files (>100MB) can be uploaded directly to S3/R2 via pre-signed URLs.
  3. Database logic is isolated from the core transcription handlers.
**Plans**: 3 plans
- [ ] 01-01: API Modularization and Service Layer refactor.
- [ ] 01-02: S3/R2 Integration and Pre-signed URL implementation.
- [ ] 01-03: S3 Multipart upload support in the frontend.

### Phase 2: Robust Orchestration
**Goal**: Ensure system stability via asynchronous processing and real-time feedback.
**Depends on**: Phase 1
**Requirements**: [INFRA-04, INFRA-05, INFRA-06]
**Success Criteria**:
  1. Transcription tasks are processed sequentially in a background worker (BullMQ).
  2. The UI displays real-time progress percentages for each processing stage.
  3. API remains responsive even during heavy transcription tasks.
**Plans**: 2 plans
- [ ] 02-01: BullMQ + Redis worker infrastructure setup.
- [ ] 02-02: Real-time progress streaming via Socket.io.

### Phase 3: The "Perfection" Engine
**Goal**: Achieve 100% CVL compliance and establish a "Gold Standard" validation suite.
**Depends on**: Phase 1
**Requirements**: [CVL-01, CVL-02, CVL-03, CVL-04]
**Success Criteria**:
  1. A suite of 20+ "Gold Standard" legal test cases passes with 100% accuracy.
  2. Claude 3.5 Sonnet is tuned for perfect Clean Verbatim styling.
  3. User-defined style guides can be swapped without code changes.
**Plans**: 2 plans
- [ ] 03-01: Validation Suite implementation and "Gold Standard" dataset.
- [ ] 03-02: CVL Rules Engine optimization and Pluggable Style Guide support.

### Phase 4: Elite Speaker Management
**Goal**: Provide users with powerful tools to correct and manage speaker identity.
**Depends on**: Phase 2
**Requirements**: [SPK-01, SPK-02, SPK-03, SPK-04]
**Success Criteria**:
  1. User can rename or merge speakers globally with one action.
  2. The editor visually distinguishes speakers with persistent labels.
  3. Speaker corrections are persisted and reflected in final exports.
**Plans**: 2 plans
- [ ] 04-01: Diarization UI and speaker visualization in React.
- [ ] 04-02: Global Speaker CRUD and merge logic.

### Phase 5: Production Polish & Export
**Goal**: Deliver final legal artifacts and ensure overall system reliability.
**Depends on**: Phase 3, Phase 4
**Requirements**: [FEAT-01, FEAT-02, FEAT-03, FEAT-04]
**Success Criteria**:
  1. Users can download transcripts in professional Legal DOCX/PDF formats.
  2. Bulk uploads are handled via a unified processing dashboard.
  3. All critical flows are covered by Playwright E2E tests.
**Plans**: 3 plans
- [ ] 05-01: Legal DOCX and PDF export engine.
- [ ] 05-02: Bulk Processing Dashboard and queue management UI.
- [ ] 05-03: E2E Testing Suite and final production audit.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scale-Ready Foundation | 0/3 | Not started | - |
| 2. Robust Orchestration | 0/2 | Not started | - |
| 3. The "Perfection" Engine | 0/2 | Not started | - |
| 4. Elite Speaker Management | 0/2 | Not started | - |
| 5. Production Polish & Export | 0/3 | Not started | - |

---
*Roadmap defined: 2026-04-11*
*Last updated: 2026-04-11 after project initialization*
