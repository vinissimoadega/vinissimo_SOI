# EXECUTION_PLAN

## Escopo
Plano fechado de execução com gates para elevar qualidade técnica sem alterar escopo funcional do SOI.

## Ordem Obrigatória
1. T1 — Congelar baseline e fonte canônica
2. T2 — Higiene de repositório
3. T3 — Auditoria de completude de módulos
4. T4 — Baseline técnico executável
5. T5 — Migração versionada
6. T6 — Base de testes
7. T7 — Testes de fluxos críticos
8. T8 — Revisão de queries e índices
9. T9 — Refatoração controlada de services longos
10. T10 — Gate final de qualidade

## Gates
- Gate A: T1-T4
- Gate B: T5-T7
- Gate C: T8-T10

## Definição de Pronto (resumo)
- T1: fonte canônica formalizada
- T2: artefatos indevidos removidos com backup
- T3: matriz de módulos concluída
- T4: build/start/health validados
- T5: migração reproduzível em ambiente limpo
- T6: harness de testes executável
- T7: regressão crítica aprovada
- T8: queries críticas com índice adequado
- T9: complexidade reduzida sem regressão
- T10: relatório final com riscos residuais
