# ADR-008 — Auth stabilization

## Status
Aprovado

## Contexto
Após a entrega funcional do módulo `AUTH`, o backend e o frontend já autenticavam corretamente, mas a operação ainda estava apenas parcialmente aprovada porque o runtime em produção tinha dependido de uma contingência operacional para permanecer disponível.

O objetivo desta estabilização foi transformar o estado de `AUTH` em:
- persistido no source tree de `/opt/vinissimo/soi`
- reprodutível sem `docker commit` como método normal
- auditável por documentação e backups
- pronto para servir de base para o próximo módulo

## Causa do fallback operacional anterior
O fallback anterior aconteceu porque o host não conseguia reconstruir as imagens `api` e `web` a partir do `docker compose build`.

Evidência observada:
- `docker pull node:20-alpine` falhou
- `curl -I https://registry-1.docker.io/v2/` falhou
- `/etc/resolv.conf` apontava para `127.0.0.53`
- `systemd-resolved` estava inativo
- não havia listener ativo em `127.0.0.53:53`

Erro característico:
- `lookup registry-1.docker.io on 127.0.0.53:53: read udp 127.0.0.1:*->127.0.0.53:53: read: connection refused`

Conclusão:
- o problema não era do código do `AUTH`
- o problema era do caminho de resolução DNS do host para acessar o Docker Hub

## Estratégia final de build/deploy
Foi adotado um fluxo reprodutível por artefatos compilados, mantendo o source tree como origem de verdade.

### Fluxo final
1. alterar código apenas em `/opt/vinissimo/soi`
2. gerar artefatos fora do host afetado pelo problema de DNS:
   - `apps/api/dist`
   - `apps/web/.next`
3. empacotar os artefatos com `bin/package-runtime-artifacts.sh`
4. transferir o tarball para o host
5. implantar com `bin/deploy-runtime-artifacts.sh`
6. recriar apenas `api` e `web` com `docker compose up -d --no-deps --force-recreate api web`

### Montagens aplicadas
- `./apps/api/dist:/app/dist:ro`
- `./apps/web/.next:/app/.next:ro`
- `./apps/web/public:/app/public:ro`
- `./apps/web/next.config.mjs:/app/next.config.mjs:ro`

Com isso:
- o runtime passa a consumir diretamente os artefatos persistidos no source tree
- `docker commit` deixa de ser método normal de deploy

## Correções feitas
- confirmação de que todo o código do `AUTH` está persistido em `/opt/vinissimo/soi`
- comparação entre source tree e runtime por checksum e `BUILD_ID`
- criação do workflow reprodutível por artefatos
- atualização do `docker-compose.yml` para bind mounts somente-leitura dos artefatos
- criação dos scripts:
  - `bin/package-runtime-artifacts.sh`
  - `bin/deploy-runtime-artifacts.sh`
- normalização de ownership dos artefatos implantados para o dono do projeto
- documentação do incidente de DNS e da estratégia final de deploy

## Docker commit como contingência transitória
O `docker commit` usado logo após a entrega do `AUTH` fica registrado apenas como contingência transitória de preservação do ambiente, enquanto o workflow reprodutível era implantado.

Ele não deve ser reutilizado como processo padrão.

## Usuário técnico temporário
Durante a validação inicial foi criado o usuário técnico temporário:
- `auth-bootstrap-admin@vinissimo.local`

O plano operacional correto é:
1. criar um admin real via `bin/create-admin-user.sh`
2. validar login com o novo admin
3. remover o usuário técnico temporário

Se o nome, email e senha temporária do admin real ainda não tiverem sido fornecidos, a remoção do usuário técnico permanece bloqueada por segurança para evitar perda do único acesso administrativo validado.

## Consequências
### Positivas
- `AUTH` fica persistido e auditável
- o source tree vira referência operacional real
- o deploy deixa de depender de `docker commit`
- o runtime pode ser comparado diretamente com os artefatos persistidos

### Negativas
- o host continua incapaz de reconstruir imagens a partir do Docker Hub até a correção do DNS
- a recriação de containers ainda depende de acesso ao Docker daemon, o que `vinissimo-deploy` ainda não possui hoje

## Próximos passos
1. fornecer nome, email e senha temporária do admin real
2. criar o admin real via `bin/create-admin-user.sh`
3. remover `auth-bootstrap-admin@vinissimo.local`
4. tratar, em tarefa separada, o acesso operacional controlado do `vinissimo-deploy` ao Docker daemon
5. tratar, em janela apropriada e fora deste escopo, a correção do resolvedor DNS do host
