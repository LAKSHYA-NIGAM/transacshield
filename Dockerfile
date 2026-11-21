# Multi-stage Dockerfile for TransacShield Production Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native compilation (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Production runner image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN apk add --no-cache dumb-init

COPY --from=builder /app /app

EXPOSE 8080

USER node

CMD ["dumb-init", "node", "server.js"]
