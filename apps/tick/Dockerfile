## --- Builder stage ---
FROM node:alpine AS builder
ENV NX_SKIP_ESLINT_PLUGIN=1
WORKDIR /workspace

COPY package*.json ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY eslint.config.mjs ./
COPY apps/tick/eslint.config.mjs ./apps/tick/eslint.config.mjs
COPY apps/tick/tsconfig.* ./apps/tick/
COPY apps/tick ./apps/tick
COPY libs ./libs

RUN npm ci --ignore-scripts && npm i -D typescript-eslint@^8.34.1
RUN npx nx build tick

## --- Runtime stage ---
FROM node:alpine AS runtime
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

COPY --from=builder /workspace/apps/tick/dist ./
COPY apps/tick/package.json ./app-package.json

ARG PORT=3003
ENV PORT=$PORT
EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Tick health check')" || exit 1

CMD ["node", "main.js"]