
## --- Builder stage ---
FROM node:20-slim AS builder
WORKDIR /workspace

# Install build tools and headers for node-canvas
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  build-essential python3 pkg-config \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY tsconfig*.json ./
COPY tsconfig.base.json ./
COPY apps/dm/tsconfig*.json ./apps/dm/
COPY apps/slack-bot/tsconfig*.json ./apps/slack-bot/
COPY apps/tick/tsconfig*.json ./apps/tick/
COPY apps/world/tsconfig*.json ./apps/world/
COPY libs/database/tsconfig*.json ./libs/database/
COPY nx.json ./
COPY eslint.config.mjs ./
COPY apps/world/eslint.config.mjs ./apps/world/eslint.config.mjs
COPY apps/world/tsconfig.* ./apps/world/
COPY apps/world ./apps/world
COPY libs ./libs

# Install dependencies and build (allow scripts for native modules like canvas)
RUN npm ci
## Generate Prisma Client for the workspace schema used by libs/database
RUN npx prisma generate --schema=libs/database/prisma/schema.prisma
RUN npx nx build world

## --- Runtime stage ---
FROM node:20-slim AS runtime
WORKDIR /app

## Install runtime libs required by node-canvas and wget for healthcheck
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Bring in node_modules (built in builder with native bindings)
COPY --from=builder /workspace/node_modules /app/node_modules

# Include the internal @mud/database library so runtime can resolve it
COPY --from=builder /workspace/libs/database/dist /app/node_modules/@mud/database/dist
COPY --from=builder /workspace/libs/database/package.json /app/node_modules/@mud/database/package.json

# Copy built app from builder
COPY --from=builder /workspace/apps/world/dist ./
COPY apps/world/package.json ./app-package.json

ARG PORT=3001
ENV PORT=$PORT
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/health || exit 1

CMD ["node", "main.js"]