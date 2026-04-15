# ADR-010 — Products module

## Status
Aprovado

## Contexto
Com `AUTH` já finalizado, o próximo passo autorizado do SOI da Viníssimo é o módulo de `Produtos`.

O domínio já possuía modelagem em banco para:
- `soi.products`
- `soi.product_categories`
- `soi.product_channel_prices`
- `soi.product_cost_snapshots` como leitura opcional

O objetivo desta entrega foi transformar essa modelagem em um módulo utilizável no backend e no frontend, sem abrir escopo para Clientes, Compras, Vendas, Estoque ou Dashboard real.

## Endpoints criados
### Produtos
- `GET /api/v1/products`
- `POST /api/v1/products`
- `GET /api/v1/products/:productId`
- `PATCH /api/v1/products/:productId`
- `GET /api/v1/products/:productId/channel-prices`
- `PUT /api/v1/products/:productId/channel-prices`

### Categorias
- `GET /api/v1/categories`
- `POST /api/v1/categories`

## Decisões de modelagem
- `sku` é tratado como obrigatório e único
- `sku` é normalizado em caixa alta na escrita para reduzir variação operacional
- o módulo não expõe deleção física de produto; a operação de ciclo de vida é `ativo/inativo`
- `default_supplier_id` foi deixado fora da UI e fora do payload do módulo para evitar inflar o escopo antes do módulo de Compras
- `product_cost_snapshots` foi usado apenas como leitura complementar de custo atual quando existir, sem abrir fluxo de manutenção dessa tabela neste módulo
- `PUT /channel-prices` adota semântica de substituição do conjunto de preços do produto:
  - canais com preço vazio permanecem opcionais e não são gravados
  - canais com preço informado passam a existir em `soi.product_channel_prices`

## Decisões de UX
- a lista de produtos substitui o placeholder anterior por uma tela real com:
  - busca por SKU/nome
  - filtro por categoria
  - filtro por status ativo/inativo
  - paginação
  - acesso rápido para edição
  - ativação/inativação sem delete físico
- a criação e a edição foram separadas em:
  - `/products/new`
  - `/products/:productId`
- a edição de preços por canal fica na tela de detalhe do produto, evitando abrir uma experiência fragmentada
- a criação mínima de categorias foi acoplada à lateral da lista de produtos para manter a curadoria do mix sem poluir o fluxo principal
- o layout, o shell e o branding existentes foram preservados

## Consequências
### Positivas
- o SOI passa a ter cadastro-mãe real de SKUs
- o módulo já respeita `ativo/inativo` como regra de domínio
- preços-alvo por canal ficam prontos para sustentar compras, vendas e margem futura
- categorias mínimas já permitem organizar o mix com coerência operacional

### Restrições mantidas
- nenhuma alteração foi feita fora do escopo de `Produtos`
- nenhuma mudança foi aplicada em `/opt/axon/*`
- nenhuma porta pública nova foi aberta
- nenhuma mudança foi feita em proxy, firewall, iptables ou host network

## Próximos passos
1. usar `Produtos` como base para os seletores e regras do módulo de Clientes, sem implementá-lo agora
2. conectar o custo atual a fluxos reais de compras quando o módulo de Compras for autorizado
3. ligar preços por canal às leituras econômicas de Vendas quando esse módulo entrar em execução
