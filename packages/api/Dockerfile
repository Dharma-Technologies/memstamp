FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/core/ ./packages/core/
COPY packages/api/ ./packages/api/
RUN pnpm turbo build --filter=@memstamp/api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 memstamp
COPY --from=builder --chown=memstamp:nodejs /app/packages/api/dist ./dist
COPY --from=builder --chown=memstamp:nodejs /app/packages/api/package.json ./
COPY --from=builder --chown=memstamp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=memstamp:nodejs /app/packages/core/dist ./node_modules/@memstamp/core/dist
COPY --from=builder --chown=memstamp:nodejs /app/packages/core/package.json ./node_modules/@memstamp/core/
USER memstamp
EXPOSE 8010
CMD ["node", "dist/index.js"]
