# ADR-009 — Auth finalization

## Status
Aprovado

## Contexto
Após a estabilização do módulo `AUTH`, ainda restava a etapa final de operacionalização:
- criar o admin real da Viníssimo via script seguro
- validar autenticação com o admin real
- remover o usuário técnico temporário usado apenas na validação inicial

Essa etapa precisava ocorrer sem alterar outros módulos e sem inventar credenciais adicionais.

## Decisão
Foi concluído o fechamento final do `AUTH` com o fluxo abaixo:
1. criação do admin real via `bin/create-admin-user.sh`
2. validação de `POST /api/v1/auth/login`
3. validação de `GET /api/v1/auth/me`
4. validação de `POST /api/v1/auth/logout`
5. remoção de `auth-bootstrap-admin@vinissimo.local`
6. conferência final de `soi.users` e `soi.user_roles`

## Admin real criado
- nome: Manoel Calaça Junior
- email: vinissimoadega@gmail.com
- senha temporária: registrada apenas na execução operacional, não reproduzida nesta ADR

## Usuário técnico removido
O usuário temporário abaixo foi removido após a validação bem-sucedida do admin real:
- `auth-bootstrap-admin@vinissimo.local`

## Resultado final
Ao término desta etapa:
- restou apenas o admin real `vinissimoadega@gmail.com`
- o papel associado permaneceu `admin`
- o fluxo `login -> auth/me -> logout` foi validado com sucesso

## Consequências
### Positivas
- o `AUTH` fica encerrado com usuário administrativo real
- o usuário técnico temporário deixa de existir
- a base está pronta para servir de fundação ao próximo módulo, sem depender de credenciais artificiais

### Restrições mantidas
- nenhuma alteração foi feita fora do escopo do `AUTH`
- nenhuma porta pública nova foi aberta
- nenhuma mudança foi aplicada em proxy, firewall, iptables ou `/opt/axon/*`

## Próximos passos
1. tratar futuros módulos a partir desta base já finalizada
2. rotacionar a senha temporária do admin real em procedimento operacional apropriado
