# Product Requirements Document
## TranscribeMe-Compatible Transcription Platform

---

## 1. Overview

Build a full-stack web application that transcribes audio files, aligns transcripts to audio with word-level timestamps, and enforces formatting rules defined entirely by an uploaded PDF style guide. No transcription rules are hard-coded; the uploaded guide is the single source of truth.

---

## 2. Goals

- Reduce manual formatting correction for transcriptionists.
- Support style guide updates without requiring code changes.
- Produce transcripts that are submission-ready for TranscribeMe workflows.
- Provide a professional editing environment with real-time rule validation.

---

## 3. Non-Goals

- Not a real-time/live transcription tool.
- No native mobile app (web-only).
- No built-in billing or team management.
- No multi-language ASR (English only in v1; architecture must be language-agnostic for future extension).

---

## 4. Users

| Role | Description |
|---|---|
| Transcriptionist | Uploads audio, edits transcript, exports final file |
| Admin | Uploads/manages style guide PDFs, manages active version |

---

## 5. Feature Requirements

### 5.1 Style Guide Ingestion

**FR-SG-01** — An admin can upload a PDF file as a style guide.

**FR-SG-02** — Upon upload, the system must parse the PDF text and extract discrete transcription rules using an AI/LLM pipeline.

**FR-SG-03** — Each extracted rule must be stored with:
- `rule_id` (UUID)
- `guide_id` (FK to style guide document)
- `rule_type` (enum: `SpeakerFormatting`, `TagUsage`, `FillerWords`, `Punctuation`, `Capitalization`, `Timestamps`, `Other`)
- `rule_text` (human-readable description)
- `source_page` (integer)

**FR-SG-04** — The system must detect and extract at minimum the following rule categories from the PDF:
- Speaker labeling format
- Punctuation conventions
- Filler word handling (words to remove/tag)
- Tag usage rules (e.g., `[inaudible]`, `[crosstalk]`, `[unclear]`)
- Capitalization rules
- Timestamp format and placement
- Formatting examples

**FR-SG-05** — Extracted rules must be reviewable by the admin before activation.

---

### 5.2 Style Guide Versioning

**FR-SGV-01** — Each uploaded PDF generates a new versioned rule set.

**FR-SGV-02** — Previous versions are preserved and viewable.

**FR-SGV-03** — Admin can set any version as the "active" version.

**FR-SGV-04** — When a new version is activated, all transcripts are queued for revalidation against the new rule set. Validation errors are recalculated and updated.

---

### 5.3 Audio Transcription Engine

**FR-ASR-01** — The system accepts audio file uploads in formats: MP3, WAV, M4A, FLAC, OGG.

**FR-ASR-02** — Audio is submitted to an ASR engine (AssemblyAI or Whisper with word timestamps) that returns:
- `word` (string)
- `start_time` (float, seconds)
- `end_time` (float, seconds)
- `confidence_score` (float, 0–1)
- `speaker_id` (string, from diarization)

**FR-ASR-03** — The system must support speaker diarization (at minimum 2 speakers).

**FR-ASR-04** — ASR processing runs asynchronously; the user is notified when transcription is complete.

---

### 5.4 Audio–Text Alignment

**FR-ALN-01** — The editor synchronizes transcript text with audio via word-level timestamps from the ASR output.

**FR-ALN-02** — Clicking any word in the editor seeks the audio player to the corresponding timestamp.

**FR-ALN-03** — During playback, the currently spoken word is highlighted in the editor.

**FR-ALN-04** — When a transcriptionist edits a word, the system marks that word's alignment as "manual" (user-overridden) and retains the original timestamp range.

---

### 5.5 Transcription Editor

**FR-ED-01** — The editor presents transcript segments grouped by speaker with inline speaker labels.

**FR-ED-02** — Audio controls available in the editor:
- Play / Pause
- Rewind 5 seconds (keyboard shortcut: `F2` or configurable)
- Playback speed: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×
- Waveform display with clickable navigation

**FR-ED-03** — Editor toolbar includes quick-insert buttons for:
- Speaker labels
- Tags (populated from active style guide tag rules)
- Timestamps

**FR-ED-04** — Keyboard shortcuts for common transcriptionist actions (play/pause, rewind, insert tag, insert timestamp).

**FR-ED-05** — The editor must operate in a rich-text mode that allows inline highlights for validation errors without altering the saved transcript text.

---

### 5.6 Rule Validation System

**FR-VAL-01** — The validation engine runs continuously (debounced on edit) against the active style guide rule set.

**FR-VAL-02** — Violations are highlighted inline in the editor with colored underlines or highlights, categorized by error type:
- `FORMATTING` — layout/structure violations
- `TAG_MISUSE` — incorrect or missing tags
- `PUNCTUATION` — punctuation rule violations
- `SPEAKER_LABEL` — incorrect speaker label format
- `FILLER_WORD` — filler word present that should be removed/tagged
- `RULE_VIOLATION` — any other style guide rule

**FR-VAL-03** — Hovering over a highlighted violation shows the rule text that was violated.

**FR-VAL-04** — A validation summary panel lists all current errors with jump-to-error links.

**FR-VAL-05** — Validation is re-run when the active style guide version changes.

---

### 5.7 AI Accuracy / Confidence Review

**FR-ACC-01** — Words with a confidence score below a configurable threshold (default 0.75) are visually flagged for manual review.

**FR-ACC-02** — A "Review Queue" panel lists all low-confidence segments sorted by confidence score ascending.

**FR-ACC-03** — Mismatches between ASR output and manually edited text are tracked and surfaced to the transcriptionist.

---

### 5.8 Export System

**FR-EXP-01** — Completed transcripts can be exported in:
- Plain text (`.txt`) — speaker-labeled, formatted per active style guide
- Microsoft Word (`.docx`) — formatted per active style guide
- JSON with timestamps — includes word-level timing data
- TranscribeMe submission format (`.txt` with specific header/footer per guide)

**FR-EXP-02** — Export applies any outstanding auto-fixable rule violations before generating the file (with user confirmation).

---

## 6. Database Schema

### AudioFiles
| Column | Type | Notes |
|---|---|---|
| audio_id | UUID PK | |
| filename | VARCHAR | Original filename |
| storage_path | VARCHAR | Path/URL in object storage |
| duration | FLOAT | Seconds |
| upload_date | TIMESTAMP | |
| uploaded_by | UUID FK | User |

### Transcripts
| Column | Type | Notes |
|---|---|---|
| transcript_id | UUID PK | |
| audio_id | UUID FK | |
| version | INTEGER | Auto-increment per audio |
| active_guide_id | UUID FK | StyleGuideDocuments |
| status | ENUM | `processing`, `ready`, `in_review`, `complete` |
| last_modified | TIMESTAMP | |

### TranscriptSegments
| Column | Type | Notes |
|---|---|---|
| segment_id | UUID PK | |
| transcript_id | UUID FK | |
| speaker | VARCHAR | Speaker label |
| text | TEXT | Current text |
| start_time | FLOAT | Seconds |
| end_time | FLOAT | Seconds |
| confidence | FLOAT | Average confidence of segment |
| sequence | INTEGER | Order within transcript |

### WordTimestamps
| Column | Type | Notes |
|---|---|---|
| word_id | UUID PK | |
| segment_id | UUID FK | |
| word | VARCHAR | |
| start_time | FLOAT | |
| end_time | FLOAT | |
| confidence_score | FLOAT | |
| alignment_source | ENUM | `asr`, `manual` |

### StyleGuideDocuments
| Column | Type | Notes |
|---|---|---|
| guide_id | UUID PK | |
| pdf_storage_path | VARCHAR | |
| upload_date | TIMESTAMP | |
| version | INTEGER | |
| is_active | BOOLEAN | Only one active at a time |
| uploaded_by | UUID FK | |

### StyleGuideRules
| Column | Type | Notes |
|---|---|---|
| rule_id | UUID PK | |
| guide_id | UUID FK | |
| rule_type | ENUM | See FR-SG-03 |
| rule_text | TEXT | |
| source_page | INTEGER | |
| is_active | BOOLEAN | |

### ValidationErrors
| Column | Type | Notes |
|---|---|---|
| error_id | UUID PK | |
| transcript_id | UUID FK | |
| segment_id | UUID FK | |
| rule_id | UUID FK | StyleGuideRules |
| error_type | ENUM | See FR-VAL-02 |
| location | JSONB | `{word_index, char_start, char_end}` |
| message | TEXT | |
| resolved | BOOLEAN | |

---

## 7. Technical Constraints & Assumptions

- **Assumption**: The application is web-based (React frontend, Node.js/Python backend).
- **Assumption**: File storage uses a local filesystem or S3-compatible object store.
- **Assumption**: ASR provider is AssemblyAI (preferred for diarization + word timestamps) or OpenAI Whisper with pyannote for diarization.
- **Assumption**: PDF rule extraction uses an LLM (OpenAI GPT-4o or equivalent) with a structured output prompt.
- **Assumption**: Single-user or small-team deployment; no horizontal scaling requirements in v1.
- **Constraint**: API keys for ASR and LLM providers are supplied via environment variables; never stored in the database or committed to source.
- **Constraint**: All uploaded files (PDFs, audio) must be stored outside the web root.

---

## 8. Acceptance Criteria

1. Uploading a PDF style guide causes rule extraction to run and rules to appear in the admin rule viewer.
2. Uploading an audio file causes ASR transcription to run; completed transcript appears in the editor with speaker labels and word-level highlights during playback.
3. Editing the transcript to introduce a known style guide violation causes that violation to be highlighted within 2 seconds.
4. Uploading a new style guide version and activating it causes transcript validation errors to update without a page reload.
5. Exporting a completed transcript produces a well-formed `.txt`, `.docx`, and `.json` file.
6. Swapping the style guide PDF to a completely different ruleset changes the validation behavior without any code deployment.

---

## 9. Out of Scope for v1

- Real-time collaborative editing
- Mobile/native app
- Custom ASR model training
- Multi-language support
- User authentication/authorization beyond basic admin vs. transcriptionist roles
