# ADR-012 — Semântica de status de clientes

## Contexto

O módulo `CLIENTES` já estava funcional, mas a semântica de `customer_status` ainda aceitava edição manual pelo formulário. Isso permitia inconsistências de domínio, como um cliente sem compras entregues aparecer como `novo`.

O modelo operacional do SOI exige que o status do cliente seja derivado do histórico consolidado de compras entregues, e não de edição manual de cadastro.

## Decisão

O `customer_status` passa a ser calculado exclusivamente a partir das métricas de cliente e da janela de inatividade definida em `soi.system_settings.customer_inactive_days`.

As regras adotadas ficam:

- `lead`: `orders_count = 0`
- `novo`: `orders_count = 1`
- `recorrente`: `orders_count >= 2` com atividade dentro da janela configurada
- `inativo`: cliente com histórico de compras, mas com `last_purchase_at` fora da janela configurada

O campo continua exposto nas APIs e na interface, mas deixa de ser aceito como entrada no `POST /api/v1/customers` e no `PATCH /api/v1/customers/:customerId`.

## Correções feitas

- backend de `customers` ajustado para derivar `customer_status` por expressão semântica nas consultas
- persistência de `soi.customer_metrics.customer_status` ajustada para salvar sempre o status derivado
- frontend ajustado para remover edição manual de `customer_status`
- interface mantida com leitura operacional do status e explicação de cálculo automático

## Consequências

- elimina inconsistência entre métricas e status exibido
- reduz erro operacional no cadastro manual
- prepara o módulo para integração futura com compras/vendas sem retrabalho semântico

## Próximos passos

- quando houver fluxo consolidado de compras entregues, recalcular métricas de clientes por rotina dedicada
- revisar se a janela de inatividade deve ganhar visibilidade adicional na interface administrativa
