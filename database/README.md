# Configuração do banco do site

## Instalação nova

Execute os arquivos na ordem abaixo pelo SQL Editor do Supabase:

1. `schema.sql` — usuários, administradores, cupons, pedidos, configurações e funções transacionais de cupom/pagamento.
2. `core-tables.sql` — licenças, logs, IPs, suporte, chat, versões, downloads e bucket de avatares.
3. `add-email-confirm.sql` — confirmação de e-mail.
4. `hwid-v2.sql` — nonces e campos adicionais do protocolo de ativação.
5. `ticket-chat-notifications.sql` — mensagens e notificações de tickets.
6. `add-avatar-bot-image.sql` — campos de avatar e do bot (compatível com as colunas já criadas).
7. `refund-requests.sql` — solicitações de reembolso, revisão e sincronização de reversões.

`schema.sql` já contém as funções atômicas atuais de cupom e confirmação/reversão
de pagamento. Os arquivos `coupon-usage-reservations.sql` e
`payment-reversal-and-fulfillment.sql` são migrações históricas; não são necessários
na instalação limpa. `create-admin.sql` é opcional: substitua o hash demonstrativo
por um hash bcrypt real antes de executar.

## Atualização de um banco existente

Não execute uma sequência de bootstrap às cegas em produção. Faça backup,
confirme quais migrações já foram aplicadas e aplique apenas as que faltam.
`CREATE TABLE IF NOT EXISTS` não corrige automaticamente uma tabela preexistente
com colunas ou constraints divergentes.

## Acesso

As APIs do site acessam o banco pelo servidor usando a chave `service_role`.
RLS fica habilitado e as tabelas operacionais não concedem acesso direto a
`anon` ou `authenticated`. Nunca use a chave `service_role` no navegador nem a
publique em documentação ou commits.

## Verificação recomendada em staging

Antes de depender desta sequência para recuperar o banco, execute-a em um projeto
Supabase de staging vazio e verifique:

- se todos os arquivos terminam sem erro;
- se as tabelas e funções existem e as funções sensíveis só são executáveis por
  `service_role`;
- se `anon` e `authenticated` não conseguem ler ou alterar dados privados;
- se uma compra, licença, conversa de suporte e solicitação/reversão de
  reembolso funcionam em ambiente de teste.
