#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="${1:-$(date +%Y%m%d_%H%M%S)}"
OUT_DIR="${ROOT_DIR}/backups/releases"
OUT_FILE="${OUT_DIR}/vinissimo_soi_runtime_${TIMESTAMP}.tar.gz"

for cmd in node npm tar; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Comando obrigatório não encontrado: $cmd"
    exit 1
  }
done

mkdir -p "$OUT_DIR"

echo "[1/4] Instalando dependências do backend..."
(
  cd "${ROOT_DIR}/apps/api"
  npm install --no-fund --no-audit
)

echo "[2/4] Buildando backend..."
(
  cd "${ROOT_DIR}/apps/api"
  npm run build
)

echo "[3/4] Instalando dependências do frontend..."
(
  cd "${ROOT_DIR}/apps/web"
  npm install --no-fund --no-audit
)

echo "[4/4] Buildando frontend..."
(
  cd "${ROOT_DIR}/apps/web"
  npm run build
)

COPYFILE_DISABLE=1 tar -czf "$OUT_FILE" \
  -C "${ROOT_DIR}/apps/api" dist \
  -C "${ROOT_DIR}/apps/web" .next

echo "Pacote gerado em: ${OUT_FILE}"
