#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_PATH="${1:-}"

if [ -z "$ARTIFACT_PATH" ] || [ ! -f "$ARTIFACT_PATH" ]; then
  echo "Uso: ./bin/deploy-runtime-artifacts.sh /caminho/artefato.tar.gz"
  exit 1
fi

for cmd in docker tar; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Comando obrigatório não encontrado: $cmd"
    exit 1
  }
done

cd "$ROOT_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${ROOT_DIR}/backups/runtime_artifacts_${TIMESTAMP}"
TMP_DIR="$(mktemp -d)"
PROJECT_OWNER="$(stat -c '%u:%g' "$ROOT_DIR")"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR/apps/api" "$BACKUP_DIR/apps/web"

if [ -d "${ROOT_DIR}/apps/api/dist" ]; then
  cp -a "${ROOT_DIR}/apps/api/dist" "${BACKUP_DIR}/apps/api/dist"
fi

if [ -d "${ROOT_DIR}/apps/web/.next" ]; then
  cp -a "${ROOT_DIR}/apps/web/.next" "${BACKUP_DIR}/apps/web/.next"
fi

tar --no-same-owner -xzf "$ARTIFACT_PATH" -C "$TMP_DIR"

test -d "${TMP_DIR}/dist" || {
  echo "Artefato inválido: diretório dist não encontrado."
  exit 1
}

test -d "${TMP_DIR}/.next" || {
  echo "Artefato inválido: diretório .next não encontrado."
  exit 1
}

rm -rf "${ROOT_DIR}/apps/api/dist" "${ROOT_DIR}/apps/web/.next"
cp -a "${TMP_DIR}/dist" "${ROOT_DIR}/apps/api/dist"
cp -a "${TMP_DIR}/.next" "${ROOT_DIR}/apps/web/.next"

if [ "$(id -u)" -eq 0 ]; then
  chown -R "$PROJECT_OWNER" "${ROOT_DIR}/apps/api/dist" "${ROOT_DIR}/apps/web/.next"
fi

docker compose up -d --no-deps --force-recreate api web

echo "Artefatos implantados com sucesso."
echo "Backup salvo em: ${BACKUP_DIR}"
