# Product Requirements Document
## TranscribeMe-Compatible Transcription Platform

**Version**: 1.0  
**Date**: 2026-03-15  
**Status**: Draft

---

## 1. Overview

A full-stack web application that transcribes audio files and produces transcripts compliant with an uploaded PDF style guide. The platform targets professional transcriptionists who follow the TranscribeMe style guide (or any similar guide), enabling zero-code rule adaptation as guides evolve.

The application treats the uploaded PDF style guide as the **single source of truth** for all formatting and validation rules. No transcription rules are hard-coded.

---

## 2. Users & Roles

| Role | Description |
|------|-------------|
| **Transcriptionist** | Uploads audio, edits transcripts, exports final output |
| **Administrator** | Uploads/manages style guide PDFs, manages versions |

> **Assumption**: For MVP, authentication is simple email/password with two roles. OAuth or SSO is out of scope.

---

## 3. Core Functional Requirements

### 3.1 Style Guide Ingestion

**FR-SG-01** — The system must accept PDF uploads of style guide documents via the Admin interface.

**FR-SG-02** — On upload, the system must:
1. Extract raw text from the PDF (preserving page numbers)
2. Pass extracted text to an LLM-based rule interpreter
3. Produce structured rules in a standardized format
4. Persist rules with `rule_id`, `rule_type`, `rule_text`, `rule_version`, `source_page_number`

**FR-SG-03** — Extracted rule types must include (but are not limited to):
- `SpeakerFormatting` — speaker label format and placement
- `TagUsage` — inline tags (e.g. `[inaudible]`, `[crosstalk]`, `[noise]`)
- `FillerWordHandling` — which filler words to remove or keep
- `PunctuationConvention` — period, comma, ellipsis usage rules
- `CapitalizationRule` — title case, sentence case, proper noun rules
- `TimestampRequirement` — frequency and format of inline timestamps
- `FormattingExample` — verbatim examples provided in the guide

**FR-SG-04** — After parsing, the Admin must see a list of all extracted rules with their types and source pages for review/correction.

**FR-SG-05** — The system must support manual rule editing (add, edit, delete) through the Admin UI in case the LLM extraction is incomplete.

### 3.2 Style Guide Versioning

**FR-SGV-01** — Each uploaded PDF creates a new versioned rule set (e.g., `v1`, `v2`, `v3`).

**FR-SGV-02** — Previous versions must be preserved and browsable.

**FR-SGV-03** — Admins can designate one version as the **active** version at any time.

**FR-SGV-04** — When the active version changes, all existing transcripts must be queued for re-validation against the new rules. Transcriptionists must be notified of new validation errors.

### 3.3 Audio Transcription

**FR-ASR-01** — The system must accept audio file uploads in common formats: MP3, MP4, WAV, M4A, FLAC.

**FR-ASR-02** — Transcription must produce word-level output with:
- `word` — transcribed text token
- `start_time` — seconds from audio start
- `end_time` — seconds from audio start
- `confidence_score` — float 0–1
- `speaker_id` — from diarization

**FR-ASR-03** — Speaker diarization must identify distinct speakers and assign consistent IDs across the transcript.

**FR-ASR-04** — Transcription is processed asynchronously; the user must see progress status (queued → processing → complete → error).

**FR-ASR-05** — ASR engine: **OpenAI Whisper** (self-hosted via `whisper` Python package or `faster-whisper`) for word-level timestamps. Speaker diarization via **pyannote.audio**.

> **Assumption**: The platform is self-hosted. Cloud ASR APIs (Google, AWS) are not required for MVP but the ASR module must be swappable via an adapter interface.

### 3.4 Audio–Text Alignment

**FR-ALN-01** — The transcript editor must display audio with precise word-level timestamp alignment.

**FR-ALN-02** — Clicking a word in the transcript must seek the audio player to that word's `start_time`.

**FR-ALN-03** — During playback, the currently spoken word must be highlighted in the editor.

**FR-ALN-04** — When a transcriptionist edits a word that has a timestamp, the system must flag that the alignment may be stale and offer to re-run alignment.

**FR-ALN-05** — Alignment data is stored per segment and updated on demand.

### 3.5 Transcription Editor

**FR-ED-01** — The editor must display transcript segments grouped by speaker.

**FR-ED-02** — Audio controls required:
- Play / Pause (shortcut: `Space`)
- Rewind 5 seconds (shortcut: `Tab`)
- Playback speed: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2× (shortcut: `Ctrl+Shift+Up/Down`)
- Waveform visualization with seek-by-click (via WaveSurfer.js)

**FR-ED-03** — Transcript editing controls required:
- Speaker label insertion / reassignment
- Tag insertion from a picker listing all tags defined in the active style guide
- Inline timestamp insertion
- Keyboard shortcuts for common transcriptionist operations (configurable)

**FR-ED-04** — The editor must auto-save changes every 30 seconds and on blur.

**FR-ED-05** — The editor must support an undo/redo stack (min 50 operations).

### 3.6 Rule Validation System

**FR-VAL-01** — The editor must continuously validate the transcript against the active style guide rules.

**FR-VAL-02** — Validation must run:
- In real-time as the user types (debounced 500 ms)
- On demand via a "Validate Now" button
- After style guide version change

**FR-VAL-03** — Violations must be visually highlighted inline (underline or background color), categorized by type:
- `FormattingError`
- `TagMisuse`
- `PunctuationError`
- `SpeakerLabelError`
- `StyleGuideViolation` (catch-all for guide-specific rules)

**FR-VAL-04** — Hovering a violation must show the rule text that was violated and a suggested correction where possible.

**FR-VAL-05** — A validation summary panel must list all errors with their transcript location (segment, position).

**FR-VAL-06** — Validation logic must be generated dynamically from stored rules. The LLM is called to convert each stored `rule_text` into a JavaScript-compatible validation function or regex pattern during style guide activation.

### 3.7 AI Accuracy Review

**FR-AI-01** — Words with `confidence_score < 0.7` must be flagged as low-confidence and highlighted in a distinct color.

**FR-AI-02** — A "Review Suggestions" panel must list all low-confidence segments sorted by confidence score ascending.

**FR-AI-03** — Clicking a suggestion seeks the audio to that word for manual verification.

**FR-AI-04** — After manual review, the transcriptionist can mark a word as "verified" to clear the flag.

### 3.8 Export System

**FR-EXP-01** — Completed transcripts must be exportable in the following formats:
- **TXT** — plain text with speaker labels and timestamps per style guide format
- **DOCX** — formatted document with speaker labels
- **JSON** — full structured output including word-level timestamps and confidence scores
- **TranscribeMe format** — submission-ready TXT/DOCX matching TranscribeMe's upload requirements (format derived from the active style guide rules, not hard-coded)

**FR-EXP-02** — Export formatting (spacing, headers, timestamp format) must follow the active style guide rules, not static templates.

---

## 4. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | Audio files up to 2 GB must be supported |
| NFR-02 | Transcription of a 1-hour audio file must complete within 15 minutes on standard hardware |
| NFR-03 | The editor must remain responsive (< 100 ms input latency) for transcripts up to 50,000 words |
| NFR-04 | All user data must be stored locally (no mandatory cloud dependency) |
| NFR-05 | The application must run on Linux and Windows server environments |
| NFR-06 | The UI must be accessible (WCAG 2.1 AA) |

---

## 5. Database Schema

### AudioFiles
| Column | Type | Notes |
|--------|------|-------|
| audio_id | UUID PK | |
| filename | TEXT | original filename |
| file_path | TEXT | storage path |
| duration | FLOAT | seconds |
| upload_date | TIMESTAMP | |
| status | ENUM | queued, processing, complete, error |

### Transcripts
| Column | Type | Notes |
|--------|------|-------|
| transcript_id | UUID PK | |
| audio_id | UUID FK → AudioFiles | |
| version | INTEGER | increments on each save |
| style_guide_version_id | UUID FK → StyleGuideDocuments | active guide at creation |
| last_modified | TIMESTAMP | |

### TranscriptSegments
| Column | Type | Notes |
|--------|------|-------|
| segment_id | UUID PK | |
| transcript_id | UUID FK → Transcripts | |
| speaker | TEXT | e.g. "Speaker 1" |
| text | TEXT | full segment text |
| start_time | FLOAT | seconds |
| end_time | FLOAT | seconds |
| confidence | FLOAT | average word confidence |
| word_data | JSONB | array of {word, start, end, confidence, speaker_id} |

### StyleGuideDocuments
| Column | Type | Notes |
|--------|------|-------|
| guide_id | UUID PK | |
| pdf_file_path | TEXT | |
| upload_date | TIMESTAMP | |
| version | TEXT | semantic version or label |
| is_active | BOOLEAN | only one TRUE at a time |
| parsed_at | TIMESTAMP | |

### StyleGuideRules
| Column | Type | Notes |
|--------|------|-------|
| rule_id | UUID PK | |
| guide_id | UUID FK → StyleGuideDocuments | |
| rule_type | TEXT | e.g. SpeakerFormatting |
| rule_text | TEXT | human-readable description |
| validation_logic | TEXT | JS regex / function string |
| source_page | INTEGER | |
| is_active | BOOLEAN | |

### ValidationErrors
| Column | Type | Notes |
|--------|------|-------|
| error_id | UUID PK | |
| transcript_id | UUID FK → Transcripts | |
| segment_id | UUID FK → TranscriptSegments | |
| rule_id | UUID FK → StyleGuideRules | |
| error_type | TEXT | |
| position_start | INTEGER | char offset in segment text |
| position_end | INTEGER | |
| message | TEXT | |
| is_resolved | BOOLEAN | |

### Users
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID PK | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | |
| role | ENUM | admin, transcriptionist |
| created_at | TIMESTAMP | |

---

## 6. System Architecture

```
┌──────────────┐     HTTP/WS      ┌───────────────────────────────────────┐
│   Browser    │ ◄──────────────► │          Backend API (Node.js)         │
│  (React SPA) │                  │                                         │
└──────────────┘                  │  ┌──────────────┐  ┌────────────────┐  │
                                  │  │  REST API    │  │  WebSocket     │  │
                                  │  │  (Express)   │  │  (live status) │  │
                                  │  └──────────────┘  └────────────────┘  │
                                  │                                         │
                                  │  ┌──────────────┐  ┌────────────────┐  │
                                  │  │  Job Queue   │  │  Rule Engine   │  │
                                  │  │  (BullMQ)    │  │  (LLM-backed)  │  │
                                  │  └──────┬───────┘  └────────────────┘  │
                                  └─────────│───────────────────────────────┘
                                            │
                          ┌─────────────────┴──────────────────┐
                          │         Python Worker Service        │
                          │  ┌─────────────┐  ┌─────────────┐  │
                          │  │   Whisper   │  │  pyannote   │  │
                          │  │  (ASR)      │  │ (diarize)   │  │
                          │  └─────────────┘  └─────────────┘  │
                          └────────────────────────────────────┘
                                            │
                          ┌─────────────────┴──────────────────┐
                          │         PostgreSQL Database          │
                          └────────────────────────────────────┘
```

**Tech Stack Decisions**:
- **Frontend**: React 18, TypeScript, TailwindCSS, WaveSurfer.js, TipTap (rich text editor)
- **Backend API**: Node.js, Express, TypeScript, Prisma ORM
- **Job Queue**: BullMQ + Redis (async transcription jobs)
- **ASR Worker**: Python FastAPI microservice wrapping `faster-whisper` + `pyannote.audio`
- **PDF Parsing**: `pdf-parse` (Node.js) for text extraction
- **Rule Extraction**: OpenAI GPT-4o API (or locally via Ollama for fully offline deployments)
- **Database**: PostgreSQL 15
- **File Storage**: Local filesystem (configurable S3 adapter for production)
- **Auth**: JWT tokens, bcrypt password hashing

---

## 7. User Flows

### 7.1 Admin: Upload Style Guide
1. Admin navigates to **Style Guide** section
2. Uploads PDF → system parses and extracts rules
3. Admin reviews extracted rules in a table
4. Admin edits/deletes incorrect rules manually
5. Admin activates the new version → existing transcripts re-validated

### 7.2 Transcriptionist: Transcribe Audio
1. Uploads audio file → sees transcription progress
2. When complete, opens transcript in editor
3. Audio plays in sync with highlighted text
4. Edits text, inserts tags, corrects speakers
5. Validation panel flags rule violations in real-time
6. Reviews low-confidence segments via AI Review panel
7. Marks transcript as complete
8. Exports in desired format

---

## 8. Out of Scope (MVP)

- Multi-user collaboration / concurrent editing
- Cloud deployment automation (CI/CD pipelines)
- Mobile / tablet UI optimization
- Native desktop application
- Third-party ASR API integrations (Google, AWS, Azure)
- Billing / subscription management
- SAML/SSO authentication

---

## 9. Assumptions & Decisions

| # | Assumption |
|---|------------|
| A1 | The platform is self-hosted; no mandatory cloud services required |
| A2 | OpenAI API key is required for rule extraction; Ollama fallback is planned but not MVP |
| A3 | Audio files are stored on the server filesystem; S3 is a future enhancement |
| A4 | A single active style guide applies globally to all transcripts |
| A5 | The validation logic (JS functions) is generated by LLM once at guide activation, cached in DB |
| A6 | Whisper model size defaults to `medium`; configurable via environment variable |
| A7 | Re-validation on guide version change is background-queued, not instant |

---

## 10. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | Uploading a PDF style guide produces a list of extracted rules with types and page numbers |
| AC-02 | Activating a new guide version re-validates all transcripts and surfaces new errors |
| AC-03 | Uploading an audio file triggers ASR transcription with word-level timestamps |
| AC-04 | Clicking a word in the editor seeks audio to that word's timestamp |
| AC-05 | Words violating an active style guide rule are highlighted in the editor |
| AC-06 | Words with confidence < 0.7 are flagged and listed in the review panel |
| AC-07 | Transcript can be exported as TXT, DOCX, and JSON |
| AC-08 | Switching the active style guide version triggers re-validation of all transcripts |
| AC-09 | All ASR and validation processing is non-blocking (async queue) |
| AC-10 | Style guide rules can be manually edited in the Admin UI without re-uploading the PDF |
