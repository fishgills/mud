FROM node:alpine AS base

FROM base AS builder
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN yarn global add turbo
COPY . .
RUN turbo prune web --docker

FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=builder /app/out/json/ .
RUN yarn install

COPY --from=builder /app/out/full/ .
RUN yarn turbo build

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs
USER nextjs

ARG GIT_SHA
ENV DD_GIT_COMMIT_SHA=$GIT_SHA
LABEL org.opencontainers.image.revision=$GIT_SHA

ENV NODE_ENV=production

COPY --from=installer /app .

EXPOSE 3000

CMD ["sh", "-c", "yarn --cwd apps/web start -p ${PORT:-3000}"]
