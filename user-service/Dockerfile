FROM node:24
WORKDIR /app

# 0. Build-time DB URL (from docker-compose build args)
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# 1. Install dependencies first (cached)
COPY package*.json ./
RUN npm ci

# 3. Copy the rest of source code (includes tsconfig, env.app, env.db, src/, etc.)
COPY . .

# 2. Copy Prisma schema and generate client for Debian
# COPY prisma ./prisma
RUN npx prisma generate

# 4. Build TypeScript → JS
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4001
CMD ["node", "dist/server.js"]
