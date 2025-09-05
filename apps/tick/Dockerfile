FROM node:slim AS builder
WORKDIR /workspace

# RUN apt-get update && apt-get install -y python3 make gcc g++ pkg-config

COPY package.json tsconfig* nx.json package-lock.json ./
COPY eslint.config.mjs ./

RUN npm install

# Copy project configuration files so Nx can detect projects
COPY apps/tick/package.json ./apps/tick/package.json
COPY apps/tick/tsconfig*.json ./apps/tick/
COPY apps/tick/eslint.config.mjs ./apps/tick/

# Copy libs and source code
COPY libs ./libs/
COPY apps/tick/src ./apps/tick/src/

RUN NX_DAEMON=false npx nx sync
# Build gcp-auth first and create a symlink to the dist in node_modules
RUN NX_DAEMON=false npx nx build gcp-auth
RUN mkdir -p node_modules/@mud/gcp-auth
RUN cp libs/gcp-auth/package.json node_modules/@mud/gcp-auth/
RUN ln -sf ../../../libs/gcp-auth/dist node_modules/@mud/gcp-auth/dist
RUN NX_DAEMON=false npx nx run tick:build:production

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

COPY --from=builder /workspace/apps/tick/dist ./tick
COPY apps/tick/package.json ./tick/package.json

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('tick ok')" || exit 1

EXPOSE $PORT
# Run the compiled entrypoint
CMD [ "node", "tick/main.js" ]
