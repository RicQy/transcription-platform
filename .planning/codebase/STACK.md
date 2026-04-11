# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 5.4 - All application code (API, Web, Shared Types, CVL Engine)

**Secondary:**
- SQL - Database schema and queries
- Shell - Build and deployment scripts

## Runtime

**Environment:**
- Node.js >=20
- Browser (Evergreen browsers supported by Vite)

**Package Manager:**
- pnpm 10.28.0 (Monorepo with pnpm-workspace.yaml)
- Lockfile: `pnpm-lock.yaml` present

## Frameworks

**Core:**
- Express 4.19 (API) - Web server
- React 18.3 (Web) - UI framework
- Vite 5.2 (Web) - Build tool and dev server

**Testing:**
- Vitest 1.6 (Web) - Unit testing
- Testing Library (React) - UI component testing

**Build/Dev:**
- tsx (API) - TypeScript execution for dev
- Tailwind CSS 3.4 (Web) - Styling foundation
- PostCSS / Autoprefixer

## Key Dependencies

**Critical:**
- @anthropic-ai/sdk 0.82 - LLM-based formatting and cleanup
- replicate 1.4 - AI inference for WhisperX transcription
- @transcribe/cvl-engine (internal) - Deterministic legal compliance enforcement
- socket.io 4.8 - Real-time transcription progress updates

**Infrastructure:**
- pg 8.20 - PostgreSQL client with pool management
- jsonwebtoken / bcrypt - Authentication and security
- multer - Audio file upload handling
- zustand / @tanstack/react-query - Web state management

## Configuration

**Environment:**
- `.env` files - Local environment configuration
- JWT_SECRET, DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY required

**Build:**
- `tsconfig.base.json` - Base TypeScript options
- `pnpm-workspace.yaml` - Monorepo workspace definitions
- `vite.config.ts` (apps/web) - Frontend build configuration

## Platform Requirements

**Development:**
- Windows/Linux/macOS with Node.js 20+
- Local PostgreSQL and Redis recommended (referenced in .env)

**Production:**
- Deployment Target: Support for Docker, Railway, or similar Node.js hosting.
- PostgreSQL Database required.

---

*Stack analysis: 2026-04-11*
*Update after major dependency changes*
