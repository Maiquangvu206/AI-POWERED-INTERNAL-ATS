#!/bin/sh
# Entrypoint Core API: chờ DB (compose healthcheck đã lo) → migrate → seed → chạy.
set -e

echo "▶ prisma migrate deploy"
npx prisma migrate deploy --schema prisma/schema.prisma

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "▶ prisma db seed (idempotent)"
  npx prisma db seed || echo "⚠ seed thất bại — bỏ qua, API vẫn khởi động"
fi

echo "▶ node dist/main.js (PORT=${PORT:-3000})"
exec node dist/main.js
