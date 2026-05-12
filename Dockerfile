FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY scripts/package.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY scripts/ ./
COPY scanners-config.json ./

# Set environment variables
ENV NODE_ENV=production \
    CHARTINK_TIMEOUT=15000 \
    PARALLEL_REQUESTS=3 \
    MAX_RETRIES=2

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the scanner
CMD ["node", "telegram-sender.js"]
