# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack with the exact pnpm version pinned in package.json
# (avoids the "downloading pnpm@latest" slowdown and version drift)
RUN corepack enable

# Copy root manifest files needed for workspace install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Copy only the package.json files first (for better layer caching)
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install ALL workspace deps.
# --no-frozen-lockfile is NOT used; lockfile is present so frozen-lockfile works.
# unsafe-perm allows postinstall scripts (needed for esbuild native binaries).
RUN pnpm install --frozen-lockfile

# Copy source after install so code changes don't bust the install cache
COPY apps/web ./apps/web
COPY packages/shared-types ./packages/shared-types
COPY tsconfig.base.json ./

# Build shared-types first (web depends on it)
# Use `pnpm --filter` with `build` script — typescript is hoisted to root
# node_modules so `tsc` resolves correctly via the workspace root.
RUN pnpm --filter @transcribe/shared-types build

# Build the Vite app
RUN pnpm --filter @transcribe/web build

# ─── Stage 2: Serve ──────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Nginx config: serve SPA, proxy /api calls to the api service
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
