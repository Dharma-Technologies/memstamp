FROM node:20-alpine AS base
RUN corepack enable

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/worker/package.json ./packages/worker/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/worker/node_modules ./packages/worker/node_modules
COPY . .
RUN pnpm turbo build --filter=@memstamp/worker

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 memstamp
COPY --from=builder --chown=memstamp:nodejs /app/packages/worker/dist ./dist
COPY --from=builder --chown=memstamp:nodejs /app/packages/worker/package.json ./
COPY --from=builder --chown=memstamp:nodejs /app/node_modules ./node_modules
USER memstamp
CMD ["node", "dist/index.js"]
