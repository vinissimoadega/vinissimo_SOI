# ADR-001 — Bootstrap isolado da stack Viníssimo no 209

## Status
Aprovado

## Contexto
O servidor 209.126.77.253 já hospeda componentes ativos da Axon.
Existem serviços e proxy vivos no host/ambiente Docker.
Portanto, a Viníssimo não deve nascer acoplada à stack da Axon.

## Decisão
A stack da Viníssimo será inicializada em:

- /opt/vinissimo/soi

Com as seguintes regras:

- compose próprio
- rede Docker própria
- volumes próprios
- sem network_mode: host
- sem publicação de porta pública nesta fase
- sem alteração do Caddy/proxy atual nesta fase
- Postgres acessível apenas internamente pela rede Docker da Viníssimo

## Consequências
### Positivas
- reduz risco de interferência na Axon
- facilita documentação e troubleshooting
- permite validação privada do MVP

### Negativas
- publicação pública fica para uma fase posterior
- haverá mais uma stack isolada para administrar

## Próximos passos
1. Subir Postgres isolado
2. Validar compose e rede
3. Aplicar DDL do SOI
4. Depois subir API e frontend em bind local
5. Só então decidir publicação por domínio/proxy
