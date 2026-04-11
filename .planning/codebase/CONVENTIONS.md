# Coding Conventions

**Analysis Date:** 2026-04-11

## Language & Style

- **Language:** TypeScript 5.4.
- **Formating:** Prettier is used project-wide with standard settings.
- **Linting:** ESLint with recommended TypeScript and React rules.
- **Naming:**
  - Variables/Functions: `camelCase`
  - Classes/Components: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.ts` (mostly), but React components often use `PascalCase.tsx`.

## Patterns & Practices

### Backend (apps/api)
- **Modular Imports:** Uses ES modules (`import/export`).
- **Async/Await:** Preferred over raw promises or callbacks.
- **Error Handling:** `try...catch` blocks around database and external API calls.
- **Controllers:** Currently inlined in `index.ts` due to lean size, but following a route-handler pattern.
- **Dependency Isolation:** Internal packages like `cvl-engine` used for complex logic.

### Frontend (apps/web)
- **Functional Components:** React functional components with Hooks.
- **CSS:** Tailwind CSS for styling with utility-first approach.
- **Data Fetching:** React Query for caching and sync management.
- **State Management:** Zustand for lightweight global state (e.g., Auth).
- **Component Structure:** `Layout` component wraps page content for consistency.

## Database & Data

- **Supabase Shim:** Code interacts with raw PostgreSQL using a Supabase-like syntax (`db.from('table').select(...)`) implemented in `apps/api/src/db.ts`.
- **Primary Keys:** UUIDs are used for all tables (generated via `gen_random_uuid()` in SQL).
- **Snake Case:** Column names in DB use `snake_case`.

## Security

- **Authentication:** JWT-based auth with `Bearer` token in `Authorization` header.
- **Passwords:** Hashed using `bcrypt` (10 rounds).
- **Environment Variables:** All secrets and service URLs must be in `.env`.

---

*Convention map: 2026-04-11*
