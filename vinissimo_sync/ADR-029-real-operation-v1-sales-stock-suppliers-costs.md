# ADR-029 — Operação Real V1: vendas, estoque, fornecedores e custos adicionais

## Contexto

O uso real do SOI em produção expôs gargalos operacionais nos fluxos centrais da loja:

- seleção de cliente inviável em vendas com base crescente
- ausência de cadastro inline de cliente dentro da venda
- busca insuficiente no fluxo de venda rápida via WhatsApp
- ajuste de estoque limitado a delta manual, sem contagem física por saldo-alvo
- tela de fornecedores ainda como placeholder
- ausência de custos adicionais específicos por venda na margem operacional
- inconsistências de linguagem visível ao usuário fora do pt-BR operacional

Este sprint fecha somente essas lacunas operacionais, preservando autenticação pública, domínio HTTPS e binds internos já aprovados.

## Problemas reais observados em operação

1. Em `/sales/new`, a seleção de cliente dependia de lista estática e não escalava.
2. Em `/sales/new` e `/sales/whatsapp`, faltava cadastro inline de cliente.
3. Em `/sales/whatsapp`, a busca precisava funcionar por nome, telefone e e-mail.
4. Em estoque, o operador precisava ajustar o saldo contado real, inclusive para zero.
5. Em fornecedores, a operação precisava cadastrar e editar fornecedores reais.
6. Em vendas, custos pontuais como cartão personalizado ou embalagem especial não entravam na margem da venda.
7. Parte dos rótulos/status ainda aparecia em inglês nas superfícies operacionais deste sprint.

## Decisões de modelagem

### Vendas

- Mantido UUID técnico no banco e numeração operacional separada.
- Mantido `order_status` separado de `payment_status`.
- Adicionada leitura de custos adicionais por venda sem misturar com despesas gerais.

### Estoque

- Mantidos dois modos de ajuste manual:
  - `delta_manual`
  - `target_balance`
- `target_balance` calcula o delta a partir do saldo atual derivado por movimentos.
- O movimento continua auditável em `soi.inventory_movements`, com observação descritiva do cálculo aplicado.

### Fornecedores

- Reaproveitada a tabela já existente `soi.suppliers`.
- A superfície placeholder foi substituída por CRUD mínimo funcional.
- Ajustado parsing para aceitar payload operacional de `leadTimeDays` e `isActive` sem fragilidade no backend.

### Custos adicionais por venda

- Reaproveitada a tabela `soi.sales_order_additional_costs` para registrar custos específicos da venda.
- Cada custo adicional fica vinculado à venda, com tipo, descrição, valor, observação, autor e timestamp.
- A margem/lucro agregados da venda passam a considerar a soma desses custos.

## Endpoints e telas alterados

### Backend

- `GET /api/v1/customers?search=...`
  - usado como busca assíncrona de cliente por nome, telefone e e-mail
- `POST /api/v1/customers`
  - usado no cadastro inline durante a venda
- `POST /api/v1/inventory/movements`
  - agora aceita `adjustmentMode = delta_manual | target_balance`
- `GET /api/v1/suppliers`
- `GET /api/v1/suppliers/:supplierId`
- `POST /api/v1/suppliers`
- `PATCH /api/v1/suppliers/:supplierId`
- `GET /api/v1/sales`
  - lista com `additionalCostTotal`
- `GET /api/v1/sales/:saleId`
  - detalhe com `additionalCosts`
- `POST /api/v1/sales`
  - aceita `additionalCosts`

### Frontend

- `/sales/new`
- `/sales/[saleId]`
- `/sales/whatsapp`
- `/inventory/movements`
- `/suppliers`
- `/sales`

## Estratégia de estoque por saldo-alvo

- O operador escolhe explicitamente entre delta manual e saldo real.
- No modo saldo real:
  - o sistema mostra saldo atual
  - recebe saldo contado
  - calcula o delta automaticamente
  - permite saldo contado igual a zero
- O movimento é salvo como ajuste auditável, sem deletar histórico.

## Estratégia de custos adicionais por venda

- Custos adicionais ficam dentro da própria venda, nunca em despesas gerais.
- Tipos operacionais previstos:
  - `custom_card`
  - `special_packaging`
  - `subsidized_shipping`
  - `extra_delivery`
  - `other`
- O item mantém seu lucro bruto próprio.
- O agregado da venda desconta os custos adicionais para refletir a margem operacional real.

## Decisões de pt-BR

- Mantidos enums internos em inglês para semântica estável de backend.
- A camada operacional visível ao usuário foi traduzida para pt-BR nas superfícies afetadas:
  - status do pedido
  - status do pagamento
  - rótulos de formulário
  - placeholders
  - textos auxiliares
  - tipos visíveis de ajuste e de custos adicionais

## Limitações

- A criação de venda continua sem edição completa de itens após criação; o PATCH permanece restrito ao cabeçalho já aprovado.
- O resumo/mensagem do fluxo WhatsApp continua sendo geração operacional local da interface, sem automação externa.
- O cadastro de fornecedores entregue é mínimo e operacional; governança avançada de fornecedores fica para rodada futura.

## Próximos passos

1. Revisar edição avançada de venda sem quebrar reconciliação de estoque.
2. Ampliar o uso de fornecedor real em compras históricas e relatórios.
3. Evoluir custos adicionais para relatórios agregados sem misturar com despesas gerais.
4. Continuar limpeza de pt-BR em superfícies fora deste sprint, sem reabrir módulos.
