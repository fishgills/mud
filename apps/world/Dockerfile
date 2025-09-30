
## --- Turbo prune stage ---
FROM node:slim AS pruner
WORKDIR /workspace

COPY turbo.json package.json yarn.lock ./
COPY tsconfig*.json ./
COPY eslint.config.mjs ./
COPY apps/world/package.json ./apps/world/package.json
COPY libs/database/package.json ./libs/database/package.json
COPY libs/gcp-auth/package.json ./libs/gcp-auth/package.json
COPY libs/constants/package.json ./libs/constants/package.json

RUN npx turbo prune --scope=@mud/world --docker

## --- Builder stage ---
FROM node:slim AS builder
WORKDIR /workspace

# Install build tools and headers for node-canvas
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  build-essential python3 pkg-config \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*

COPY --from=pruner /workspace/out/json/ ./

# Install dependencies and build (allow scripts for native modules like canvas)
RUN yarn install --frozen-lockfile

# Copy libs and the actual source code
COPY --from=pruner /workspace/out/full/ ./
# Prisma schema is required for the database package's build step when running in CI
COPY libs/database/prisma ./libs/database/prisma
## Build internal libraries (database build runs prisma generate via its prebuild hook)
RUN yarn workspace @mud/database build
RUN yarn workspace @mud/gcp-auth build
RUN yarn workspace @mud/constants build
RUN yarn workspace @mud/world build

## --- Runtime stage ---
FROM node:slim AS runtime
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

# Include the internal @mud/gcp-auth library so runtime can resolve it
COPY --from=builder /workspace/libs/gcp-auth/dist /app/node_modules/@mud/gcp-auth/dist
COPY --from=builder /workspace/libs/gcp-auth/package.json /app/node_modules/@mud/gcp-auth/package.json

# Include the internal @mud/constants library so runtime can resolve it
COPY --from=builder /workspace/libs/constants/dist /app/node_modules/@mud/constants/dist
COPY --from=builder /workspace/libs/constants/package.json /app/node_modules/@mud/constants/package.json

# Copy built app from builder
COPY --from=builder /workspace/apps/world/dist ./
COPY --from=builder /workspace/apps/world/package.json ./app-package.json

ARG PORT=3001
ENV PORT=$PORT
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/health || exit 1

CMD ["node", "main.js"]
