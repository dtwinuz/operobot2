#!/usr/bin/env bash
# Builds web, ships api sources + web dist + compose to the server and (re)starts the stack.
# Usage: deploy/deploy.sh [ssh-host] [remote-dir]. First run: create <remote-dir>/.env from .env.example.
# Caddyfile changes need: ssh <host> 'cd <remote-dir> && docker compose restart operobot2-web'
set -euo pipefail
HOST="${1:-dtwin}"
REMOTE="${2:-/opt/operobot2}"
cd "$(dirname "$0")/.."

REVISION="$(git rev-parse --short HEAD)$(git diff --quiet HEAD || echo -dirty)"
(cd web && npm ci && npm run build)
echo "$REVISION" > web/dist/REVISION

ssh "$HOST" "mkdir -p $REMOTE && test -f $REMOTE/.env || { echo \"$REMOTE/.env topilmadi: .env.example dan yarating\"; exit 1; }"
tar -cf - api/package.json api/package-lock.json api/tsconfig.json api/Dockerfile api/src api/sql \
  -C deploy docker-compose.yml Caddyfile \
  | ssh "$HOST" "cd $REMOTE && rm -rf api && tar -xf -"
tar -C web/dist -cf - . | ssh "$HOST" "cd $REMOTE && rm -rf dist.new && mkdir dist.new && tar -xf - -C dist.new && mkdir -p dist && rsync -a --delete dist.new/ dist/ && rm -rf dist.new && chmod -R a+rX dist"
ssh "$HOST" "cd $REMOTE && REVISION=$REVISION docker compose up -d --build --remove-orphans && docker compose ps"
echo "deployed $REVISION"
