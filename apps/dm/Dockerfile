FROM node:alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @mud/dm --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

# First install dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN yarn install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN yarn turbo build

FROM base AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=builder /app/out/json/ .
RUN yarn install --frozen-lockfile --production

FROM base AS runner
WORKDIR /app

# Embed git metadata for observability
ARG GIT_SHA
ENV DD_GIT_COMMIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=installer /app/libs ./libs
COPY --from=installer /app/apps/dm/dist ./apps/dm/dist
COPY --from=installer /app/apps/dm/package.json ./apps/dm/package.json

# Copy entrypoint script
COPY apps/dm/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
