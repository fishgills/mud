FROM node:alpine AS base

FROM base AS builder
RUN apk update
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @mud/slack --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

# First install dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN yarn install

COPY --from=builder /app/out/full/ .
RUN yarn turbo build

FROM base AS runner
WORKDIR /app

# Install tsx for running TypeScript scripts
RUN yarn global add tsx

# Don't run production as root
RUN addgroup --system --gid 1001 expressjs
RUN adduser --system --uid 1001 expressjs

COPY --from=installer /app .

# Embed git metadata for observability
ARG GIT_SHA
ENV DD_GIT_COMMIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA

# Copy entrypoint script and make it executable
COPY apps/slack/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER expressjs

ENTRYPOINT ["/app/docker-entrypoint.sh"]
