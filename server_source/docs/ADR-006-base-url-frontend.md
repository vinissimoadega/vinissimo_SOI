# ADR-006 — Correção da estratégia de base URL do frontend

## Status
Aprovado

## Contexto
Após o bootstrap do frontend do SOI, a interface renderizava corretamente, mas o dashboard entrava em fallback visual mesmo com a API respondendo no host.

O problema identificado foi de estratégia de endereçamento:
- `127.0.0.1:4100` funcionava no navegador via túnel SSH;
- mas não funcionava para chamadas server-side feitas dentro do container `web`.

Dentro do container do frontend, `127.0.0.1` referencia o próprio container, e não o container `api`.

## Decisão
Separar as URLs de integração do frontend em dois contextos:

- `API_INTERNAL_BASE_URL=http://api:4100/api/v1`
- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100/api/v1`

## Regra adotada
- chamadas server-side do Next.js usam `API_INTERNAL_BASE_URL`
- chamadas client-side / navegador usam `NEXT_PUBLIC_API_BASE_URL`

## Resultado
Após o ajuste:
- o container `web` passou a consumir a API pelo nome do serviço Docker `api`;
- o navegador continuou acessando a API local via túnel SSH;
- o dashboard passou a mostrar:
  - API conectada
  - margem mínima
  - lead time / segurança

## Consequências
### Positivas
- elimina o fallback causado por uso incorreto de `127.0.0.1` no runtime do container
- preserva o isolamento da stack da Viníssimo
- mantém compatibilidade com o túnel SSH na fase privada

### Negativas
- o frontend agora depende de duas URLs distintas até a futura publicação pública
- a estratégia deverá ser revisada quando houver domínio e proxy próprios

## Próximos passos
1. manter túnel SSH para validação privada
2. implementar auth
3. abrir endpoints reais de dashboard, produtos, clientes e estoque
4. depois revisar estratégia de URL quando houver publicação pública
