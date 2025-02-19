# Build stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /usr/src/app

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./

# Install dependencies including dev dependencies for build
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Generate Prisma client
RUN npm run prisma:generate

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /usr/src/app

# Set NODE_ENV
ENV NODE_ENV production

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built assets from build stage
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set ownership to non-root user
RUN chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/app.js"]