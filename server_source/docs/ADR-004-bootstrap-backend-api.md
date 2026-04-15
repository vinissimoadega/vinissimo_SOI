# ADR-004 — Bootstrap inicial do backend da API do SOI

## Status
Aprovado

## Contexto
Após o bootstrap isolado da stack da Viníssimo, a criação do schema do SOI e a inserção da configuração corrente inicial, o próximo passo correto foi subir um backend mínimo da API do SOI.

## Decisão
Inicializar um backend mínimo em NestJS, isolado na stack da Viníssimo, com:

- bind local em 127.0.0.1:4100
- conexão com o Postgres da Viníssimo
- rota de health
- rota de leitura da configuração corrente

## Escopo inicial
- GET /api/v1/health
- GET /api/v1/settings/current

## Regras preservadas
- nenhuma publicação pública nova
- nenhuma alteração na stack da Axon
- backend ligado exclusivamente ao Postgres da Viníssimo
- API orientada ao domínio do SOI

## Resultado
O backend mínimo foi validado com sucesso:
- container `vinissimo-soi-api` em execução
- bind local em `127.0.0.1:4100`
- healthcheck respondendo com status ok
- leitura correta de `soi.v_current_system_settings`

## Consequências
### Positivas
- backend mínimo funcional
- base pronta para evolução de auth, produtos, compras, vendas e estoque
- validação do caminho real frontend -> API -> banco

### Negativas
- auth ainda não implementado
- módulos de negócio ainda não expostos na API
- frontend ainda não conectado

## Próximos passos
1. subir estrutura inicial do frontend
2. conectar frontend à API local
3. depois implementar auth
4. então abrir os módulos de domínio prioritários
