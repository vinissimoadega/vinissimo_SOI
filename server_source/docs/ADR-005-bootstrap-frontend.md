# ADR-005 — Bootstrap inicial do frontend do SOI

## Status
Aprovado

## Contexto
Após a validação do banco isolado, do schema do SOI, da configuração corrente inicial e do backend mínimo da API, o próximo passo correto foi subir o frontend do SOI da Viníssimo.

## Decisão
Inicializar o frontend do SOI em Next.js, isolado na stack da Viníssimo, com:

- bind local em 127.0.0.1:3100
- sem publicação pública
- sem alteração na stack da Axon
- comunicação com a API local em 127.0.0.1:4100

## Resultado
O frontend foi buildado e executado com sucesso no container `vinissimo-soi-web`, com bind local em `127.0.0.1:3100`.

A stack mínima passou a conter:
- Postgres isolado
- API NestJS isolada
- Frontend Next.js isolado

## Regras preservadas
- nenhuma alteração no proxy atual da Axon
- nenhuma exposição pública nova
- isolamento por compose, rede e bind local
- evolução controlada do SOI

## Consequências
### Positivas
- circuito UI -> API -> banco validado
- base pronta para evolução de auth e módulos de domínio
- ambiente privado de validação já funcional

### Negativas
- frontend ainda sem identidade visual final da Viníssimo
- frontend ainda sem autenticação
- módulos de negócio ainda não implementados além da leitura inicial

## Próximos passos
1. validar acesso via túnel SSH no navegador
2. ajustar branding inicial (logo, favicon, header)
3. implementar auth
4. abrir os módulos prioritários do domínio
