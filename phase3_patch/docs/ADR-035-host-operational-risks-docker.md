# ADR-035 — Riscos operacionais de host (Docker DNS e governança de deploy)

## Status
Aprovado (plano de correção operacional registrado).

## Contexto
Na auditoria de inconsistências, permaneceram dois riscos operacionais no host:

1. **Resolução para Docker Hub indisponível**
   - `docker pull node:20-alpine` falha por erro de DNS;
   - impacto: reconstrução emergencial de imagem pode ficar bloqueada.

2. **Usuário operacional sem permissão de Docker**
   - `vinissimo-deploy` não consegue executar `docker ps`;
   - impacto: operação diária depende de usuário privilegiado.

## Decisão
Registrar o plano de correção em duas etapas, sem alterar lógica de negócio do SOI:

### Etapa A — DNS de runtime Docker no host
- aplicar ajuste de resolução DNS do host em janela operacional controlada;
- validar imediatamente:
  - `docker pull node:20-alpine`
  - `docker pull postgres:16-alpine`
  - `docker compose pull` no SOI.

### Etapa B — Governança de deploy do usuário operacional
- conceder acesso controlado ao Docker para `vinissimo-deploy`;
- validar:
  - `docker ps`
  - `docker compose ps` em `/opt/vinissimo/soi`.

## Evidência desta rodada
As evidências foram preservadas em:

- `backups/phase3_doc_and_ops_20260414_184000/logs/docker_pull_node20.log`
- `backups/phase3_doc_and_ops_20260414_184000/logs/docker_access_vinissimo_deploy.log`

## Consequências
- riscos ficam formalmente rastreados com evidência objetiva;
- correção técnica de host permanece separada da camada de aplicação;
- evita mistura de escopo de produto com escopo de infraestrutura.

## Próximos passos
- executar Etapa A e Etapa B em janela de manutenção;
- registrar saída em ADR incremental quando concluído;
- repetir checklist de recuperação operacional após correção.
