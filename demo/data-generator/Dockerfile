FROM node:18-alpine

# Install curl for health checks and mysql client for database operations
RUN apk add --no-cache curl mysql-client

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy demo scripts
COPY demo/scripts/ ./scripts/

# Create data directory
RUN mkdir -p /app/data

# Set permissions
RUN chmod +x ./scripts/*.js

# Default command (will be overridden by docker-compose)
CMD ["node", "scripts/generate-demo-data.js"]
