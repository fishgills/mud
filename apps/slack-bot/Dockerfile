FROM node:slim AS builder
WORKDIR /workspace

# RUN apt-get update && apt-get install -y python3 make gcc g++ pkg-config

COPY package.json tsconfig* nx.json package-lock.json ./

RUN npm install
COPY apps/slack-bot ./apps/slack-bot/
COPY libs ./libs/
RUN npx nx sync
RUN ls -al .nx
RUN npx nx build slack-bot

## --- Runtime stage ---
FROM node:alpine AS runtime
ENV HOST=0.0.0.0
ARG PORT=3002
ENV PORT=$PORT
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

COPY --from=builder /workspace/apps/slack-bot/dist ./slack-bot
COPY apps/slack-bot/package.json ./slack-bot/package.json

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('slack-bot ok')" || exit 1

EXPOSE $PORT
# Run the compiled entrypoint
CMD [ "node", "slack-bot/main.js" ]
