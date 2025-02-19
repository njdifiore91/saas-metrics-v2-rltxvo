# Stage 1: Builder
FROM node:18-alpine AS builder

# Install build dependencies and security tools
RUN apk add --no-cache python3 make g++ git curl \
    && apk add --no-cache --virtual .build-deps \
    && npm install -g npm@latest

# Set working directory
WORKDIR /usr/src/app

# Copy package files with npm cache mount
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies with npm ci for consistent builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code and configuration files
COPY . .

# Run security scan on dependencies
RUN npm audit

# Build TypeScript code with optimizations
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:18-alpine

# Install Tini for proper signal handling
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini-static /tini
RUN chmod +x /tini

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production \
    && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Set security-related configurations
RUN apk add --no-cache dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Configure resource limits
RUN ulimit -n 65536

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Create and use non-root user
USER nodejs

# Set security configurations
RUN mkdir -p /usr/src/app/logs \
    && chown -R nodejs:nodejs /usr/src/app

# Make application directory read-only
RUN chmod -R 555 /usr/src/app

# Configure container labels
LABEL com.startup.service="api-gateway" \
      com.startup.version="${VERSION:-latest}" \
      com.startup.maintainer="DevOps Team" \
      com.startup.health.interval="30s" \
      com.startup.health.timeout="10s" \
      com.startup.health.retries="3"

# Expose API port
EXPOSE ${PORT}

# Use Tini as entrypoint for proper signal handling
ENTRYPOINT ["/tini", "--"]

# Start the application
CMD ["node", "dist/app.js"]