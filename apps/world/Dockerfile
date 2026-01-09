FROM node:alpine AS base

ENV npm_config_python=python3

FROM base AS builder
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @mud/world --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk add --no-cache \
  libc6-compat \
  python3 \
  build-base \
  pkgconfig \
  cairo-dev \
  pango-dev \
  jpeg-dev \
  giflib-dev \
  librsvg-dev
WORKDIR /app

# First install dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN yarn install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN yarn turbo build

FROM base AS prod-deps
RUN apk add --no-cache \
  libc6-compat \
  python3 \
  build-base \
  pkgconfig \
  cairo-dev \
  pango-dev \
  jpeg-dev \
  giflib-dev \
  librsvg-dev
WORKDIR /app

COPY --from=builder /app/out/json/ .
RUN yarn install --frozen-lockfile --production

FROM base AS runner
WORKDIR /app

RUN apk update \
  && apk add --no-cache \
  libc6-compat \
  cairo \
  pango \
  jpeg \
  curl \
  giflib \
  librsvg

# Embed git metadata for observability
ARG GIT_SHA
ENV DD_GIT_COMMIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=installer /app/libs ./libs
COPY --from=installer /app/apps/world/dist ./apps/world/dist
COPY --from=installer /app/apps/world/package.json ./apps/world/package.json

CMD node apps/world/dist/src/main.js
