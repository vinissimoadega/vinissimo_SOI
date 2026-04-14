# Runbook de Go-Live Operacional Viníssimo

## Escopo deste runbook

Este runbook orienta os primeiros 7 dias de operação assistida do SOI da Viníssimo com base no sistema que já existe hoje em `/opt/vinissimo/soi`.

Ele cobre:

- uso diário do backoffice
- uso do dashboard real
- uso do cockpit operacional `/crm`
- rotina de cadastro e lançamento
- governança mínima para operação confiável

Ele não cobre:

- integração externa
- envio automático real
- automação de WhatsApp ou e-mail
- novo módulo
- reabertura de escopo de produto

## Bloco A — Finalidade e princípios

### Para que serve o SOI agora

O SOI da Viníssimo já serve como base operacional única para:

- produtos
- clientes
- compras
- vendas
- estoque
- dashboard executivo
- CRM operacional

Neste momento, o sistema deve ser usado para registrar a operação real, sustentar a decisão do dia e formar histórico confiável para atendimento, reposição e relacionamento.

### O que o SOI já cobre

- login autenticado e área protegida
- catálogo operacional de produtos
- cadastro e leitura de clientes
- compras com múltiplos itens e custo operacional
- vendas com múltiplos itens e margens por canal
- estoque derivado por movimentos
- dashboard executivo real v1
- cockpit operacional `/crm`
- memória comercial do cliente
- pós-venda, avaliação e reativação em modo operacional

### O que o SOI ainda não cobre

- disparo automático real de mensagens
- integrações externas
- histórico comercial antigo robusto
- CRM com massa histórica acumulada
- inteligência avançada de automação

### Princípios de uso da Viníssimo

- Curadoria antes de pressão.
- Ocasião antes de catálogo.
- Rapidez com presença.
- Premium sem esnobismo.
- Consistência acima de impulso.

Tradução operacional:

- não registrar dado pela metade quando for possível registrar bem
- não empurrar produto sem contexto
- não deixar venda sem canal, status ou valor
- não deixar cliente sem memória útil quando a conversa trouxe informação relevante
- não deixar exceção sem registro

## Bloco B — Estado atual do sistema

### Módulos e telas existentes hoje

Módulos ativos no backend:

- `auth`
- `dashboard`
- `crm`
- `products`
- `customers`
- `purchases`
- `sales`
- `inventory`
- `settings`
- `health`

Telas operacionais existentes hoje:

- `/dashboard`
- `/crm`
- `/products`
- `/products/new`
- `/products/[productId]`
- `/customers`
- `/customers/new`
- `/customers/[customerId]`
- `/purchases`
- `/purchases/new`
- `/purchases/[purchaseId]`
- `/sales`
- `/sales/new`
- `/sales/[saleId]`
- `/inventory`
- `/inventory/movements`
- `/settings`

### Fontes de verdade já confiáveis

Hoje o SOI já é fonte de verdade para:

- catálogo reconciliado
- custo operacional atual dos produtos reconciliados
- estoque atual derivado por movimentos
- compras lançadas no sistema
- vendas lançadas no sistema
- KPIs de estoque do dashboard
- pendências de base explicitadas no dashboard

### Dados que ainda podem aparecer vazios

A base real atual ainda tem pouca massa comercial histórica acumulada dentro do SOI. Por isso, alguns blocos podem aparecer vazios de forma legítima:

- vendas entregues
- clientes ativos
- fila operacional de CRM
- pós-venda pendente
- avaliações pendentes
- reativação pendente

Vazio consistente não é erro. É sinal de que a rotina real ainda está começando a ser registrada no sistema.

### Limitações atuais da base

- o dashboard executivo já é real, mas o bloco comercial ainda depende do uso contínuo
- o CRM operacional já existe, mas hoje a base tem `0` clientes ativos e `0` vendas entregues
- existem `3` pendências de base explicitadas no dashboard e fora da leitura reconciliada principal

## Bloco C — Pré-go-live (Dia 0)

Antes do primeiro dia assistido, fazer este checklist.

### Checklist técnico

1. Confirmar que o login administrativo funciona.
2. Confirmar que a stack está saudável.
3. Confirmar que `web` e `api` estão bindados apenas em `127.0.0.1:3100` e `127.0.0.1:4100`.
4. Confirmar que o dashboard abre.
5. Confirmar que `/crm` abre.

### Checklist de base

1. Confirmar que o catálogo real está visível em `/products`.
2. Confirmar que os produtos reconciliados têm custo atual.
3. Confirmar que o dashboard continua mostrando as `3` pendências de base explicitamente.
4. Conferir rapidamente alguns SKUs reais mais sensíveis.
5. Conferir se a equipe sabe quais lançamentos entram por qual tela.

### Checklist de uso pela equipe

A equipe deve saber, sem dúvida, onde lançar:

- cliente -> `/customers`
- venda -> `/sales`
- compra -> `/purchases`
- ajuste manual -> `/inventory/movements`
- tarefa operacional -> `/crm` ou tela individual do cliente

## Bloco D — Rotina diária operacional

### 1. Abertura do dia

Abrir o dia nesta ordem:

1. Acessar `/dashboard`.
2. Ler o resumo executivo do momento.
3. Revisar o bloco de estoque:
   - ruptura
   - repor agora
   - atenção
4. Revisar as pendências de base ainda abertas.
5. Acessar `/crm`.
6. Ver a fila do dia.
7. Ver clientes que exigem ação.
8. Ver pós-venda, avaliações e reativação pendentes.
9. Revisar qualquer promessa em aberto do dia anterior.

### 2. Operação ao longo do dia

#### Cliente novo

Usar `/customers/new` quando o cliente ainda não existir no sistema.

Registrar pelo menos:

- nome
- telefone ou e-mail quando houver
- canal principal quando for claro

Sempre que a conversa trouxer informação útil, registrar também:

- preferência
- objeção
- ocasião
- contexto relevante

#### Cliente existente

Usar `/customers/[customerId]` para:

- corrigir cadastro
- enriquecer memória comercial
- abrir tarefa operacional
- registrar ação feita

#### Registrar venda

Usar `/sales/new`.

Obrigatório registrar:

- canal
- status
- itens
- valores
- cliente, quando identificado com segurança

Evitar lançar venda “genérica” quando houver cliente identificável.

#### Registrar compra

Usar `/purchases/new`.

Obrigatório registrar:

- fornecedor, quando aplicável
- itens
- custo

#### Ajuste manual de estoque

Usar `/inventory/movements` apenas quando realmente necessário.

Só fazer ajuste manual quando:

- houve divergência física confirmada
- houve erro operacional claro
- houve acerto de inventário

Todo ajuste precisa de motivo claro. Ajuste manual não substitui compra nem venda.

#### Registrar memória comercial

Sempre que houver contexto útil, registrar na tela do cliente:

- ocasião de consumo
- estilo preferido
- objeção recorrente
- faixa de valor
- informação que ajude na próxima recomendação

#### Abrir tarefa operacional no CRM

Usar `/crm` ou a tela do cliente para criar tarefa quando houver:

- follow-up pendente
- pós-venda a fazer
- pedido de avaliação
- reativação
- ação manual combinada

Registrar sempre:

- motivo
- status
- prioridade
- data/hora prevista quando aplicável

#### Pós-venda

Abrir ou atualizar tarefa de pós-venda quando:

- houve entrega que merece confirmação
- o pedido é sensível
- a experiência precisa ser validada

Marcar como:

- pendente
- feito
- sem retorno
- dispensado

#### Solicitação de avaliação

Usar quando o pedido entregue já permite pedir retorno público ou nota.

Marcar como:

- pendente
- feito
- ignorado

#### Reativação ou tentativa de retorno

Usar quando o cliente estiver sem compra dentro da janela operacional aprovada e fizer sentido comercial retomar contato.

Registrar:

- tentativa
- resultado
- próxima ação, se houver

### 3. Fechamento do dia

No fim do dia, revisar:

1. Se toda venda do dia entrou no sistema.
2. Se todo cliente novo entrou no sistema.
3. Se houve pós-venda que ficou pendente.
4. Se houve pedido de avaliação que ficou pendente.
5. Se há tarefa vencida no `/crm`.
6. Se houve incidente, divergência ou exceção operacional.

Encerrar o dia com a regra:

- nada prometido fica só na memória
- tudo que depende de ação futura precisa estar visível no sistema

## Bloco E — Playbook de uso por tela

### Dashboard

Para que serve:

- leitura executiva e operacional rápida

Quando usar:

- abertura do dia
- fechamento do dia
- revisão semanal

Obrigatório observar:

- receita
- margem
- estoque crítico
- pendências da base

Erro comum a evitar:

- usar o dashboard como substituto do lançamento operacional

### Produtos

Para que serve:

- consultar catálogo real reconciliado

Quando usar:

- validar SKU
- conferir nome, preço e custo atual

Obrigatório preencher quando houver ajuste de cadastro:

- dados de identificação do produto

Erro comum a evitar:

- cadastrar produto duplicado quando o SKU já existe

### Clientes

Para que serve:

- cadastro e manutenção da base de relacionamento

Quando usar:

- novo cliente
- enriquecimento da memória comercial

Obrigatório preencher:

- nome
- telefone ou e-mail quando houver

Erro comum a evitar:

- criar cliente novo sem procurar antes por telefone, e-mail ou nome

### Compras

Para que serve:

- registrar entrada operacional e custo

Quando usar:

- toda compra real que afeta custo e reposição

Obrigatório preencher:

- itens
- custo
- fornecedor quando aplicável

Erro comum a evitar:

- usar compra para corrigir divergência que deveria ser ajuste manual

### Vendas

Para que serve:

- registrar pedido, canal, valores e status

Quando usar:

- toda venda real operada pelo time

Obrigatório preencher:

- canal
- status
- valor
- itens
- cliente quando identificado

Erro comum a evitar:

- deixar pedido sem cliente identificado quando havia dado suficiente

### Estoque

Para que serve:

- ler saldo derivado, criticidade e capital empatado

Quando usar:

- abertura do dia
- reposição
- conferência operacional

Obrigatório observar:

- ruptura
- repor agora
- atenção
- preço mínimo por canal

Erro comum a evitar:

- tentar “ajustar saldo” fora do fluxo correto

### /crm

Para que serve:

- cockpit operacional do dia

Quando usar:

- início do dia
- ao longo do dia para registrar tarefas e retorno
- fechamento do dia

Obrigatório preencher nas tarefas:

- motivo
- status
- prioridade

Erro comum a evitar:

- deixar uma promessa verbal sem criar tarefa

### Tela individual do cliente

Para que serve:

- consolidar memória comercial e operar ações daquele cliente

Quando usar:

- após contato relevante
- após venda relevante
- em pós-venda
- em reativação

Obrigatório registrar quando houver:

- preferência
- objeção
- ocasião
- contexto útil

Erro comum a evitar:

- usar notas soltas sem transformar informação em memória útil

## Bloco F — Regras de preenchimento

Campos mínimos de operação real:

### Cliente

- nome
- telefone ou e-mail quando houver

### Venda

- canal
- status
- valor
- itens
- cliente quando identificado com segurança

### Compra

- itens
- custo
- fornecedor quando aplicável

### CRM

- motivo
- status
- prioridade

### Memória comercial

Registrar pelo menos um destes quando a conversa trouxer contexto:

- ocasião
- preferência
- objeção
- contexto útil

## Bloco G — Pós-venda e recorrência

### Quando abrir pós-venda

Abrir quando:

- o pedido foi entregue
- houve recomendação consultiva
- vale validar a experiência
- existe risco de silêncio depois da venda

### Quando pedir avaliação

Pedir avaliação quando:

- o pedido foi entregue
- a experiência foi boa ou promissora
- o cliente já recebeu e teve tempo mínimo para experimentar

### Quando marcar reativação

Marcar reativação quando:

- o cliente já teve histórico
- saiu da janela de atividade
- faz sentido comercial retomar contato

### Como distinguir os estados

- cliente sem resposta: houve ação e ainda falta retorno
- cliente recorrente: já voltou a comprar em base suficiente
- cliente inativo: teve histórico, mas passou da janela operacional sem nova compra

### Como usar a memória comercial

Antes de sugerir um novo rótulo, olhar:

- o que o cliente gostou
- o que recusou
- em que ocasião compra
- qual faixa de preço aceita

Memória comercial boa reduz improviso e melhora a recomendação.

## Bloco H — Exceções e governança

### Item sem cadastro

Corrigir na hora:

- verificar se o SKU já existe
- se não existir e houver informação suficiente, cadastrar corretamente

Registrar:

- onde a operação travou
- o que faltava

Escalar:

- quando não houver identificação mínima segura

### Venda feita fora do fluxo

Corrigir na hora:

- lançar a venda no sistema no mesmo dia

Registrar:

- motivo de ter ficado fora do fluxo

Escalar:

- se estiver virando rotina

### Cliente sem identificação suficiente

Corrigir na hora:

- registrar o mínimo seguro

Registrar:

- que ficou incompleto

Escalar:

- se a equipe estiver deixando de pedir telefone ou e-mail sempre

### Pedido cancelado

Corrigir na hora:

- ajustar o status correto do pedido

Registrar:

- motivo do cancelamento em nota quando relevante

Escalar:

- se houver padrão de cancelamento recorrente

### Divergência entre operação real e sistema

Corrigir na hora:

- localizar o ponto exato da divergência

Registrar:

- incidente do dia
- o que foi corrigido

Escalar:

- quando a divergência afetar estoque, custo ou pedido já entregue

### SKU pendente

Corrigir na hora:

- não lançar por aproximação

Registrar:

- SKU, nome e contexto

Escalar:

- para saneamento de cadastro

### Erro de lançamento

Corrigir na hora:

- ajustar no módulo correto

Registrar:

- causa do erro se ele puder se repetir

Escalar:

- se o erro indicar falha de processo, não só erro humano isolado

## Bloco I — Ritual de 7 dias de go-live assistido

### Dia 1

- Objetivo: garantir disciplina de lançamento
- Foco principal: toda venda e todo cliente entra no sistema
- Observar: campos obrigatórios faltando
- Corrigir: cadastros incompletos e status de pedido
- Medir: vendas lançadas vs operação real

### Dia 2

- Objetivo: estabilizar cadastro de clientes
- Foco principal: evitar cliente duplicado
- Observar: busca antes de cadastrar
- Corrigir: padrão de nome, telefone e e-mail
- Medir: clientes novos com contato válido

### Dia 3

- Objetivo: consolidar uso do estoque
- Foco principal: ruptura, repor agora e ajustes corretos
- Observar: uso indevido de ajuste manual
- Corrigir: divergências de fluxo
- Medir: itens críticos sem ação

### Dia 4

- Objetivo: consolidar compras e custos
- Foco principal: toda compra relevante registrada corretamente
- Observar: custo, itens e fornecedor
- Corrigir: compras incompletas
- Medir: compras lançadas no dia

### Dia 5

- Objetivo: ativar rotina real de CRM
- Foco principal: usar `/crm` como fila do dia
- Observar: promessas sem tarefa
- Corrigir: follow-ups e ações manuais sem registro
- Medir: tarefas abertas e concluídas

### Dia 6

- Objetivo: começar o pós-venda com disciplina
- Foco principal: registrar retorno, avaliação e memória útil
- Observar: tarefas vencidas
- Corrigir: ausência de status e nota
- Medir: pós-vendas feitos e avaliações pedidas

### Dia 7

- Objetivo: fechar a primeira semana com governança
- Foco principal: revisar processo, não só resultado
- Observar: onde o time ainda improvisa
- Corrigir: atalhos errados
- Medir: incidentes operacionais e pendências abertas

## Bloco J — Ritual semanal de revisão

Uma vez por semana, revisar:

1. Dashboard executivo:
   - receita
   - margem
   - estoque crítico
   - pendências de base
2. Fila de CRM:
   - tarefas vencidas
   - tarefas sem dono
   - pós-vendas atrasados
3. Clientes sem retorno.
4. Estoque crítico sem ação.
5. Vendas por canal.
6. Aprendizados do atendimento.
7. Correções de processo da semana seguinte.

## Bloco K — KPIs operacionais do go-live

Na primeira semana, acompanhar só o essencial:

- clientes cadastrados
- vendas lançadas
- compras lançadas
- tarefas abertas no CRM
- pós-vendas feitos
- avaliações pedidas
- reativações abertas
- incidentes operacionais
- itens críticos sem ação

## Bloco L — Checklist final

### Checklist diário curto

- dashboard lido
- estoque crítico revisado
- `/crm` revisado
- vendas do dia lançadas
- clientes novos lançados
- promessas viraram tarefa
- exceções registradas

### Checklist semanal curto

- dashboard revisado
- CRM revisado
- itens críticos tratados
- cadastro auditado
- incidentes analisados
- aprendizados convertidos em rotina

### Erros proibidos

- venda fora do sistema
- cliente identificado sem cadastro
- ajuste manual sem motivo
- tarefa combinada e não registrada
- dado inventado para “fechar” operação

### Definição de dia bem operado

Um dia bem operado é um dia em que:

- o que aconteceu entrou no sistema
- o que ficou pendente ficou visível
- o que precisa de ação futura virou tarefa
- o time consegue abrir o sistema no dia seguinte e entender o contexto sem depender da memória de ninguém
