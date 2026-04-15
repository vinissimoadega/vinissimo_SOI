# ADR-027 — Publicação HTTPS Pública do SOI da Viníssimo

## Contexto

O SOI da Viníssimo já estava funcional no host `209.126.77.253`, com os serviços internos publicados apenas em loopback:

- web em `127.0.0.1:3100`
- api em `127.0.0.1:4100`

O objetivo desta rodada foi publicar o sistema de forma segura em `https://app.vinissimoadega.com.br`, permitindo acesso externo por navegador e iPhone sem expor diretamente as portas internas da aplicação.

## Estratégia escolhida

Foi adotada a estratégia menos invasiva e mais segura para o host atual:

1. reutilizar o runtime de reverse proxy já existente no host
2. manter um único host público para frontend e backend
3. preservar o prefixo `/api/*` no roteamento para a API
4. manter `3100` e `4100` acessíveis apenas em loopback

A configuração do proxy foi carregada dinamicamente, sem alterar a lógica de negócio do SOI.

## Arquitetura final

Publicação final:

- `https://app.vinissimoadega.com.br/*` -> `127.0.0.1:3100`
- `https://app.vinissimoadega.com.br/api/*` -> `127.0.0.1:4100`

O prefixo `/api` foi preservado no roteamento para que o backend continue atendendo em `/api/v1/...` sem reescrita incorreta de caminho.

## Configuração do proxy

A publicação usa um host específico para `app.vinissimoadega.com.br`, com TLS automático e roteamento por path:

- rota `/api/*` encaminhada para a API interna
- rota padrão encaminhada para o frontend
- redirecionamento automático de HTTP para HTTPS

Foi necessário ajustar a resolução DNS do runtime do proxy para permitir a emissão do certificado TLS público.

## Proteção da API

A API não foi exposta em porta pública direta.

A proteção final ficou assim:

- `127.0.0.1:4100` continua acessível apenas localmente no host
- acesso externo à API ocorre somente via `https://app.vinissimoadega.com.br/api/v1/...`
- as portas `3100` e `4100` permanecem fora da exposição pública direta

## Implicações para autenticação e sessão

Para suportar o domínio público com segurança:

- `AUTH_COOKIE_SECURE=true`
- `CORS_ORIGINS` passou a incluir `https://app.vinissimoadega.com.br`
- `NEXT_PUBLIC_API_BASE_URL=/api/v1`
- `API_INTERNAL_BASE_URL=http://api:4100/api/v1`

Isso preserva a autenticação no mesmo host público sem separar a API em outro subdomínio.

## Validações realizadas

Foram validados com sucesso:

- resolução pública do domínio para `209.126.77.253`
- emissão de certificado TLS válido
- `GET https://app.vinissimoadega.com.br/login`
- `GET https://app.vinissimoadega.com.br/api/v1/health`
- autenticação no domínio público
- acesso autenticado a `/dashboard`
- acesso autenticado a `/crm`
- confirmação de que `3100` e `4100` seguem sem exposição pública direta

## Rollback

Em caso de reversão:

1. restaurar:
   - `/opt/vinissimo/soi/.env.before`
   - `/opt/vinissimo/soi/docker-compose.yml.before`
   - `/opt/vinissimo/soi/apps/web/.env.local.before`
2. recarregar a configuração anterior do proxy a partir do backup JSON
3. recriar os containers `api` e `web`
4. restaurar a configuração de resolução do runtime do proxy, se necessário

## Consequências

O SOI passa a operar publicamente em HTTPS sob um único host, com frontend e API publicados de forma consistente e sem exposição direta das portas internas.

Isso viabiliza uso real em navegador externo e iPhone mantendo o backend protegido atrás do reverse proxy.
