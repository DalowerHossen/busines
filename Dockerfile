# Dockerfile
# Running this platform on your own machine, your own server, or anywhere
# that can run a container.
#
# Three stages. The first installs dependencies against the lock file so a
# build is reproducible. The second builds the application. The third
# carries only what is needed to serve it: no compiler, no source, no
# development dependencies, and a user that is not root.

FROM node:20.18-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20.18-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_TARGET=standalone
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20.18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The image runs as a user with no privileges. A container that is rooted
# should not then be a root shell on the host kernel.
RUN addgroup --system --gid 1001 platform \
  && adduser --system --uid 1001 --ingroup platform platform

COPY --from=build --chown=platform:platform /app/.next/standalone ./
COPY --from=build --chown=platform:platform /app/.next/static ./.next/static
COPY --from=build --chown=platform:platform /app/public ./public

USER platform
EXPOSE 3000

# The health endpoint reaches the database rather than merely proving that
# the web server answers, so an orchestrator restarts a container that is
# actually broken rather than one that merely looks busy.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
