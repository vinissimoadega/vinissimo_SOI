# ADR-007 — Auth com bootstrap manual do primeiro admin

## Status
Aprovado

## Contexto
O SOI da Viníssimo já estava com backend NestJS, frontend Next.js, PostgreSQL isolado e schema `soi` aplicados, mas ainda sem autenticação.

Nesta fase, o objetivo era liberar apenas o módulo `AUTH`, sem alterar proxy, bind público ou a ordem aprovada dos demais módulos.

As tabelas de identidade já existiam no banco:
- `soi.users`
- `soi.roles`
- `soi.user_roles`

Também já havia papéis base cadastrados, incluindo `admin`.

## Decisão
Implementar autenticação mínima e operacional com as seguintes escolhas:

- backend NestJS com guarda global por padrão
- exceções públicas explícitas para:
  - `GET /api/v1/health`
  - `GET /api/v1/settings/current`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
- autenticação por email e senha
- hash de senha com `scrypt` do Node.js
- sessão baseada em JWT HS256 assinado com segredo vindo de `.env`
- transporte da sessão em cookie `HttpOnly`, `SameSite=Lax`
- autorização por papel preparada via decorator `Roles()` e guarda global de papéis

## Endpoints criados
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

## Estratégia de sessão / token
- o backend emite um JWT assinado com `JWT_SECRET`
- o token contém:
  - `sub`
  - `email`
  - `roles`
  - `iat`
  - `exp`
- o JWT é enviado ao navegador em cookie `HttpOnly`
- o frontend protegido usa esse cookie para:
  - redirecionar acessos não autenticados para `/login`
  - consultar `GET /auth/me` no layout autenticado
- o TTL da sessão ficou configurável por `JWT_EXPIRES_IN_HOURS`

## Estratégia de bootstrap do primeiro admin
Criar um script explícito e manual:

- `/opt/vinissimo/soi/bin/create-admin-user.sh`

O script:
- solicita nome, email e senha via terminal
- lê a senha com `stdin` seguro, sem argumento em texto puro
- valida confirmação de senha
- gera `password_hash` com `scrypt`
- insere o usuário em `soi.users`
- associa o papel `admin` em `soi.user_roles`
- falha se o email já existir

## Consequências
### Positivas
- o dashboard e as páginas autenticadas passam a exigir sessão válida
- a stack continua privada, apenas em bind local
- o segredo de sessão não fica hardcoded
- o modelo já nasce pronto para autorização por papel
- o bootstrap inicial do primeiro admin fica controlado e auditável

### Negativas
- ainda não há refresh token nesta fase
- ainda não há revogação centralizada de sessão além do logout por limpeza de cookie
- o frontend depende de `GET /auth/me` para validar a sessão a cada acesso protegido

## Próximos passos
1. aplicar o módulo Produtos sem quebrar a guarda global
2. começar a exigir papel por rota conforme os módulos forem entrando
3. avaliar refresh token e trilha de auditoria de login/logout
4. revisar política de cookie quando houver publicação com domínio próprio e TLS
