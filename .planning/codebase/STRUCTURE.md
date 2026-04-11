# Project Structure

**Analysis Date:** 2026-04-11

## Root

- `package.json` - Workspace definition and root dependencies.
- `pnpm-workspace.yaml` - Monorepo package configuration.
- `tsconfig.base.json` - Common TypeScript configuration.
- `Dockerfile` - Multi-stage production build definition.

## Apps

### `/apps/web` (Frontend - React/Vite)
- `/src/pages` - Core application views (Dashboard, Editor, Login).
- `/src/components` - Reusable UI elements (TranscriptEditor, FileUploader).
- `/src/store` - Zustand store for auth and global state.
- `/src/hooks` - React hooks for data fetching (React Query).
- `/src/__tests__` - Frontend unit and integration tests.

### `/apps/api` (Backend - Express/Node.js)
- `/src/index.ts` - Server entry point and middleware configuration.
- `/src/db.ts` - PostgreSQL client and Supabase-style query shim.
- `/src/routes` - API endpoint definitions.
- `/src/workers` - BullMQ worker implementations for transcription.
- `/src/services` - Core business orchestration logic.
- `/src/schema.sql` - Main database definition for PostgreSQL.

## Packages (Shared Libraries)

### `/packages/cvl-engine` (Deterministic Legal Processor)
- `/src/engine.ts` - The primary text transformation engine.
- `/src/rules` - Definitions for filler removal, slang normalization, etc.
- `/src/types.ts` - Internal engine interfaces and types.

### `/packages/shared-types` (Type Definitions)
- `/src/index.ts` - Source of truth for API/Web shared data structures.

## Documentation & Planning

### `/.planning` (Project Memory)
- `/codebase` - This directory (Systems Map).
- `/phases` - Detailed implementation plans for each work phase.
- `PROJECT.md` - High-level project definition and value proposition.
- `STATE.md` - Current status of development.

---

*Structure map: 2026-04-11*
