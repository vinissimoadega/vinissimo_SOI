# ADR-034 — Ampliação do scanner de código de barras para rotas de venda

## Contexto

Após a entrega inicial do scanner mobile (ADR-032), as rotas com maior frequência operacional de venda (`/sales/new` e `/sales/whatsapp`) ainda exigiam seleção manual do produto, gerando fricção no uso real.

## Decisão

Ampliar o scanner de câmera para os dois fluxos de venda:

1. **Nova venda (`/sales/new`)**
   - botão “Ler código pela câmera” por item;
   - leitura de SKU com `lookupProductBySku`;
   - preenchimento automático do item selecionado;
   - ação operacional para abrir produto encontrado ou cadastrar novo SKU.

2. **Venda rápida WhatsApp (`/sales/whatsapp`)**
   - botão “Ler código pela câmera” por linha;
   - lookup exato de SKU;
   - preenchimento automático do item do pedido;
   - ações para produto existente ou cadastro de SKU inexistente.

## Regras preservadas

- sem criação de SKU duplicado;
- sem alteração de semântica de estoque;
- sem remoção do fallback manual de digitação/seleção;
- sem alteração de login, domínio ou proxy.

## Impacto técnico

- Arquivos alterados:
  - `apps/web/components/sales/sale-form.tsx`
  - `apps/web/components/sales/whatsapp-quick-order.tsx`
- Reuso da infraestrutura existente:
  - `BarcodeScannerSheet`
  - `lookupProductBySku`

## Validação desta rodada

- build de frontend concluído com sucesso;
- web reiniciado e saudável;
- API health preservada;
- rotas públicas principais preservadas (`/login`, `/api/v1/health`).

## Limitações

- validação de leitura por câmera em hardware real (iPhone) deve seguir no checklist operacional de homologação assistida.
- presença de erros residuais de Server Action em logs históricos pode aparecer até invalidação completa de sessões antigas do browser.

## Rollback

Restaurar os backups:

- `backups/phase2_sales_scanner_20260414_181500/files/sale-form.tsx.bak`
- `backups/phase2_sales_scanner_20260414_181500/files/whatsapp-quick-order.tsx.bak`

e reiniciar apenas o serviço `web`.
