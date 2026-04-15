# Viníssimo SOI Web

Bootstrap real do frontend do SOI da Viníssimo em **Next.js + Tailwind CSS**.

## O que já vem pronto

- layout autenticado com sidebar + topbar
- dashboard inicial alinhado ao wireframe funcional do SOI
- páginas-base para:
  - Produtos
  - Fornecedores
  - Clientes
  - Compras
  - Vendas
  - Estoque
  - Despesas
  - Alertas
  - Decisões
  - Configurações
- integração inicial com a API:
  - `GET /api/v1/health`
  - `GET /api/v1/settings/current`
- fallback visual quando a API ainda não estiver disponível

## Rodar localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

A aplicação sobe em:

- `http://127.0.0.1:3100`

## Variável principal

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4100/api/v1
```
