# ADR-003 — Configuração corrente inicial do SOI

## Status
Aprovado

## Contexto
Após a criação do schema inicial do SOI e a validação das tabelas, views e seeds mínimos, o sistema passou a exigir uma configuração corrente ativa em `soi.system_settings`.

Sem uma configuração ativa, o SOI não consegue sustentar corretamente:
- cálculo de preço mínimo;
- leitura de lead time;
- estoque de segurança;
- janela de inatividade de clientes;
- taxas por canal;
- parte da leitura operacional derivada.

## Decisão
Inserir uma configuração corrente inicial de bootstrap em `soi.system_settings`.

## Valores iniciais aprovados
- margem mínima desejada: 0.35
- prazo médio de reposição: 7 dias
- estoque de segurança: 5 dias
- cliente inativo: 45 dias
- taxa WhatsApp: 0.00
- taxa Instagram: 0.00
- taxa iFood: 0.18
- taxa Balcão: 0.00
- despesa fixa mensal estimada: 0.00
- custo médio de embalagem unitária: 0.00

## Natureza da decisão
Esses valores são de bootstrap operacional.
Eles não representam fechamento financeiro definitivo da Viníssimo.
Eles existem para habilitar o funcionamento coerente do MVP.

## Consequências
### Positivas
- views operacionais passam a ter configuração ativa;
- cálculo de preço mínimo fica habilitado;
- cálculo de estoque mínimo sugerido fica habilitado;
- status de cliente e parte dos alertas ficam sustentados.

### Negativas
- os parâmetros econômicos ainda poderão ser refinados depois da operação real;
- taxas e custos auxiliares precisarão ser calibrados com dados reais.

## Próximos passos
1. iniciar bootstrap do backend da API
2. conectar backend ao banco da Viníssimo
3. validar healthcheck, auth e módulo de parâmetros
4. depois subir frontend em bind local
