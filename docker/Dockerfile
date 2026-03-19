FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile --filter @agent-work-chain/indexer...

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY sdk ./sdk
COPY docs ./docs

WORKDIR /app/backend
EXPOSE 3000

CMD ["pnpm", "start"]
