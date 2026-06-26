# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# Run stage
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/backend ./backend
# Ensure uploads folder exists in case of local file operations
RUN mkdir -p /app/uploads
RUN npx prisma generate

EXPOSE 5000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node backend/server.js"]
