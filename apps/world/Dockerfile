FROM node:alpine AS base

ENV npm_config_python=python3

FROM base AS builder
RUN apk update
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @mud/world --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk update
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

FROM base AS runner
WORKDIR /app

RUN apk update \
  && apk add --no-cache \
  libc6-compat \
  cairo \
  pango \
  jpeg \
  giflib \
  librsvg

COPY --from=installer /app .

CMD node apps/world/dist/src/main.js