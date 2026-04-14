# ADR-008A — Estabilização pós-AUTH e workaround de build/deploy

## Status
Aprovado

## Contexto
Após a entrega do módulo `AUTH`, o código-fonte do backend e do frontend passou a existir em `/opt/vinissimo/soi`, mas a atualização dos containers em produção precisou usar `docker commit` como recuperação transitória.

O motivo foi operacional:
- `docker compose up -d --build api web` falhou no host;
- o erro ocorreu ao resolver `registry-1.docker.io`;
- o build remoto não conseguiu obter a imagem base `node:20-alpine`.

Ao mesmo tempo, o objetivo operacional da Viníssimo é manter:
- stack privada;
- bind local;
- operação diária pelo usuário `vinissimo-deploy`;
- source tree em `/opt/vinissimo/soi` como origem de verdade.

## Diagnóstico
O erro observado no build remoto foi:

- `lookup registry-1.docker.io on 127.0.0.53:53: read udp 127.0.0.1:*->127.0.0.53:53: read: connection refused`

Isso indica problema de resolução DNS no host para o resolvedor local `127.0.0.53`, afetando o Docker/BuildKit quando precisa consultar o Docker Hub.

Conclusão:
- o problema não é do código do `AUTH`;
- o problema é da cadeia de resolução DNS do host para builds que dependem do registry público.

## Decisão
Adotar um fluxo reprodutível baseado em artefatos compilados, sem depender de `docker commit` como método normal.

### Fluxo normal adotado
1. o código-fonte continua sendo alterado em `/opt/vinissimo/soi`
2. os artefatos são gerados fora do host afetado pelo problema de DNS:
   - `apps/api/dist`
   - `apps/web/.next`
3. esses artefatos são enviados ao host em um tarball
4. o script `bin/deploy-runtime-artifacts.sh` instala os artefatos no source tree
5. `docker compose up -d --no-deps --force-recreate api web` recria os serviços

### Ajustes de reprodutibilidade
- `bin/package-runtime-artifacts.sh` empacota `dist` e `.next` sem metadados extras de macOS, evitando ruído operacional ao extrair no host Linux
- `bin/deploy-runtime-artifacts.sh` extrai o artefato sem preservar ownership do empacotador e normaliza o owner final para o dono do projeto em `/opt/vinissimo/soi`

### Ajuste estrutural
Os serviços `api` e `web` passam a montar os artefatos do source tree:

- `./apps/api/dist:/app/dist:ro`
- `./apps/web/.next:/app/.next:ro`
- `./apps/web/public:/app/public:ro`
- `./apps/web/next.config.mjs:/app/next.config.mjs:ro`

Com isso:
- o runtime passa a refletir diretamente os artefatos presentes em `/opt/vinissimo/soi`
- o `docker commit` deixa de ser necessário no fluxo normal

## Exceção transitória registrada
O `docker commit` usado logo após a entrega do `AUTH` foi uma medida de recuperação operacional pontual, apenas para preservar a disponibilidade da stack privada enquanto o workaround reprodutível era estabilizado.

Ele não deve ser tratado como processo padrão de deploy.

## Operação adotada
### Scripts
- `bin/package-runtime-artifacts.sh`
- `bin/deploy-runtime-artifacts.sh`

### Usuário operacional
O tree do SOI foi ajustado para permitir operação por `vinissimo-deploy` dentro de `/opt/vinissimo/soi`.

Estado atual validado:
- `vinissimo-deploy` possui leitura e escrita no source tree, scripts e documentação do SOI
- `vinissimo-deploy` ainda não possui acesso ao socket do Docker (`/var/run/docker.sock`)
- por isso, o deploy operacional do SOI ficou parcialmente resolvido: arquivos e artefatos podem ser administrados por `vinissimo-deploy`, mas a recriação de containers ainda requer execução privilegiada

Essa limitação foi apenas diagnosticada e documentada. Ajustar grupo Docker, sudoers ou permissões globais do host está fora do escopo desta tarefa.

## Consequências
### Positivas
- o source tree passa a ser a referência operacional real
- o runtime reflete os artefatos presentes em disco
- o deploy cotidiano deixa de depender de `docker commit`
- o `docker commit` fica registrado somente como exceção transitória do pós-AUTH

### Negativas
- o host continua incapaz de fazer build remoto completo enquanto o DNS do Docker Hub não for corrigido
- o fluxo normal de build agora pressupõe uma etapa externa de empacotamento de artefatos
- a recriação de containers ainda depende de privilégios que `vinissimo-deploy` não possui hoje

## Próximos passos
1. corrigir o resolvedor DNS do host em janela apropriada, fora deste escopo
2. quando o DNS estiver normalizado, revalidar `docker compose up -d --build api web`
3. provisionar acesso operacional controlado ao Docker para `vinissimo-deploy`, em tarefa específica fora deste escopo
4. manter `docker commit` somente como último recurso, nunca como padrão
