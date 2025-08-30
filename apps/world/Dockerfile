
# --- Builder stage ---
FROM node:alpine AS builder
WORKDIR /workspace

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

# Install dependencies and build
RUN npm ci --ignore-scripts
## Generate Prisma Client for the workspace schema used by libs/database
RUN npx prisma generate --schema=libs/database/prisma/schema.prisma
RUN npx nx build world

# --- Runtime stage ---
FROM node:alpine AS runtime
WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts
## Copy the generated Prisma client and engines from the builder stage
## This avoids needing prisma CLI in the runtime image
COPY --from=builder /workspace/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /workspace/node_modules/.prisma /app/node_modules/.prisma

# Copy built app from builder
COPY --from=builder /workspace/apps/world/dist ./
COPY apps/world/package.json ./app-package.json

ARG PORT=3001
ENV PORT=$PORT
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/health || exit 1

CMD ["node", "main.js"]