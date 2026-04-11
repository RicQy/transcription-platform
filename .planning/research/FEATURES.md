# Research: Legal Transcription Features & Benchmarks

**Analysis Date:** 2026-04-11
**Objective:** Benchmarking "Table Stakes" vs "Perfection" features.

## Feature Dimensions

### 1. Table Stakes (Must Have)
- **Automatic Diarization:** Identify which speaker is talking at which time.
- **Timestamped Alignment:** Every word or segment must have accurate start/end times for playback syncing.
- **Clean Verbatim (CVL):** Removal of stutters, fillers, and false starts without altering legal meaning.
- **Secure Handling:** Encryption at rest and in transit (TLS 1.3, SSE-S3).

### 2. Differentiators (Strategic Advantage)
- **Global Speaker Management:**
  - One-click merging of speakers (Speaker A + Speaker C -> Witness).
  - Persistence of speaker names across the entire project.
  - User-defined speaker profiles (Judge, Attorney, Witness, Bailiff).
- **Advanced Export Formats:**
  - **Legal DOCX:** Specific margins, line numbering, and header/footer structures required by courts.
  - **SRT/VTT:** For video evidence playback with captions.
  - **Audit Log Export:** Documenting EVERY change made to a transcript for chain-of-custody.

### 3. "Perfection" Features (The Zero-Compromise Tier)
- **Bulk Processing Queue:** Drag-and-drop 50 files and walk away. UI displays a unified processing dashboard with ETA.
- **Confidence Highlighting:** Visually flagging low-confidence words (e.g., <70% ASR match) for manual verification.
- **Cross-File Keyword Tracking:** Finding mentions of a specific case ID or person across multiple depositions in one view.

## Anti-Features (Avoid Building)
- **Real-time Streaming Transcription:** Usually lowers accuracy significantly. Legal transcription prioritizes "The Record" (post-processing accuracy) over "The Instant" (low-latency streaming).
- **Mobile Editing:** Most legal correction happens on desktops with specialized foot pedals and keyboards. Focus on desktop excellence first.

## Dependency Map
1. **Speaker Management** depends on **WhisperX Diarization Output**.
2. **Bulk Processing** depends on **BullMQ/Redis Infrastructure**.
3. **Legal DOCX** depends on the **`docx` npm library** and a pre-defined legal template engine.

---
*Confidence: High*
