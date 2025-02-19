# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files for workspace setup
COPY package*.json ./
COPY src/admin-service/package*.json ./src/admin-service/
COPY src/auth-service/package*.json ./src/auth-service/
COPY src/metrics-service/package*.json ./src/metrics-service/
COPY src/report-service/package*.json ./src/report-service/
COPY src/api-gateway/package*.json ./src/api-gateway/

# Install dependencies
RUN npm ci

# Copy source code and config files
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma clients
RUN npm run prisma:generate

# Build all services in parallel
RUN npm run build:services

# Run tests and linting
RUN npm run lint && npm run test

# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Copy built artifacts from builder
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Set up health checks for each service
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Set resource constraints
ENV NODE_OPTIONS="--max-old-space-size=512"

# Switch to non-root user
USER nodejs

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start services with proper orchestration
CMD ["node", "dist/app.js"]

# Expose service ports
EXPOSE 3000 3001 3002 3003 3004

# Labels for container metadata
LABEL org.opencontainers.image.source="https://github.com/startup-metrics/backend" \
      org.opencontainers.image.description="Startup Metrics Backend Services" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="MIT" \
      maintainer="Startup Metrics Team"