# Research: Domain Pitfalls in Legal Transcription

**Analysis Date:** 2026-04-11
**Objective:** Risk mitigation for high-accuracy production apps.

## Primary Risks

### 1. The "Hallucination" Trap
- **Risk:** LLMs (Claude/GPT) might accidentally "correct" a fact or name that was misheard by ASR but is legally critical.
- **Mitigation:** Strict separation between **ASR (Full Verbatim)** and **Styling (Clean Verbatim)**. Always store the raw ASR output and allow the user to toggle back to it if the LLM-cleaned version seems suspect.

### 2. Large File Timeouts
- **Risk:** Standard HTTP connections and even basic Docker configurations can time out on files >200MB.
- **Mitigation:** Use S3 Multipart uploads. On the server side, set `lockDuration` in BullMQ to handle jobs lasting up to 1 hour.

### 3. Diarization Drift
- **Risk:** WhisperX might lose track of a speaker in a long deposition with many interruptions.
- **Mitigation:** Provide a "Speaker UI" that allows users to easily re-assign segments or batch-rename speakers across the entire file.

### 4. Legal Compliance Conflicts
- **Risk:** Different courts have different "Clean Verbatim" standards. 
- **Mitigation:** Implement **Pluggable Style Guides**. Don't bake rules into the code; bake a "Rules Engine" that interprets a JSON schema of rules.

### 5. Memory Leaks in Audio Processing
- **Risk:** Processing long audio on the backend (e.g., using `fluent-ffmpeg` or `wavesurfer` on node) can lead to massive heap growth.
- **Mitigation:** Move heavy audio processing (waveform generation) to the **Client-side** using browser-based Wavesurfer or a dedicated worker process that restarts after every few jobs.

### 6. Secret Management
- **Risk:** API keys for Replicate/Anthropic are expensive. Leaking them in an app that's "close to free" can lead to massive unexpected bills.
- **Mitigation:** Use a secure Vault system or strictly manage environment variables; never include them in logs.

---
*Confidence: High*
