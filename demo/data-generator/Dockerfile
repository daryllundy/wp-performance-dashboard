FROM node:18-alpine

WORKDIR /app

# Install curl for health checks and mysql client for database operations
RUN apk add --no-cache curl mariadb-client

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Copy demo scripts
COPY demo/scripts/ ./scripts/

# Create data directory
RUN mkdir -p /app/data

# Set executable permissions for scripts
RUN chmod +x ./scripts/*.js

# Default command - run the data generation script
CMD ["node", "./scripts/generate-demo-data.js"]
