#!/bin/sh
set -eu

mkdir -p /pb/pb_data

if [ -n "${PB_SUPERUSER_EMAIL:-}" ] && [ -n "${PB_SUPERUSER_PASSWORD:-}" ]; then
  /usr/local/bin/pocketbase superuser upsert \
    "$PB_SUPERUSER_EMAIL" \
    "$PB_SUPERUSER_PASSWORD" \
    --dir=/pb/pb_data
fi

exec /usr/local/bin/pocketbase serve \
  --http=0.0.0.0:8090 \
  --dir=/pb/pb_data \
  --migrationsDir=/pb/pb_migrations
