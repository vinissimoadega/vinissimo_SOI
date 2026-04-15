# ADR-025: CRM operacional, pós-venda e recorrência

## Contexto

O SOI da Viníssimo já cobre autenticação, produtos, clientes, compras, vendas, estoque e dashboard real v1. O próximo passo operacional é transformar a aplicação em ferramenta de rotina comercial diária, sem integrar disparos externos.

Nesta etapa, a base real ainda não possui clientes ativos nem vendas entregues, então o módulo precisa nascer funcional e auditável, mas com comportamento vazio consistente quando a operação ainda não tiver massa comercial.

## Blocos implementados

- fila operacional do dia
- memória comercial consolidada do cliente
- pós-venda estruturado
- solicitação de avaliação
- reativação e recorrência
- painel operacional dedicado em `/crm`

## Decisões de modelagem

- O módulo reutiliza `soi.customer_interactions` como store operacional de tarefas, evitando criar uma tabela nova nesta rodada.
- Para suportar o fluxo operacional, `soi.customer_interactions` recebe extensão mínima com:
  - vínculo opcional com pedido
  - motivo da ação
  - status operacional da tarefa
  - prioridade
  - `updated_at`
- A geração automática de tarefas derivadas fica restrita ao backend:
  - `post_sale_due` para pedidos entregues
  - `review_request_due` para pedidos entregues
  - `reactivation_due` para clientes inativos
- A fila do CRM considera apenas os tipos operacionais do sprint:
  - `followup_pending`
  - `post_sale_due`
  - `review_request_due`
  - `reactivation_due`
  - `manual_action_due`
- A memória comercial do cliente consolida:
  - cadastro
  - métricas aprovadas do cliente
  - preferências agrupadas
  - histórico recente de vendas
  - tarefas/interações recentes
  - próxima ação sugerida

## Endpoints criados

- `GET /api/v1/crm/overview`
- `GET /api/v1/crm/queue`
- `GET /api/v1/crm/customers/:customerId/memory`
- `POST /api/v1/crm/tasks`
- `PATCH /api/v1/crm/tasks/:taskId`

## Decisões de UX

- O módulo ganha uma tela dedicada em `/crm`, separada do dashboard executivo.
- A tela `/crm` funciona como cockpit operacional do dia, com foco em:
  - fila aberta
  - clientes que exigem ação
  - recorrência
  - pós-venda
  - avaliação
  - reativação
  - pendências comerciais relevantes
- A tela de detalhe do cliente passa a exibir memória comercial consolidada e ações de relacionamento no mesmo contexto.
- Não há automação de envio real nesta etapa; toda ação continua manual e auditável.

## Limitações

- Sem clientes e vendas entregues na base real atual, os blocos operacionais retornam estado vazio consistente.
- O módulo não envia mensagens, não integra APIs externas e não agenda automações reais.
- O store operacional segue reutilizando `customer_interactions`; se o volume crescer, pode valer separar tarefas CRM em tabela própria no futuro.

## Próximos passos

- Reavaliar a separação entre histórico de interação e fila operacional quando o volume aumentar.
- Adicionar filtros de janela e responsável na fila, se a operação real demandar.
- Evoluir a memória comercial com enriquecimento adicional apenas quando houver dado confiável na base.
