# =============================================================================
# Core API (NestJS) — build từ monorepo root
#   docker build -f backend/Dockerfile -t ats-core-api .
# Chạy migration + seed (tuỳ chọn) rồi khởi động API.
# =============================================================================
FROM node:22-alpine

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Chỉ copy manifest trước để tận dụng cache layer khi source thay đổi
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY ai/package.json ai/

RUN npm ci

COPY shared shared
COPY backend backend

RUN npm run build -w @ats/shared \
  && npx prisma generate --schema backend/prisma/schema.prisma \
  && npm run build -w @ats/backend

WORKDIR /app/backend

# Prisma CLI + tsx (seed) nằm trong devDependencies → giữ toàn bộ node_modules.
ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["sh", "/app/backend/docker-entrypoint.sh"]
