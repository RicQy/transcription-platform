FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm install -g pnpm
RUN pnpm install

CMD ["pnpm", "start"]
