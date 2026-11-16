# ==============================================================================
# LegalIQ Multi-Stage Production Dockerfile for AWS (App Runner / ECS / EC2)
# ==============================================================================

# ── Stage 1: Build Dependencies & Compile Assets ──────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Enable pnpm via Corepack (pinning pnpm 9 for lockfile and build script compatibility)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy root workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./

# Copy all workspaces & libraries
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server
COPY artifacts/legaliq-web ./artifacts/legaliq-web
COPY scripts ./scripts

# Install all dependencies (including devDependencies needed for build)
RUN pnpm install --no-frozen-lockfile

# Build frontend and backend
# VITE_CLERK_PUBLISHABLE_KEY defaults to your project key, overridable via --build-arg
ARG VITE_CLERK_PUBLISHABLE_KEY="pk_test_aWRlYWwtbWFybW9zZXQtODg4OS5jbGVyay5hY2NvdW50cy5kZXYk"
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
ENV BASE_PATH="/"
ENV NODE_ENV="production"

# Compile TypeScript libraries
RUN pnpm run typecheck:libs

# Build Vite frontend assets
RUN pnpm --filter @workspace/legaliq-web run build

# Bundle Express backend using esbuild
RUN pnpm --filter @workspace/api-server run build

# ── Stage 2: Minimal Production Runtime ───────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

# Copy compiled libraries & packages
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/legaliq-web/dist ./artifacts/legaliq-web/dist

# Install production dependencies only
RUN pnpm install --prod --no-frozen-lockfile

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

# Built-in health check using /api/healthz
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/healthz || exit 1

CMD ["node", "./artifacts/api-server/dist/index.mjs"]
