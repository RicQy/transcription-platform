# Investigation: Tutorial vs My App Comparison

## Tutorial: ai-powered-realtime-hospital-management-system
**URL**: https://github.com/BensonRaro/ai-powered-realtime-hospital-management-system

---

## Overview Comparison

| Aspect | Tutorial | My App |
|---|---|---|
| Domain | Hospital management | Legal audio transcription |
| Backend runtime | Bun | Node.js |
| Frontend framework | React Router v7 (SSR/framework mode) | React + Vite (SPA) |
| Database | MongoDB | PostgreSQL (pg pool) |
| Auth | Better Auth (library) | Custom JWT (bcrypt + jsonwebtoken) |
| File uploads | UploadThing (cloud) | multer (local disk) |
| Background jobs | Inngest | Fire-and-forget async functions |
| Realtime | Socket.IO | Socket.IO |
| UI components | shadcn/ui | Tailwind only (no component library) |
| Testing | None visible | Vitest (has test suite) |

---

## Tutorial Architecture

### Backend (`backend/`)
- **Runtime**: Bun v1.3.3
- **Structure**: MVC (controllers/, models/, routes/, middleware/, config/, lib/, inngest/)
- **Auth**: Better Auth library — session-based with cookies, supports OAuth
- **DB**: MongoDB via `connectDB()`
- **Realtime**: Socket.IO — `initSocket(httpServer)` / `getIO()` pattern (properly separated)
- **Background jobs**: Inngest functions: `admitPatient`, `analyzeXRayJob`, `addChargeToInvoice`
- **File uploads**: UploadThing (cloud-hosted file storage service)
- **Security**: Helmet, cookie-parser, CORS with credentials
- **Models**: activityLog, invoice, labResults, notification

### Frontend (`frontend/`)
- **Framework**: React Router v7 (framework mode with SSR capability)
- **Routing**: File-based routes (routes.ts convention)
- **UI**: TailwindCSS + shadcn/ui components
- **Pages**: Dashboard, Patients, Doctors, Nurses, Admins, ActivitiesLog, FinancialHistory, Profile, Login
- **AI Feature**: X-ray image analysis via Inngest job (`analyzeXRayJob`)

---

## My App Architecture

### Backend (`apps/api/`)
- **Runtime**: Node.js
- **Structure**: Single monolithic `index.ts` (~244 lines) with all routes inline
- **Auth**: Manual JWT (bcrypt hash + jsonwebtoken sign/verify)
- **DB**: PostgreSQL with custom Supabase-like query builder wrapping `pg.Pool`
- **Realtime**: Socket.IO directly in index.ts, emits per-file events like `audio:${audioFileId}:status`
- **Background jobs**: `transcribeAsync()` called without await (fire-and-forget, no retry on failure)
- **File uploads**: multer (saves to local `uploads/` folder, served via `express.static`)
- **AI**: Replicate WhisperX for speech-to-text, Anthropic Claude for style application, custom CVL engine
- **Schema**: users, audio_files, transcripts, style_guides, style_guide_rules

### Frontend (`apps/web/`)
- **Framework**: React + Vite (SPA, client-side routing)
- **Routing**: react-router-dom v6
- **State**: React Query (@tanstack/react-query)
- **Pages**: Login, Dashboard, AudioUpload, TranscriptEditor, StyleGuideAdmin
- **Testing**: Vitest + Testing Library

---

## Key Differences

### 1. Auth Strategy
- **Tutorial**: Better Auth library handles sessions, token rotation, OAuth. Production-grade.
- **My App**: Manual JWT with `bcrypt`. Works but lacks: refresh tokens, session invalidation, OAuth, security hardening.
- **Gap**: My app's auth is fragile. JWT secret fallback `'legal-transcribe-local-secret'` in prod is a security risk.

### 2. Backend Structure
- **Tutorial**: Proper MVC separation (controllers, models, routes, middleware each in own folders).
- **My App**: All 244 lines in one `index.ts`. Not scalable, hard to test individual routes.

### 3. File Storage
- **Tutorial**: UploadThing — cloud storage, CDN-backed, production-ready.
- **My App**: Local disk (`uploads/` folder). Files lost on redeploy; not scalable; URL ties to server hostname.

### 4. Background Job Reliability
- **Tutorial**: Inngest — retry on failure, queuing, observability, durable execution.
- **My App**: `transcribeAsync()` is fire-and-forget. If server crashes mid-transcription or Replicate fails without retry, job silently fails.

### 5. Socket.IO Event Naming (Bug Found)
- **Server emits**: `audio:${audioFileId}:status`, `audio:${audioFileId}:progress`, `audio:${audioFileId}:finished`, `audio:${audioFileId}:error`
- **Client listens for**: `TRANSCRIPTION_STARTED`, `TRANSCRIPTION_PROGRESS`, `TRANSCRIPTION_FINISHED`, `TRANSCRIPTION_FAILED`
- **Result**: Client never receives realtime updates — events never match. This is a live bug.

### 6. useSocket Hook API Mismatch (Bug Found)
- **DashboardPage calls**: `socket.subscribe('audio:${file.id}')` (1 arg) and `socket.unsubscribe('audio:${file.id}')`
- **useSocket returns**: `subscribe(channel, event, cb)` (3 args required) and no `unsubscribe` method
- **Result**: `subscribe` is called with wrong arity (no-op), and `unsubscribe` throws a runtime error.

### 7. Database Builder Limitations
- **My App**: The custom `db` wrapper in `db.ts` is incomplete — `from().select()` has no direct `.execute()` method (only through `.eq().execute()`). The `index.ts` calls `db.from('audio_files').select('*').execute()` which doesn't exist, causing a runtime error.

### 8. Frontend Framework
- **Tutorial**: React Router v7 framework mode enables SSR, server loaders/actions, better SEO.
- **My App**: SPA-only. Fine for internal tools but no SSR capability.

### 9. Missing audio_files `duration` column
- **DashboardPage** uses `file.duration` and `file.status` fields.
- **schema.sql** `audio_files` table has no `duration` or `status` column — only `transcription_status`.
- **Result**: Duration always shows `—` (null); status field is undefined, `StatusBadge` always falls back to gray.

---

## Shared Patterns

Both apps share:
- Socket.IO for realtime updates
- TypeScript throughout
- TailwindCSS for styling
- Authentication guards on routes
- Express-based REST API backend
- Separation of frontend/backend into distinct apps

---

## Summary of Bugs in My App

1. **Socket event name mismatch**: Server emits `audio:${id}:finished` etc., client listens for `TRANSCRIPTION_FINISHED` etc. — realtime updates never arrive.
2. **useSocket `subscribe`/`unsubscribe` mismatch**: DashboardPage calls `socket.subscribe(channel)` with 1 arg and `socket.unsubscribe` which doesn't exist in the hook.
3. **`db.from().select().execute()` missing**: The `audio-files` list endpoint calls this non-existent method.
4. **Missing `duration` and `status` DB columns**: Schema lacks these columns that the frontend expects.
5. **JWT secret fallback in production**: `JWT_SECRET` falls back to a hardcoded string if env var is missing.
6. **Local file storage**: `uploads/` folder is not persistent across deploys.

---

## What the Tutorial Does Better

1. **MVC structure** — easier to scale and maintain
2. **Better Auth** — production-grade auth out of the box
3. **Inngest** — reliable, retryable background jobs
4. **UploadThing** — cloud file storage
5. **Socket.IO separation** — `initSocket/getIO` pattern keeps socket logic clean
6. **Rich domain model** — patients, doctors, nurses, invoices, lab results, notifications, activity logs

## What My App Does Better

1. **Testing** — has a full Vitest test suite; tutorial has none
2. **AI pipeline** — more sophisticated: WhisperX → Claude → CVL enforcement pipeline
3. **Monorepo** — pnpm workspaces with shared-types package
4. **Audio conversion** — client-side FFmpeg conversion to PCM before upload
5. **Transcript editing** — dedicated TranscriptEditor page with CVL enforcement stats
