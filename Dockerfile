
# linux/amd64, alpine includes /bin/ash
FROM --platform=linux/amd64 node:20-alpine

# Create numeric non-root user/group (UID=1001, GID=2001)
RUN addgroup -g 2001 app \
 && adduser -D -u 1001 -G app app

# App directory
WORKDIR /usr/src/app

# Copy only package manifest first (for better caching)
COPY package.json ./

# Install production deps (no lockfile required)
# If you created package-lock.json locally, you can switch to:
# COPY package.json package-lock.json ./
# RUN npm ci --omit=dev
RUN npm install --omit=dev

# Copy source
COPY server.js ./
COPY public ./public

# Hardcode environment (BE CAREFUL: secrets baked into image)
ENV NODE_ENV=production 

# Expose port
EXPOSE 8080

# Run as non-root numeric user
USER 1001

# Start the server
