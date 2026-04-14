#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT_DIR/backups/host_docker_readiness_$STAMP"

mkdir -p "$OUT_DIR"

{
  echo "=== docker pull node:20-alpine ==="
  docker pull node:20-alpine
} >"$OUT_DIR/docker_pull_node20.log" 2>&1 || true

{
  echo "=== docker pull postgres:16-alpine ==="
  docker pull postgres:16-alpine
} >"$OUT_DIR/docker_pull_postgres16.log" 2>&1 || true

{
  echo "=== docker access as vinissimo-deploy ==="
  id vinissimo-deploy
  su -s /bin/bash -c "docker ps" vinissimo-deploy
} >"$OUT_DIR/docker_access_vinissimo_deploy.log" 2>&1 || true

echo "Evidências salvas em: $OUT_DIR"
