
# Use a slim Node base image
FROM node:20-alpine

# Create app# Create app directory
WORKDIR /usr/src/app

# Install dependencies first (for caching)
COPY package.json ./
RUN npm install --only=production

# Copy source
COPY server.js ./
COPY public ./public
COPY .env ./

# Expose port
EXPOSE 8080

# Environment (optional: you can also pass these at runtime)
ENV NODE_ENV=production

# Start the server
