#!/usr/bin/env bash
set -euo pipefail

cd /opt/vinissimo/soi

read -r -p "Nome completo do admin: " FULL_NAME
FULL_NAME="$(printf '%s' "$FULL_NAME" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

if [ -z "$FULL_NAME" ]; then
  echo "Nome completo é obrigatório."
  exit 1
fi

read -r -p "Email do admin: " EMAIL
EMAIL="$(printf '%s' "$EMAIL" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')"

if [[ ! "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Email inválido."
  exit 1
fi

read -r -s -p "Senha do admin: " PASSWORD
printf '\n'
read -r -s -p "Confirme a senha: " PASSWORD_CONFIRMATION
printf '\n'

if [ "$PASSWORD" != "$PASSWORD_CONFIRMATION" ]; then
  echo "As senhas não conferem."
  exit 1
fi

if [ "${#PASSWORD}" -lt 10 ]; then
  echo "A senha deve ter pelo menos 10 caracteres."
  exit 1
fi

if ! docker compose ps api >/dev/null 2>&1; then
  echo "Não foi possível acessar o serviço api via docker compose."
  exit 1
fi

if [ "$(./bin/psql.sh -At -c "SELECT COUNT(1) FROM soi.roles WHERE role_key = 'admin';")" != "1" ]; then
  echo "Role 'admin' não encontrada em soi.roles."
  exit 1
fi

if [ "$(
  ./bin/psql.sh -At -v email="$EMAIL" <<'SQL'
SELECT COUNT(1)
FROM soi.users
WHERE LOWER(email) = LOWER(:'email');
SQL
)" != "0" ]; then
  echo "Já existe um usuário com esse email."
  exit 1
fi

PASSWORD_HASH="$(
  printf '%s' "$PASSWORD" | docker compose exec -T api node -e '
    const { randomBytes, scryptSync } = require("crypto");
    let password = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      password += chunk;
    });
    process.stdin.on("end", () => {
      password = password.replace(/\r?\n$/, "");
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 64).toString("hex");
      process.stdout.write(`scrypt$${salt}$${hash}`);
    });
  '
)"

./bin/psql.sh -v full_name="$FULL_NAME" -v email="$EMAIL" -v password_hash="$PASSWORD_HASH" <<'SQL'
\set ON_ERROR_STOP on

WITH new_user AS (
  INSERT INTO soi.users (full_name, email, password_hash)
  VALUES (:'full_name', :'email', :'password_hash')
  RETURNING id, email
)
INSERT INTO soi.user_roles (user_id, role_id)
SELECT new_user.id, role_admin.id
FROM new_user
JOIN soi.roles AS role_admin ON role_admin.role_key = 'admin';
SQL

unset PASSWORD PASSWORD_CONFIRMATION PASSWORD_HASH

echo "Usuário admin criado com sucesso para ${EMAIL}."
