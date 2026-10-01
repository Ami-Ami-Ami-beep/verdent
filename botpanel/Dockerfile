# Baut das komplette Monorepo einmal und liefert zwei Ziele: api (inkl. Website) und bot-runner.
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/bot-runner/package.json apps/bot-runner/
COPY apps/desktop/package.json apps/desktop/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter "!@botpanel/desktop" -r build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node

FROM runtime AS api
WORKDIR /app/apps/api
EXPOSE 3000
# Datenbank-Migrationen beim Start anwenden, dann API starten.
CMD ["sh", "-c", "cd /app/packages/db && ./node_modules/.bin/prisma migrate deploy && cd /app/apps/api && node dist/index.js"]

FROM runtime AS bot-runner
WORKDIR /app/apps/bot-runner
CMD ["node", "dist/index.js"]
