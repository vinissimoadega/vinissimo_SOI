# ADR-002 — Inicialização do schema do SOI

## Status
Aprovado

## Contexto
O bootstrap isolado da Viníssimo no servidor 209.126.77.253 foi concluído com Postgres próprio, sem exposição pública de porta e sem alteração da stack da Axon.

Com a infraestrutura mínima validada, foi necessário inicializar o schema do SOI no banco `vinissimo_soi`.

## Decisão
Aplicar o DDL inicial do SOI no Postgres da Viníssimo a partir do arquivo:

- /opt/vinissimo/soi/infra/postgres/schema/001-soi-ddl.sql

A aplicação foi realizada com:

- carregamento do `.env`
- execução do `psql` via `docker compose exec -T`
- alimentação do SQL por STDIN

## Resultado
O schema `soi` foi criado com sucesso, incluindo:

- identidade e acesso
- referência e configuração
- catálogo
- compras
- vendas
- estoque
- CRM
- gestão, alertas e snapshots
- views operacionais
- seeds mínimos de papéis e canais

## Regras estruturais preservadas
- PostgreSQL como fonte principal de verdade
- estoque derivado de movimentos
- isolamento da stack da Viníssimo
- nenhuma alteração na stack da Axon
- nenhuma exposição pública nova nesta fase

## Consequências
### Positivas
- base persistente do domínio criada
- modelo pronto para API, backend e frontend
- seeds mínimos disponíveis
- documentação local da decisão preservada

### Negativas
- parâmetros correntes ainda precisam ser inseridos em `system_settings`
- API e frontend ainda não foram conectados ao banco

## Próximos passos
1. validar tabelas, views e seeds
2. inserir configuração corrente em `system_settings`
3. ajustar o helper `psql.sh` para suportar arquivo via STDIN
4. subir backend da API do SOI
5. depois subir frontend em bind local
