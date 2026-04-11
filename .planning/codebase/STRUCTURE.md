# Directory Structure

**Analysis Date:** 2026-04-11

## Monorepo Layout

```text
legal-transcribe-app/
├── .agent/                 # Agent-specific workflows and configurations
├── .gemini/                # Antigravity/Gemini specific configurations
├── apps/                   # Deployable applications
│   ├── api/                # Express backend
│   │   └── src/            # API source code (index.ts, db.ts, schema.sql)
│   └── web/                # React frontend
│       └── src/            # Frontend source code (pages, components, hooks)
├── packages/               # Internal shared packages
│   ├── cvl-engine/         # Legal compliance rule engine
│   └── shared-types/       # Shared TypeScript interfaces
├── session-notes/          # Tracking for development sessions
├── .env                    # Root environment variables
├── package.json            # Monorepo root configuration
├── pnpm-workspace.yaml     # Workspace definitions
└── tsconfig.base.json      # Shared TS configurations
```

## Application Structures

### apps/api/src
- `index.ts` - Main entry point, routes, and transcription orchestration.
- `db.ts` - Database client and Supabase-like shim.
- `schema.sql` - Database schema definition for local/manual setup.

### apps/web/src
- `pages/` - Top-level page components (DashboardPage, AudioUploadPage).
- `components/` - Reusable UI components (Layout, AuthForm).
- `hooks/` - Custom React hooks for data fetching and logic.
- `store/` - Zustand global state definitions.
- `utils/` - Helper functions and formatters.
- `__tests__/` - Vitest test files.

### packages/cvl-engine
- Business logic for processing transcriptions according to legal standards.

## Key File Locations

- **API Entry:** `apps/api/src/index.ts`
- **Web Entry:** `apps/web/src/main.tsx`
- **Global Styles:** `apps/web/src/index.css`
- **Shared Types:** `packages/shared-types/src/index.ts`
- **DB Client:** `apps/api/src/db.ts`

---

*Structure map: 2026-04-11*
