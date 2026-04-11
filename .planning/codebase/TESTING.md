# Testing Practices

**Analysis Date:** 2026-04-11

## Test Environment

- **Framework:** Vitest 1.6.0.
- **Environment:**
  - JSDOM for frontend testing.
  - Node.js for API/package testing.
- **Runner:** `npm run test` or `pnpm -r test` from the root.

## Frontend Testing (apps/web)

- **UI Components:** React Testing Library used for component integration tests.
- **Tools:**
  - `@testing-library/react`
  - `@testing-library/user-event`
  - `jest-dom` for custom matchers.
- **Key Coverage Areas:**
  - `LoginPage.test.tsx` - Login flow and validation.
  - `DashboardPage.test.tsx` - Data display and loading states.
  - `AudioUploadPage.test.tsx` - File selection and upload trigger.
- **Store Testing:** `authStore.test.ts` for Zustand store logic.

## Backend Testing (apps/api)

- **Status:** Currently minimal test coverage in API.
- **Framework:** Vitest ready for use (`pnpm test` in api directory).
- **Strategy:** Mocking external AI services (OpenAI, Anthropic) and DB calls is recommended for future API tests.

## Package Testing

- **Status:** CVL Engine and Shared Types are structured for independent testing.

## Patterns

- **AAA Pattern:** Arrange-Act-Assert followed in most existing tests.
- **Mocking:** `vi.mock` used for external modules and store overrides in frontend tests.

---

*Testing map: 2026-04-11*
