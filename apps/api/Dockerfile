FROM node:20-slim AS base
RUN npm i -g pnpm@10

# ── Build Stage ──────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json ./

# Copy package manifests for dependency resolution
COPY packages/cvl-engine/package.json packages/cvl-engine/
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/cvl-engine/ packages/cvl-engine/
COPY packages/shared-types/ packages/shared-types/
COPY apps/api/ apps/api/

# Build CVL engine first (workspace dependency)
RUN pnpm --filter @transcribe/cvl-engine build

# Build the API
RUN pnpm --filter @transcribe/api build

# ── Production Stage ─────────────────────────────────────────────────────────
FROM base AS production
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/cvl-engine/package.json packages/cvl-engine/
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=build /app/packages/cvl-engine/dist packages/cvl-engine/dist
COPY --from=build /app/apps/api/dist apps/api/dist

# Schema for DB init
COPY apps/api/src/schema.sql apps/api/src/schema.sql

# Create uploads dir
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "apps/api/dist/index.js"]
