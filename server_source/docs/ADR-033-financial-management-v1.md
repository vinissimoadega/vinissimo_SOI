# ADR-033 — Financial Management V1

## Contexto

O SOI da Viníssimo já opera com produtos, clientes, compras, vendas, estoque,
fornecedores, despesas, dashboard e CRM. A operação precisava de uma camada
financeira gerencial que separasse venda de caixa, preservasse a trilha
operacional existente e desse visibilidade de contas a receber, contas a pagar,
caixa previsto versus realizado e DRE simplificada.

Este sprint adota explicitamente um módulo gerencial e não fiscal. Não entram
integração bancária automática, Pix automático, conciliação bancária nem
contabilidade oficial.

## Escopo do módulo

- Contas a receber gerenciais derivadas de vendas e receitas manuais futuras.
- Contas a pagar gerenciais derivadas de compras, despesas e lançamentos manuais
  futuros.
- Fluxo de caixa previsto x realizado.
- DRE gerencial simplificada.
- Regras financeiras por canal.
- Repasses de marketplace em lote, com foco inicial em iFood.
- Painel financeiro executivo e listas operacionais em PT-BR.

## Decisão: módulo gerencial e não fiscal

- O módulo trabalha com competência, previsão, realização e leitura de margem.
- A estrutura evita plano de contas contábil pesado.
- O objetivo é apoiar decisão operacional e gestão do caixa.
- Status, filtros e ações foram desenhados para rotina da loja.

## Regra financeira por canal

Foi criada uma camada própria de regra financeira por canal com:

- `settlement_type`
- `expected_settlement_rule`
- `expected_days`
- `fee_pct`
- `is_active`
- `notes`

Aplicação padrão do V1:

- `balcao`: liquidação imediata no mesmo dia.
- `whatsapp`: liquidação imediata no mesmo dia.
- `instagram`: recebível gerencial no mesmo dia, preservando taxa configurável.
- `ifood`: `marketplace_batch` com `weekly_wednesday`.

As regras ficam editáveis no módulo financeiro, sem hardcode cego na tela.

## Regra do iFood com repasse semanal na quarta

Para o canal iFood:

- venda criada não vira caixa realizado imediato por padrão;
- a venda gera `financial_receivable`;
- a regra default calcula `expected_receipt_date` para a próxima quarta-feira;
- o recebível pode ser ajustado manualmente;
- o módulo cria lotes de repasse em `financial_settlement_batches`;
- cada lote registra período, data prevista, data real, valor esperado, valor
  recebido, status e observações.

Essa decisão preserva a leitura correta de marketplace: venda realizada não é
sinônimo de dinheiro já recebido.

## Tabelas criadas

- `soi.financial_channel_rules`
- `soi.financial_receivables`
- `soi.financial_payables`
- `soi.financial_settlement_batches`

## Rotas e telas criadas

### API

- `GET /api/v1/financial/overview`
- `GET /api/v1/financial/receivables`
- `PATCH /api/v1/financial/receivables/:receivableId`
- `GET /api/v1/financial/payables`
- `PATCH /api/v1/financial/payables/:payableId`
- `GET /api/v1/financial/cashflow`
- `GET /api/v1/financial/pnl`
- `GET /api/v1/financial/settlements`
- `POST /api/v1/financial/settlements/ifood/generate`
- `PATCH /api/v1/financial/settlements/:batchId`
- `GET /api/v1/financial/channel-rules`
- `PATCH /api/v1/financial/channel-rules/:ruleId`

### Web

- `/financial/overview`
- `/financial/receivables`
- `/financial/payables`
- `/financial/cashflow`
- `/financial/pnl`
- `/financial/settlements`

## Integrações com módulos existentes

### Vendas

- vendas passam a sincronizar contas a receber;
- `payment_status` afeta previsão versus realização;
- `order_status` continua separado de caixa;
- custos adicionais por venda entram na leitura financeira e na DRE.

### Compras

- compras passam a sincronizar contas a pagar gerenciais;
- fornecedor existente é refletido no título a pagar.

### Despesas

- despesas passam a sincronizar contas a pagar gerenciais;
- natureza e forma de pagamento são preservadas.

### Fornecedores

- contas a pagar reaproveitam fornecedor real quando a origem é compra.

### Custos adicionais por venda

- entram no agregado da venda;
- compõem a DRE simplificada como redução da margem gerencial.

## Decisões de UX

- PT-BR operacional em cards, filtros, títulos, botões e status visíveis;
- leitura executiva em overview;
- listas operacionais separadas para receber, pagar, caixa, DRE e repasses;
- ações rápidas para marcar recebido/pago, recebido/pago parcial e ajustar datas;
- módulo responsivo seguindo o shell já publicado.

## Limitações do V1

- sem contabilidade fiscal e sem emissão fiscal;
- sem conciliação bancária automática;
- sem Pix automático e sem webhook bancário;
- sem motor de parcelamento avançado nesta rodada;
- receitas manuais ainda não ganharam tela dedicada.

## Próximos passos

- receitas manuais gerenciais;
- conciliação assistida por lote;
- filtros mais profundos por competência e natureza;
- exportação financeira;
- evolução da régua de repasses por marketplace e cartão.
