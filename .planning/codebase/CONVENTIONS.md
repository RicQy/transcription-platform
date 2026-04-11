# Development Conventions

**Analysis Date:** 2026-04-11

## Code Style

### 1. Languages & Dialects
- **TypeScript:** Mandatory for all application logic. 
- **Strict Mode:** Enabled in `tsconfig.base.json`.
- **Typing:** Explicit types preferred over `any`. Interface definitions in `packages/shared-types` are the source of truth for cross-package communication.

### 2. Formatting
- **Prettier:** Standardized via `.prettierrc`.
- **ESLint:** Enforced for code quality in all packages.
- **Naming:**
  - Variables/Functions: `camelCase`
  - Components/Interfaces: `PascalCase`
  - Constants: `SCREAMING_SNAKE_CASE`

## Architecture Patterns

### 1. Monorepo Workflow
- **Dependency Management:** Use `pnpm` exclusively. Never use `npm` or `yarn` inside the workspace.
- **Cross-package Imports:** Reference internal packages via their `@transcribe/*` namespace.

### 2. Frontend (React)
- **Hooks:** Use functional components and hooks.
- **State:** Zustand for persistent/global state; React Query for remote data.
- **Tailwind:** Utility-first styling. No custom CSS unless absolutely necessary (defined in `index.css`).

### 3. Backend (Express)
- **Error Handling:** Use centralized `errorHandler` middleware.
- **Async:** Use `async/await` with proper `try/catch` or wrapper utilities.
- **DB Interface:** Use the `db.ts` shim to maintain consistent query patterns across the API.

## API Standards

### 1. REST Endpoints
- **Response Format:** Consistent JSON objects.
- **Versioning:** Implicitly current.
- **Authentication:** Bearer token (JWT) for protected routes.

### 2. WebSocket Patterns
- **Events:** Namespaced `transcription:*` for pipeline events.
- **Stability:** Clients must handle disconnection/reconnection logic.

---

*Conventions Map: 2026-04-11*
