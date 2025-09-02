FROM node:slim AS builder
WORKDIR /workspace

# RUN apt-get update && apt-get install -y python3 make gcc g++ pkg-config

COPY package.json tsconfig* nx.json package-lock.json ./
COPY eslint.config.mjs ./

RUN npm install

# Copy project configuration files so Nx can detect projects
COPY apps/slack-bot/package.json ./apps/slack-bot/package.json
COPY apps/slack-bot/tsconfig*.json ./apps/slack-bot/
COPY apps/slack-bot/eslint.config.mjs ./apps/slack-bot/

# Copy libs and source code
COPY libs ./libs/
COPY apps/slack-bot/src ./apps/slack-bot/src/
COPY apps/slack-bot/codegen.ts ./apps/slack-bot/

RUN NX_DAEMON=false npx nx sync
# Build gcp-auth first and create a symlink to the dist in node_modules
RUN NX_DAEMON=false npx nx build gcp-auth
RUN mkdir -p node_modules/@mud/gcp-auth
RUN cp libs/gcp-auth/package.json node_modules/@mud/gcp-auth/
RUN ln -sf ../../../libs/gcp-auth/dist node_modules/@mud/gcp-auth/dist
RUN NX_DAEMON=false npx nx run slack-bot:build:production

## --- Runtime stage ---
FROM node:alpine AS runtime
ENV HOST=0.0.0.0
ARG PORT=3002
ENV PORT=$PORT
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# Include the internal @mud/gcp-auth library so runtime can resolve it
COPY --from=builder /workspace/libs/gcp-auth/dist ./node_modules/@mud/gcp-auth/dist
COPY --from=builder /workspace/libs/gcp-auth/package.json ./node_modules/@mud/gcp-auth/package.json

COPY --from=builder /workspace/apps/slack-bot/dist ./slack-bot
COPY apps/slack-bot/package.json ./slack-bot/package.json

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('slack-bot ok')" || exit 1

EXPOSE $PORT
# Run the compiled entrypoint
CMD [ "node", "slack-bot/main.js" ]
