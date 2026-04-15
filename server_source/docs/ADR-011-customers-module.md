# ADR-011: Customers Module

## Contexto

O SOI da Viníssimo já tinha `AUTH` e `Produtos` aprovados, mas o módulo de `Clientes`
ainda estava apenas no wireframe inicial do frontend. O schema `soi` já continha
as tabelas `customers`, `customer_preferences`, `customer_metrics` e
`customer_interactions`, o que permitia implementar um CRM operacional enxuto sem
inventar histórico comercial.

## Decisão

Foi implementado um módulo `Customers` no backend NestJS com leitura e escrita nas
tabelas operacionais do domínio, mantendo `ativo/inativo` sem delete físico e
expondo métricas mínimas já previstas no schema.

### Endpoints criados

- `GET /api/v1/customers`
- `POST /api/v1/customers`
- `GET /api/v1/customers/:customerId`
- `PATCH /api/v1/customers/:customerId`
- `GET /api/v1/customers/:customerId/preferences`
- `POST /api/v1/customers/:customerId/preferences`
- `GET /api/v1/customers/:customerId/interactions`
- `POST /api/v1/customers/:customerId/interactions`

## Decisões de modelagem

- O cadastro principal usa `soi.customers` para dados operacionais básicos.
- O status do cliente é normalizado para o conjunto `lead`, `novo`, `recorrente`,
  `inativo`.
- O status exposto respeita `is_active`; se o cadastro estiver inativo, o status
  final do cliente é `inativo`.
- `soi.customer_metrics` é inicializada com zeros e `null` quando o cliente nasce
  sem histórico real de compra.
- Preferências e interações são tratadas como registros operacionais independentes,
  sem tentar inferir automações de marketing.
- Os tipos de interação seguem o `CHECK` já existente do schema:
  `post_sale`, `review_request`, `reactivation` e `other`.
- O filtro `channel_id` usa `customers.acquisition_channel_id` com apoio de
  leitura em `soi.channels`.

## Decisões de UX

- A lista de clientes segue a mesma linguagem de `Produtos`, com filtros simples,
  tabela objetiva e edição por detalhe.
- O cadastro de cliente mostra status do SOI e leitura lateral das métricas
  disponíveis, sem transformar a tela num CRM genérico pesado.
- Preferências e interações ficam no detalhe do cliente, com formulários curtos e
  histórico logo ao lado para reduzir troca de contexto do operador.

## Consequências

- O módulo passa a servir de base para relacionamento operacional sem depender
  ainda de compras ou vendas consolidadas.
- O schema existente é aproveitado sem refatoração estrutural fora do escopo.
- Clientes ativos podem ser reclassificados dentro do SOI; clientes inativos
  continuam preservados para histórico.

## Próximos passos

- Conectar compras e vendas futuras à atualização real de `customer_metrics`.
- Avaliar filtros adicionais por última interação e por ticket médio quando o uso
  operacional do módulo crescer.
- Evoluir a curadoria de preferências em conjunto com o módulo de vendas, sem
  antecipar automação fora do escopo atual.
