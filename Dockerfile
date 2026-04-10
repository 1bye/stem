# Build stage
FROM oven/bun:1.3-alpine AS builder

WORKDIR /app

# Copy workspace configuration first
COPY package.json bun.lock turbo.json ./

# Copy all workspace packages that are dependencies
COPY packages/config/package.json ./packages/config/
COPY packages/config/tsconfig.base.json ./packages/config/
COPY packages/env/package.json ./packages/env/
COPY packages/env/src ./packages/env/src/
COPY packages/env/tsconfig.json ./packages/env/
COPY packages/db/package.json ./packages/db/
COPY packages/db/src ./packages/db/src/
COPY packages/db/drizzle.config.ts ./packages/db/
COPY packages/db/tsconfig.json ./packages/db/
COPY apps/server/package.json ./apps/server/
COPY apps/server/tsconfig.json ./apps/server/
COPY apps/server/tsdown.config.ts ./apps/server/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY apps/server/src ./apps/server/src

# Build the application
WORKDIR /app/apps/server
RUN bun run build

# Production stage
FROM oven/bun:1.3-alpine AS runner

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/packages ./packages

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "run", "dist/index.mjs"]
