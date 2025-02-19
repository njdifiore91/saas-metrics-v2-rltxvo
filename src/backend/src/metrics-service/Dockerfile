# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for caching optimization
COPY package.json yarn.lock ./

# Set yarn cache folder and install dependencies
ENV YARN_CACHE_FOLDER=/root/.yarn-cache
RUN yarn install --frozen-lockfile

# Copy source code and configuration
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN yarn prisma:generate

# Build TypeScript code
RUN yarn build

# Prune development dependencies
RUN yarn install --production --ignore-scripts --prefer-offline

# Stage 2: Production
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Add labels
LABEL maintainer="DevOps Team" \
      version="1.0.0" \
      service="metrics-service" \
      environment="production"

# Install production dependencies
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1000 node && \
    adduser -u 1000 -G node -s /bin/sh -D node

# Copy package files
COPY package.json ./

# Copy production dependencies and compiled code from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Set security configurations
RUN chmod -R 755 /app && \
    chown -R node:node /app

# Configure security options
RUN echo "node soft nofile 65536" >> /etc/security/limits.conf && \
    echo "node hard nofile 65536" >> /etc/security/limits.conf

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Switch to non-root user
USER node

# Health check configuration
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Expose API port
EXPOSE 3000

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "dist/app.js"]