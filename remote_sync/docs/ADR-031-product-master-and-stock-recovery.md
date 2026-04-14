# ADR-031 — Cadastro Mestre de Vinhos + Busca Consistente + Recuperação de Estoque

## Contexto

O uso real do SOI mostrou quatro dores no cadastro de vinhos:

- o cadastro de produto ainda estava pobre para operação de adega;
- um SKU duplicado bloqueava a gravação, mas o operador nem sempre conseguia localizar o cadastro existente;
- produtos com saldo zero, especialmente quando inativos, continuavam difíceis de localizar e editar;
- a recuperação do saldo físico real precisava ficar mais direta a partir do próprio fluxo de produto/estoque.

## Decisões de modelagem

Foram adicionados campos operacionais simples e pesquisáveis em `soi.products`:

- `country_name`
- `region_name`
- `grape_composition`
- `wine_description`

Nesta rodada foi evitada uma modelagem enológica complexa. O objetivo é dar contexto comercial e operacional suficiente para a curadoria, a busca e o atendimento.

## Estratégia de busca consistente

A busca de produtos passou a considerar:

- SKU exato com prioridade operacional;
- SKU parcial;
- nome parcial;
- país;
- região;
- casta/uvas;
- descrição do vinho;
- observações.

Quando ocorre conflito de SKU, a API agora devolve mensagem explícita com:

- nome do produto existente;
- SKU existente;
- `href` operacional para abrir o cadastro correto.

No frontend, o formulário mostra um bloco acionável com botão para abrir o cadastro já existente.

## Tratamento de produto com saldo zero

O problema real não era o saldo zero em si, mas a combinação de:

- filtro implícito de ativos na busca global;
- dificuldade para sair do estoque e abrir o cadastro correto;
- recuperação manual de saldo sem produto pré-selecionado.

As mudanças aplicadas foram:

- busca global sem forçar `is_active=true`;
- tela `/products` com filtro explícito de status em vez de filtro escondido;
- ação direta de abrir cadastro a partir do estoque;
- ação direta de corrigir saldo real a partir do cadastro e da listagem de estoque.

## Estratégia de ajuste de estoque

O ajuste manual continua auditável via `soi.inventory_movements`.

Nesta rodada foi reforçado o fluxo por saldo-alvo:

- produto pode chegar pré-selecionado via `product_id`;
- o operador vê saldo atual, saldo contado e delta gerado;
- o modo `Saldo real contado` continua permitindo zerar o item quando o físico estiver zerado;
- o motivo permanece obrigatório.

Nenhuma edição “mágica” de saldo foi introduzida.

## Mudanças por tela

### `/products`

- busca consistente por SKU/nome/origem/uvas/descrição;
- filtro de status explícito;
- ação de corrigir saldo direto da listagem;
- visualização mais clara dos metadados do vinho.

### `/products/new`

- novos campos operacionais do vinho;
- mensagem acionável para SKU duplicado com link para o cadastro existente.

### `/products/[id]`

- edição dos novos campos;
- atalhos para busca do SKU, visão do estoque e correção de saldo real.

### `/inventory`

- ação para abrir cadastro do produto;
- ação para corrigir saldo real do item selecionado.

### `/inventory/movements`

- formulário pode abrir já focado no produto escolhido;
- reforço textual do uso correto entre delta manual e saldo real contado.

## Validações

As validações desta rodada focaram em:

- criação e edição de produto com os novos campos;
- busca por SKU exato e nome parcial;
- conflito de SKU com referência operacional ao cadastro existente;
- localização e edição de produto com saldo zero;
- ajuste auditável de saldo real;
- preservação de login público, dashboard, CRM e domínio publicado.

## Limitações residuais

- a busca consistente foi aplicada nas superfícies operacionais deste sprint; não houve reabertura de outras rotas fora de `/products` e `/inventory`;
- os novos campos são textuais e simples; taxonomia avançada de castas/regiões ficou fora desta rodada;
- o ajuste continua auditável por movimento, sem atalho de edição direta de saldo.
