
FROM node:22-alpine AS builder

WORKDIR /app

# Dummy build-time DB URL for Prisma generate only.
# Real DATABASE_URL must be injected at runtime via env/secrets.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build


FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

EXPOSE 4001

# Run as non-root user for production container security.
USER node

CMD ["node", "dist/server.js"]
