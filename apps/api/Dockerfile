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
# Build tools for native addons (bcrypt, etc.) + openssl for Prisma
RUN apk add --no-cache python3 make g++ openssl
COPY --from=builder /app/apps/api/package.json ./package.json
# Install prod deps with npm (flat node_modules, no pnpm workspace symlinks)
RUN npm install --omit=dev
# Overwrite @prisma/client with the generated one from builder (has query engine binary)
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/index.js"]
