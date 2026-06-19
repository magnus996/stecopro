# syntax=docker/dockerfile:1

# Node 22 LTS (Debian slim) — better-sqlite3 ^12 ships prebuilt binaries for
# this platform; build tools are installed below as a fallback for compilation.
ARG NODE_IMAGE=node:22-bookworm-slim

# ---- deps: install all dependencies (incl. dev) ----------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- tools: deps + source (used to run drizzle-kit push & the seed scripts) -
FROM ${NODE_IMAGE} AS tools
WORKDIR /app
# Same uid as the runner so the shared db volume ends up owned by 1001 no matter
# which container mounts it first. The seed service runs as this user (see compose).
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --create-home --home-dir /home/nextjs nextjs \
    && mkdir -p /data && chown -R nextjs:nodejs /data
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ---- builder: produce the standalone production build ----------------------
FROM tools AS builder
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the client bundle at build time. The app
# uses NEXT_PUBLIC_APP_URL for absolute redirects (e.g. logout), so it must be
# the public tunnel hostname — not localhost — or remote users get bounced to
# localhost on logout.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
RUN npm run build

# ---- runner: minimal production image --------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server (incl. traced node_modules + instrumentation), static assets, public/
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Writable dirs. Named volumes inherit this ownership on first mount, so the
# non-root runtime user can write the SQLite db and uploaded photos.
RUN mkdir -p /app/uploads /data && chown -R nextjs:nodejs /app/uploads /data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
