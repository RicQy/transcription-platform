# Plan 04-02: Courtroom-Ready Legal Exports

Implement professional export capabilities for legal transcripts, ensuring compliance with courtroom formatting standards.

## Objectives
- Generate PDF transcripts with line numbers, side margins, and jurisdictional branding.
- Provide native MS Word (DOCX) exports for further legal drafting.
- Integrate export controls directly into the corrected transcript editor.

## Implementation Details

### Technology Stack
- **PDF**: `jsPDF` for client-side generation, `jspdf-autotable` for potential layout grids.
- **DOCX**: `docx` library for structured Word document generation.
- **File Delivery**: `file-saver` for triggering browser downloads.

### Feature Set
- **Line Numbering**: Automated left-margin line numbering (1-25 convention approximated with continuous numbering).
- **Jurisdictional Headers**: Center-aligned jurisdictional labels (e.g., "STATE OF FLORIDA") derived from style guide metadata.
- **Header Metadata**: Inclusion of Transcript ID and Audio Filename in the page header for auditability.
- **Double-Spacing**: Applied to DOCX exports to follow standard legal drafting procedures.

## Verification Results
- [x] Verified `jspdf` and `docx` installation.
- [x] Verified `ExportService` logic for text splitting and page wrapping.
- [x] Verified UI integration in `TranscriptEditorPage`.
- [x] Confirmed `tsc` build stability.
