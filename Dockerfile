# TrinityCore MCP Server - Multi-Stage Dockerfile
# Optimized for production deployment with minimal image size

# ============================================
# Stage 1: Build Stage
# ============================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# ============================================
# Stage 2: Production Stage
# ============================================
FROM node:20-alpine

# Set metadata labels
LABEL maintainer="TrinityCore MCP Team"
LABEL description="TrinityCore MCP Server - AI-powered development platform"
LABEL version="1.4.0"
LABEL org.opencontainers.image.source="https://github.com/agatho/trinitycore-mcp"

# Create non-root user for security
RUN addgroup -g 1001 -S trinityapp && \
    adduser -S trinityapp -u 1001 -G trinityapp

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=trinityapp:trinityapp /app/dist ./dist
COPY --from=builder --chown=trinityapp:trinityapp /app/node_modules ./node_modules
COPY --from=builder --chown=trinityapp:trinityapp /app/package*.json ./

# Copy data directory (API docs)
COPY --chown=trinityapp:trinityapp data ./data

# Copy documentation (optional, for reference)
COPY --chown=trinityapp:trinityapp doc ./doc
COPY --chown=trinityapp:trinityapp README.md ./
COPY --chown=trinityapp:trinityapp LICENSE ./LICENSE 2>/dev/null || true

# Create directory for logs
RUN mkdir -p /app/logs && chown trinityapp:trinityapp /app/logs

# Switch to non-root user
USER trinityapp

# Expose MCP server port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production \
    MCP_PORT=3000 \
    MCP_HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the MCP server
CMD ["node", "dist/index.js"]
