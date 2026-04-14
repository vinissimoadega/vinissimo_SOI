# ADR-032 — Leitura de código de barras pela câmera no iPhone

## Contexto

O uso real do SOI no iPhone mostrou fricção para localizar SKU no cadastro, nas compras e na recuperação de estoque. A operação precisava ler EAN/UPC pela câmera do navegador em HTTPS sem depender exclusivamente de APIs experimentais e sem bloquear a digitação manual.

## Estratégia em camadas

1. Camada nativa preferencial:
   - usar `BarcodeDetector` quando disponível e com suporte aos formatos relevantes
   - formatos priorizados: `ean_13`, `ean_8`, `upc_a`, `upc_e` e `code_128`
2. Fallback robusto:
   - usar `@zxing/browser` + `@zxing/library` para leitura por câmera quando a camada nativa não existir, falhar ou precisar de modo compatível
3. Fallback manual:
   - manter digitação manual de SKU sempre disponível no scanner

## Telas alteradas

- `/products/new`
- `/products/[id]`
- `/inventory/movements`
- `/purchases/new`

## Fluxos por contexto

### `/products/new`

- lê o código pela câmera
- preenche o SKU
- faz lookup exato no backend
- se o SKU existir, aponta para o cadastro existente
- se o SKU não existir, mantém o SKU preenchido e permite seguir com o cadastro

### `/products/[id]`

- permite conferência do código do produto já cadastrado
- se o código lido pertencer a outro produto, aponta para o cadastro correto sem mascarar duplicidade

### `/inventory/movements`

- lê o código pela câmera
- faz lookup exato
- seleciona automaticamente o produto para ajuste de saldo real
- se o SKU não existir, oferece atalho para cadastro do produto com o SKU já preenchido

### `/purchases/new`

- leitura por linha de item
- localiza o produto cadastrado e preenche a linha da compra
- se o SKU não existir, oferece atalho para abrir o cadastro de produto

## Integração com SKU existente

- foi criado lookup dedicado por SKU exato em `/api/v1/products/lookup/by-sku`
- o lookup devolve produto ativo ou inativo e não esconde item com estoque zero
- a resposta mínima inclui:
  - `id`
  - `sku`
  - `name`
  - `isActive`
  - `currentUnitCost`
  - `currentStockQty`

## Limitações conhecidas

- o modo nativo pode variar por versão do Safari/iOS; por isso o fluxo sempre oferece modo compatível
- a leitura por câmera depende de permissão explícita do navegador
- o scanner acelera a operação, mas não substitui a validação de unicidade do SKU no backend

## Próximos passos

- avaliar atalho opcional do scanner em `/sales/new` e `/sales/whatsapp`
- considerar lanterna por API de track constraints apenas quando a compatibilidade no iPhone for consistente
- avaliar captura de imagem do rótulo como complemento, sem misturar com a validação do SKU
