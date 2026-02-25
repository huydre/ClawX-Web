# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache git make g++ python3 cmake

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Run only necessary postinstall scripts
RUN pnpm rebuild sharp electron

# Copy source code
COPY . .

# Build server
RUN pnpm build:server

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache git make g++ python3 cmake

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Run only necessary postinstall scripts for production
RUN pnpm rebuild sharp

# Copy built server from builder
COPY --from=builder /app/dist-server ./dist-server

# Copy static files
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 2003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:2003/status', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist-server/index.js"]
