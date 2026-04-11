FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm install -g pnpm
RUN pnpm install
RUN pnpm --filter @transcribe/shared-types build
RUN pnpm --filter @transcribe/api build

ENV PORT=8080

CMD ["node", "apps/api/dist/index.js"]
