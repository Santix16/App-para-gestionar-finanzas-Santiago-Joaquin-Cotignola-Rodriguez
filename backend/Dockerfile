# API de Finanzas personales (Node 22 + Express + Prisma)
FROM node:22-bookworm-slim

# Prisma necesita OpenSSL
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Aplica las migraciones pendientes y arranca la API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
