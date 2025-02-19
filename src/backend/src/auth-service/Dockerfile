# Stage 1: Builder
FROM node:18-alpine AS builder

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /usr/src/app

# Copy package files for dependency installation
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup tsconfig*.json ./

# Install build dependencies and development tools
RUN apk add --no-cache python3 make g++ \
    && npm ci \
    && npm install -g prisma

# Copy source code with appropriate permissions
COPY --chown=appuser:appgroup . .

# Generate Prisma client
RUN prisma generate

# Build TypeScript code
RUN npm run build

# Run security audit
RUN npm audit --audit-level=moderate

# Remove devDependencies and build tools
RUN npm prune --production \
    && apk del python3 make g++

# Stage 2: Production
FROM node:18-alpine

# Create and use non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY --chown=appuser:appgroup package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder stage
COPY --chown=appuser:appgroup --from=builder /usr/src/app/dist ./dist
COPY --chown=appuser:appgroup --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=appuser:appgroup --from=builder /usr/src/app/prisma ./prisma

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Security configurations
ENV NODE_OPTIONS="--max-old-space-size=512 --max-http-header-size=8192 --no-experimental-fetch"
ENV NODE_TLS_REJECT_UNAUTHORIZED=1

# Configure security headers and policies
RUN echo "net.ipv4.tcp_syncookies=1" >> /etc/sysctl.conf \
    && echo "net.ipv4.tcp_max_syn_backlog=2048" >> /etc/sysctl.conf \
    && echo "net.ipv4.tcp_synack_retries=2" >> /etc/sysctl.conf

# Set resource limits
ENV NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=512"

# Expose service port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set up logging
ENV NPM_CONFIG_LOGLEVEL=warn
ENV LOG_LEVEL=info

# Start application with proper signal handling
CMD ["node", "--enable-source-maps", "dist/app.js"]