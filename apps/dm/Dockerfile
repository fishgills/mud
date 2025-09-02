
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
COPY apps/dm/eslint.config.mjs ./apps/dm/eslint.config.mjs
COPY apps/dm/tsconfig.* ./apps/dm/
COPY apps/dm ./apps/dm
COPY libs ./libs

# Install dependencies and build
RUN npm ci --ignore-scripts
## Generate Prisma Client for the workspace schema used by libs/database
RUN npx prisma generate --schema=libs/database/prisma/schema.prisma
RUN npx nx build dm

# --- Runtime stage ---
FROM node:alpine AS runtime
WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts
## Copy the generated Prisma client and engines from the builder stage
COPY --from=builder /workspace/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /workspace/node_modules/.prisma /app/node_modules/.prisma

# Include the internal @mud/database library so runtime can resolve it
COPY --from=builder /workspace/libs/database/dist /app/node_modules/@mud/database/dist
COPY --from=builder /workspace/libs/database/package.json /app/node_modules/@mud/database/package.json

# Include the internal @mud/gcp-auth library so runtime can resolve it
COPY --from=builder /workspace/libs/gcp-auth/dist /app/node_modules/@mud/gcp-auth/dist
COPY --from=builder /workspace/libs/gcp-auth/package.json /app/node_modules/@mud/gcp-auth/package.json

# Copy built app from builder
COPY --from=builder /workspace/apps/dm/dist ./
COPY apps/dm/package.json ./app-package.json

ARG PORT=3000
ENV PORT=$PORT
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/health || exit 1

CMD ["node", "main.js"]