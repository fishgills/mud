FROM node:slim AS pruner
WORKDIR /workspace

COPY turbo.json package.json yarn.lock ./
COPY tsconfig*.json ./
COPY eslint.config.mjs ./
COPY apps/tick/package.json ./apps/tick/package.json
COPY libs/gcp-auth/package.json ./libs/gcp-auth/package.json

RUN npx turbo prune --scope=@mud/tick --docker

FROM node:slim AS builder
WORKDIR /workspace

COPY --from=pruner /workspace/out/json/ ./
RUN yarn install --frozen-lockfile
COPY --from=pruner /workspace/out/full/ ./

RUN yarn tsc -p libs/gcp-auth/tsconfig.lib.json
RUN yarn workspace @mud/tick build

## --- Runtime stage ---
FROM node:alpine AS runtime
ENV HOST=0.0.0.0
ARG PORT=3002
ENV PORT=$PORT
WORKDIR /app

COPY --from=builder /workspace/package.json ./
COPY --from=builder /workspace/yarn.lock ./
RUN yarn install --frozen-lockfile --production --ignore-scripts

# Include the internal @mud/gcp-auth library so runtime can resolve it
COPY --from=builder /workspace/libs/gcp-auth/dist ./node_modules/@mud/gcp-auth/dist
COPY --from=builder /workspace/libs/gcp-auth/package.json ./node_modules/@mud/gcp-auth/package.json

COPY --from=builder /workspace/apps/tick/dist ./tick
COPY --from=builder /workspace/apps/tick/package.json ./tick/package.json

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('tick ok')" || exit 1

EXPOSE $PORT
# Run the compiled entrypoint
CMD [ "node", "tick/main.js" ]
