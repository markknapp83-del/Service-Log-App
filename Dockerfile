# Healthcare Service Log Portal - Production Dockerfile
# Multi-stage build for optimized production deployment

# Stage 1: Build backend
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend

# Install system dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy backend source code
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Build backend
RUN npm run build

# Stage 2: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy frontend source code
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html ./
COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./

# Set production environment for optimized build
ENV NODE_ENV=production

# Build frontend
RUN npm run build

# Stage 3: Production runtime
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S healthcare -u 1001

# Install production dependencies
RUN apk add --no-cache sqlite dumb-init

# Set working directory
WORKDIR /app

# Copy backend build and dependencies
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package*.json ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./public

# Create necessary directories with proper permissions
RUN mkdir -p /app/database /app/logs /app/uploads && \
    chown -R healthcare:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER healthcare

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health/basic').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Expose port
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/app/database/healthcare.db \
    LOG_LEVEL=info \
    ENABLE_METRICS=true

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/app.js"]