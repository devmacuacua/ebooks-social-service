# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source & build
COPY tsconfig*.json nest-cli.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client, then compile TypeScript
RUN npx prisma generate && npm run build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Prisma client needs the generated files and schema
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/dist ./dist

USER appuser

EXPOSE 3004

# Run migrations then start the service
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
