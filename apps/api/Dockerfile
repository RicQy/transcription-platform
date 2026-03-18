FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types
RUN cd packages/shared-types && /app/node_modules/.bin/tsc
RUN cd apps/api && node_modules/.bin/prisma generate --schema=prisma/schema.prisma
RUN cd apps/api && /app/node_modules/.bin/tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
