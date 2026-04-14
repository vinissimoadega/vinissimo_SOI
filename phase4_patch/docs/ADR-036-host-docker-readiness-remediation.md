# ADR-036 — Remediação de prontidão Docker do host

## Contexto
Os riscos operacionais registrados no ADR-035 impediam operação confiável de manutenção:
- `docker pull` falhando por resolução DNS do host
- usuário `vinissimo-deploy` sem acesso ao socket Docker

A execução desta fase fechou a remediação com rollback preservado.

## Decisões aplicadas
1. Corrigida permissão de `/dev/null` para `666` (root:root), eliminando erros de serviços de sistema.
2. Ajustada resolução DNS do host para resolvers públicos estáveis em `/etc/resolv.conf`.
3. Configurado `daemon.json` do Docker com DNS explícito (`1.1.1.1`, `8.8.8.8`).
4. Reiniciado Docker e revalidado `docker pull` para imagens de referência.
5. Adicionado `vinissimo-deploy` ao grupo `docker`.
6. Restaurado acesso público do domínio da Viníssimo por proxy dedicado no compose do SOI (`vinissimo-soi-proxy`) sem exposição de `3100/4100`.

## Evidências da rodada
Backup e evidências:
- `/opt/vinissimo/soi/backups/phase4_host_ops_fix_20260414_193147`

Resultados principais:
- `docker pull node:20-alpine` = OK
- `docker pull postgres:16-alpine` = OK
- `vinissimo-deploy` executa `docker ps` = OK
- `https://app.vinissimoadega.com.br/login` = 200
- `https://app.vinissimoadega.com.br/api/v1/health` = 200
- `3100` e `4100` seguem bindados em loopback

## Consequências
- Reduzido risco de indisponibilidade em manutenção/rebuild.
- Rotina operacional deixa de depender de root para comandos Docker do dia a dia.
- Publicação HTTPS da Viníssimo fica isolada no stack do projeto.

## Rollback
1. Remover serviço `proxy` do compose e subir stack sem proxy.
2. Restaurar `/etc/resolv.conf` e `/etc/docker/daemon.json` a partir do backup da rodada.
3. Reiniciar Docker.
4. Reverter grupo de `vinissimo-deploy` caso necessário.

