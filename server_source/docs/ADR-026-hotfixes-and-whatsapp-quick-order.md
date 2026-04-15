# ADR-026 — Hotfixes operacionais e venda rápida WhatsApp

## Contexto

O SOI da Viníssimo já cobre backoffice, dashboard e CRM operacional, mas o go-live assistido ainda exigia alguns ajustes imediatos para reduzir atrito na rotina:

- busca incompleta em áreas operacionais
- dependência de input manual para código de cliente e número de venda
- fluxo de despesas ainda em estado de casca
- ausência de um fluxo rápido para pedidos recebidos pelo WhatsApp
- ausência de separação explícita entre status do pedido e status do pagamento

## Bugs corrigidos

- Busca em vendas passou a aceitar número da venda, nome do cliente, email e telefone.
- Busca em compras passou a aceitar número da compra, nome do fornecedor e código do fornecedor.
- Busca em clientes passou a aceitar telefone com normalização de dígitos.
- Despesas deixou de ser placeholder e passou a ter listagem real, filtros e cadastro funcional.

## Estratégia de numeração automática

- Cliente:
  - código operacional gerado automaticamente no backend
  - formato: `CLI-000001`
  - UUID técnico preservado como chave primária
  - código operacional fica imutável após a criação
- Venda:
  - número operacional gerado automaticamente no backend
  - formato: `VEN-000001`
  - UUID técnico preservado como chave primária
  - número operacional fica imutável após a criação

Ambas as sequências usam trava transacional (`pg_advisory_xact_lock`) e leitura do maior número já emitido para evitar colisões.

## Estratégia do fluxo de venda rápida

Foi criada uma tela dedicada de venda rápida em `/sales/whatsapp` para pedidos recebidos pelo WhatsApp:

- busca imediata do cliente por telefone
- criação rápida de cliente quando não existir
- canal pré-selecionado como `WhatsApp`
- montagem do pedido com poucos cliques
- número automático da venda
- resumo profissional do pedido
- mensagem pronta para copiar e enviar manualmente

O fluxo é deliberadamente operacional e manual: ele acelera o lançamento, mas não dispara mensagens automaticamente.

## Separação entre pedido e pagamento

O modelo de `sales_orders` foi ampliado com:

- `payment_status`
- `external_charge_reference`
- `payment_notes`

Estados mínimos adotados:

- `unpaid`
- `pending_confirmation`
- `paid`
- `failed`
- `refunded`

Essa separação evita confundir cobrança com entrega real. O status do pedido continua regendo reconciliação de estoque; o status do pagamento não cria movimento algum.

## Limitações atuais do Pix

Nesta rodada não houve integração real com Pix, PSP ou webhook, por ausência de credencial real e controlada já disponível.

O sistema ficou apenas preparado para:

- registrar status de cobrança
- armazenar referência externa da cobrança
- receber integração futura sem reabrir a modelagem básica

## Próximos passos

- integrar cobrança real somente quando houver credencial controlada e governança definida
- adicionar fluxo de confirmação manual assistida por evidência de pagamento
- evoluir o resumo profissional para modelos por canal, se a operação pedir
- ampliar o módulo de despesas apenas se a rotina real mostrar necessidade
