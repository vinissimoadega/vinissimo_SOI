# ADR-017 — Initial Real Stock Import

## Contexto

A Viníssimo já possui os módulos centrais do SOI aprovados. O próximo passo operacional é substituir a base demo de estoque por uma carga inicial baseada na planilha real recebida, sem quebrar a regra de que o saldo do sistema é derivado por movimentos.

A planilha recebida contém uma aba única (`ImportedProducts`) com código de barras, nome, preço, quantidade atual, status ativo/inativo, canal e colunas auxiliares vazias. Não há coluna explícita de custo, categoria ou fornecedor.

## Decisão

A carga inicial foi estruturada em três etapas:

- staging auditável da planilha em CSV dentro de `backups`
- saneamento explícito dos produtos demo já existentes
- importação do estoque real por movimentos `initial_stock`

A regra operacional adotada para a quantidade foi:

- `Qtd. Atual Estoque` importada com normalização `valor_bruto / 1000`

Essa decisão foi necessária porque os valores brutos da planilha vieram em escala incompatível com unidades físicas diretas, e a divisão por mil foi a interpretação minimamente consistente para uso operacional inicial. A hipótese foi registrada no staging e no relatório final para revisão futura.

## Estratégia aplicada

- Produtos demo foram preservados para auditoria, marcados como inativos e saneados via ajuste reversível quando ainda tinham saldo derivado.
- Produtos reais foram criados com `sku = código de barras`, `name = nome`, `initial_stock_qty = 0` e `is_active` conforme a planilha.
- O baseline de estoque entrou apenas por `movement_type = initial_stock`.
- Como a planilha não traz custo, nenhum `product_cost_snapshot` novo foi criado nesta carga.
- Linhas sem identificador mínimo suficiente foram separadas em pendência formal e não foram importadas.

## Consequências

- O estoque passa a refletir a planilha real sem quebrar a regra de derivação por movimentos.
- O custo operacional dos produtos novos permanece pendente até uma fonte confiável de custo ser importada.
- A base demo deixa de poluir a leitura operacional do estoque real.

## Próximos passos

- Revisar com a operação a semântica oficial da escala exportada em `Qtd. Atual Estoque`.
- Importar custo atual por produto quando a fonte confiável estiver disponível.
- Completar categorização e fornecedor preferencial sem inferência por chute.
