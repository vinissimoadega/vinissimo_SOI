# ADR-020 — Real Base Sanitization

## Contexto
A Viníssimo concluiu a carga real de estoque e uma carga complementar parcial de custo. Antes do Dashboard real, a base precisava ser saneada para remover contaminação de registros demo e explicitar a lacuna remanescente de custo nos produtos reais.

## Diagnóstico
- produtos reais: `117`
- produtos reais com snapshot de custo: `47`
- produtos reais sem snapshot de custo: `70`
- produtos reais com saldo e sem custo: `35`
- linha pendente manual fora da base: `Mataojo Merlot`, sem SKU

## Decisão
O saneamento final foi dividido em dois blocos:
- neutralização completa dos registros demo que contaminavam métricas
- formalização da pendência manual sem SKU como exclusão operacional da base e do futuro dashboard até saneamento humano

## Tratamento Aplicado
- clientes demo: excluídos com preferências, interações e métricas associadas
- compras demo: excluídas com itens associados
- vendas demo: excluídas com itens associados
- movimentos demo e ajustes demo: excluídos
- produtos demo: excluídos com snapshots de custo e preços por canal associados
- categoria demo: excluída
- fornecedor demo: excluído
- pendência `Mataojo Merlot`: mantida fora da base operacional por falta de SKU, sem chute

## Consequências
- a base deixa de carregar ruído demo nos módulos operacionais e no futuro dashboard
- a lacuna real de custo permanece explícita para `70` produtos, sendo `35` deles com saldo atual
- qualquer KPI de margem, capital empatado ou preço mínimo continuará parcialmente incompleto até nova complementação de custo para esses itens

## Próximos Passos
1. completar a cobertura de custo dos `35` produtos reais com saldo e sem snapshot
2. tratar manualmente a linha sem SKU antes de nova carga
3. somente então fechar o escopo do Dashboard real como plenamente confiável para métricas de custo e margem
