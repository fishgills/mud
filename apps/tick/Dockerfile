FROM node:alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @mud/tick --docker

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

# Don't run production as root
RUN addgroup --system --gid 1001 expressjs
RUN adduser --system --uid 1001 expressjs
USER expressjs

# Embed git metadata for observability
ARG GIT_SHA
ENV DD_GIT_COMMIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=installer /app/libs ./libs
COPY --from=installer /app/apps/tick/dist ./apps/tick/dist
COPY --from=installer /app/apps/tick/package.json ./apps/tick/package.json

CMD node apps/tick/dist/main.js
