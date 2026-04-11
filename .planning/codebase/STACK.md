# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 5.4 - All application code (API, Web, Shared Types, CVL Engine)

**Secondary:**
- SQL - Database schema (PostgreSQL)
- Shell - Build and deployment automation

## Runtime

**Environment:**
- Node.js >=20
- Browser (Modern evergreen browsers via Vite)

**Package Manager:**
- pnpm 10.x (Monorepo setup with `pnpm-workspace.yaml`)
- Lockfile: `pnpm-lock.yaml`

## Frameworks & Build Tools

**Core:**
- Express 4.19 (API) - Node.js web server
- React 18.3 (Web) - UI framework
- Vite 5.2 (Web) - Build tool and development server

**Styling:**
- Tailwind CSS 3.4 (Web) - Utility-first styling
- PostCSS / Autoprefixer

**Testing:**
- Vitest 1.6 (Web/API/Packages) - Unified testing framework
- React Testing Library - Frontend component testing

## Key Dependencies

**AI & Transcription:**
- `replicate` 1.4+ - WhisperX inference for word-level alignment & diarization
- `@anthropic-ai/sdk` 0.8+ - Claude 3.5 Sonnet for jurisdictional styling
- `@transcribe/cvl-engine` (Internal) - Deterministic legal compliance processor

**Infrastructure & Comms:**
- `pg` 8.2+ - PostgreSQL driver with connection pooling
- `bullmq` - Background worker queue (Redis-backed)
- `socket.io` 4.8 - Real-time pipeline status streaming
- `multer` - Audio file upload handling
- `jsonwebtoken` / `bcrypt` - Authentication and security

**Frontend State:**
- `zustand` - Global client-side state
- `@tanstack/react-query` - Server state and data fetching
- `wavesurfer.js` - Audio visualization
- `tiptap` - Headless rich-text editor for transcripts

## Configuration & Standards

- **Linting:** ESLint 8.5+ with TypeScript focus
- **Formatting:** Prettier 3.2+
- **Version Control:** Git
- **CI/CD Readiness:** Docker-ready (root Dockerfile), Vercel/Railway compatible

---

*Stack Analysis: 2026-04-11*

