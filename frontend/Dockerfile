# =============================================================================
# Web (React + Vite) — build từ monorepo root, phục vụ bằng Nginx
#   docker build -f frontend/Dockerfile -t ats-web .
# Nginx proxy /api → core-api:3000 nên không cần cấu hình CORS riêng.
# =============================================================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY ai/package.json ai/

RUN npm ci

COPY shared shared
COPY frontend frontend

RUN npm run build -w @ats/shared && npm run build -w @ats/frontend

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
