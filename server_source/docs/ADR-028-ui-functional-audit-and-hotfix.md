# ADR-028 - Auditoria funcional da UI e hotfix de controles

Data: 2026-04-09

## Contexto

O SOI da Vinissimo ja estava publicado em HTTPS, com login publico corrigido e modulos operacionais disponiveis. A operacao reportou que havia controles com aparencia clicavel sem executar acao.

Esta rodada ficou limitada a auditoria funcional da interface autenticada e hotfix dos controles quebrados. Nao houve criacao de modulo, alteracao de schema, integracao externa, alteracao de proxy ou mudanca de regra de negocio.

## Metodologia

- Auditoria por inventario estatico das rotas publicadas em `apps/web/app`.
- Inventario dos controles renderizados por pagina.
- Navegacao autenticada em navegador headless contra `https://app.vinissimoadega.com.br`.
- Login real pelo formulario publico com usuario temporario de auditoria.
- Validacao por `curl` autenticado com cookie jar.
- Revisao de logs de web e api.
- Build de producao do frontend e restart do container web.

## Paginas auditadas

- `/login`
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
- `/sales`
- `/sales/new`
- `/sales/[saleId]`
- `/sales/whatsapp`
- `/inventory`
- `/inventory/movements`
- `/expenses`
- `/settings`

Tambem foram inventariadas as superficies auxiliares publicadas: `/alerts`, `/decisions`, `/suppliers` e `/inventory/products/[productId]/min-prices`.

## Achados

### P1

Nenhum bloqueio P1 novo foi confirmado na auditoria desta rodada. Login, dashboard, CRM, produtos, clientes, vendas, estoque, despesas e venda rapida seguiram acessiveis apos o hotfix.

### P2

1. Busca global do topo era um input visual sem destino, sem `name` e sem submit. O controle foi convertido em formulario GET real para `/products`, preservando busca por produto/SKU/codigo.
2. Tela de configuracoes mostrava campos editaveis e botao "Salvar alteracoes", mas nao havia formulario publicado para persistir alteracoes. O botao foi removido e a tela foi explicitada como leitura de parametros nesta versao.

### P3

1. Controle "Mes atual" no topo era um `button` sem acao. Foi convertido em indicador nao interativo.
2. O template generico de paginas renderizava CTA e filtros falsamente interativos. O CTA agora so aparece quando configurado; caso contrario, a pagina exibe uma nota de leitura.
3. As paginas auxiliares de alertas, decisoes e fornecedores usavam o CTA generico sem acao. O CTA foi removido dessas telas.

## Correcoes aplicadas

- `apps/web/components/topbar.tsx`: busca do topo agora envia para `/products?is_active=true&search=...`; indicador de mes deixou de ser botao.
- `apps/web/components/page-template.tsx`: CTA opcional com link real quando configurado; sem filtros falsos por padrao.
- `apps/web/app/(app)/settings/page.tsx`: removido falso botao de salvar; adicionada mensagem operacional de leitura.
- `apps/web/app/(app)/alerts/page.tsx`: removido falso botao de novo alerta.
- `apps/web/app/(app)/decisions/page.tsx`: removido falso botao de nova decisao.
- `apps/web/app/(app)/suppliers/page.tsx`: removido falso botao de novo fornecedor.

## Validacoes registradas

- Login real no dominio publico redirecionou para `/dashboard`.
- Busca do topo redirecionou para `/products?is_active=true&search=vin`.
- API de produtos retornou 3 resultados para busca `ALECRIM`.
- API de estoque retornou 3 resultados para busca `ALECRIM`.
- `/settings` nao renderiza mais botao de salvar no cabecalho.
- `/alerts` nao renderiza mais CTA primario falso.
- `/sales/whatsapp` segue respondendo 200.
- `/api/v1/health` segue respondendo 200.
- Web e API seguem em loopback nos binds 3100 e 4100.

## Pendencias remanescentes

- `/settings` permanece como superficie de leitura. Edicao real de parametros deve ser tratada em sprint proprio, conectada ao endpoint de settings.
- `/alerts`, `/decisions` e `/suppliers` ainda sao superficies auxiliares/placeholder; agora estao sem CTA falso.
- A base atual nao tinha compra real para auditoria de detalhe `/purchases/[id]` sem criar dado operacional. A tela nova/lista e o controller foram inspecionados; detalhe deve ser revalidado quando existir compra real.

## Consequencias

A interface autenticada passa a ter menos "botao morto": controles publicados agora navegam/submetem ou deixam claro que a tela e somente leitura. A busca superior fica reduzida a busca operacional de produto/SKU/codigo para evitar promessa falsa de busca universal.

## Rollback

Restaurar o backup da rodada:

```sh
cd /opt/vinissimo/soi
tar -xzf backups/ui_functional_audit_20260409_012000/ui_functional_audit_source_files_before.tgz
rm -rf apps/web/.next
tar -xzf backups/ui_functional_audit_20260409_012000/web_next_before.tgz -C apps/web
docker compose restart web
```
