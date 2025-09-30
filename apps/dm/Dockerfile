FROM node:alpine AS base

FROM base AS builder
RUN apk update
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune @mud/dm --docker

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

COPY --from=installer /app .

CMD node apps/dm/dist/src/main.js