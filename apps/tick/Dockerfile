# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY yarn.lock* ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Copy built application from proper location
COPY apps/tick/dist ./
COPY apps/tick/package.json ./app-package.json

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Tick health check')" || exit 1

# Run the application
CMD ["node", "main.js"]