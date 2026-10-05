# docker/Dockerfile
# Production image for KD SOLUTION IT. Multi-stage build that produces a
# minimal, non-root runtime image using the Next.js "standalone" output.
# Works on any Docker host or VPS; no dependency on Netlify or Vercel.
#
# Build (from repository root):
#   docker build -f docker/Dockerfile -t kd-solution-it:latest .
#
# Run:
#   docker run -p 3000:3000 --env-file .env kd-solution-it:latest

# ---------------------------------------------------------------------------
# Stage 1: install dependencies
# ---------------------------------------------------------------------------
FROM node:26.10.0-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 2: build the application
# ---------------------------------------------------------------------------
FROM node:26.10.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=true

# Build-time placeholders only; real secrets are supplied at container
# runtime via --env-file or the orchestrator's secret manager.
ARG NEXT_PUBLIC_APP_URL=https://localhost:3000
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: minimal runtime image
# ---------------------------------------------------------------------------
FROM node:26.10.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY docker/scripts/healthcheck.sh /app/healthcheck.sh
COPY docker/scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/healthcheck.sh /app/entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD /app/healthcheck.sh

ENTRYPOINT ["/app/entrypoint.sh"]
