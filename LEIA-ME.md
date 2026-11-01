# SumblerControl — Documentação Completa do Site
> Relatório técnico completo de como o site foi desenvolvido do zero.
> Use este documento para ensinar como criar um sistema do mesmo nível.

---

## Visão Geral do Projeto

O SumblerControl é um **site de vendas de software** com sistema completo de:
- Cadastro e autenticação de usuários
- Pagamento automático via PIX com QR Code
- Entrega automática do produto após pagamento
- Área do usuário com histórico de compras e licenças
- Painel administrativo completo

---

## Linguagens e Tecnologias Utilizadas

### Frontend (o que o usuário vê no browser)
- **React** — biblioteca JavaScript para construir interfaces
- **Next.js 16** (App Router) — framework que organiza o React com roteamento automático, SSR (Server Side Rendering) e rotas de API
- **TypeScript** — JavaScript com tipagem estática (evita erros em tempo de desenvolvimento)
- **CSS inline via style props** — estilos aplicados diretamente nos componentes React (sem arquivo CSS separado para componentes)
- **Tailwind CSS** — utilitário de CSS instalado mas usado minimamente

### Backend (o que roda no servidor)
- **Next.js API Routes** — o mesmo projeto cria APIs automaticamente. Cada arquivo dentro de `app/api/` vira um endpoint HTTP
- **Node.js** — ambiente de execução do JavaScript no servidor (Next.js usa por baixo)
- **bcryptjs** — criptografia de senhas (hash irreversível)
- **jsonwebtoken (JWT)** — geração e verificação de tokens de autenticação
- **nodemailer** — envio de e-mails via SMTP
- **mercadopago** — SDK oficial do Mercado Pago para gerar QR Code PIX

---

## Serviços Externos Utilizados

### 1. GitHub
**O que é:** Plataforma de hospedagem de código com controle de versão Git.

**Para que serve no projeto:**
- Guarda todo o código-fonte do site
- Cada `git push` envia o código atualizado
- O Vercel monitora o GitHub e faz deploy automático quando detecta mudança

**Repositório:** `github.com/fiiregod30-cell/sumblercontrol-app`

---

### 2. Vercel
**O que é:** Plataforma de hospedagem especializada em Next.js.

**Para que serve no projeto:**
- Hospeda o site gratuitamente (plano Hobby)
- Faz o **build** (compilação) do Next.js automaticamente a cada push no GitHub
- Disponibiliza o site na URL: `sumblercontrol-app.vercel.app`
- Executa as **API Routes** como "Serverless Functions" (funções que rodam só quando chamadas)
- Gerencia variáveis de ambiente (segredos como tokens e senhas de API)
- HTTPS automático via Let's Encrypt

**Fluxo de deploy:**
```
Você edita o código → git push → GitHub recebe → Vercel detecta → build automático → site atualizado em ~30 segundos
```

---

### 3. Supabase
**O que é:** Banco de dados PostgreSQL na nuvem com API REST automática.

**Para que serve no projeto:**
- **Banco de dados** — guarda todos os dados: usuários, pedidos, cupons, licenças, logs de IP
- **Autenticação** — usamos o Supabase como banco, mas a autenticação foi feita manualmente com JWT (não usamos o Auth do Supabase)
- **Row Level Security (RLS)** — camada de segurança que impede acesso direto pelo frontend; só o backend com `service_role_key` tem acesso total

**URL do projeto:** `https://awtkdhvuimanbqgtlilq.supabase.co`

**Tabelas criadas:**
| Tabela | O que guarda |
|---|---|
| `usuarios` | Dados de cadastro (nome, email, senha hash, username) |
| `admins` | Credenciais do administrador |
| `pedidos` | Cada compra realizada (valor, status, QR Code PIX) |
| `cupons` | Cupons de desconto configurados pelo admin |
| `licencas` | Licenças de acesso ao software (key ou usuário+senha) |
| `email_tokens` | Tokens de confirmação de e-mail (expiram em 24h) |
| `licenca_logs` | Log de cada validação de licença (IP, HWID, resultado) |
| `ip_registros` | Registro de IPs por usuário (detecção de fraude) |
| `ip_bloqueados` | IPs banidos pelo admin |
| `config_site` | Configurações do site (preços, link de download, imagem) |

---

### 4. Mercado Pago
**O que é:** Gateway de pagamento brasileiro com suporte a PIX.

**Para que serve no projeto:**
- Gera QR Codes PIX dinâmicos com valor específico
- Cada QR Code expira em 30 minutos
- Envia um **webhook** (chamada HTTP automática) para o site quando o pagamento é confirmado

**Taxa:** 0.99% por transação PIX. Sem mensalidade.

**Fluxo do pagamento:**
```
1. Usuário clica "Gerar QR Code PIX"
2. Site chama a API do Mercado Pago com o valor
3. Mercado Pago retorna o QR Code em base64
4. Usuário escaneia e paga
5. Mercado Pago chama o webhook do site: POST /api/webhook
6. Site confirma o pagamento diretamente na API do MP
7. Pedido marcado como "pago" no banco
8. E-mail com download enviado automaticamente
```

---

### 5. Gmail SMTP + Nodemailer
**O que é:** Envio de e-mails usando a conta Gmail com "Senha de App".

**Para que serve no projeto:**
- Envia e-mail de confirmação de cadastro
- Envia e-mail com key de licença após compra
- Envia e-mail de download após pagamento confirmado
- Envia e-mail quando admin reseta o HWID de um usuário

**Observação:** E-mails podem cair em spam sem domínio verificado. Para produção, recomenda-se usar Brevo (300 e-mails/dia grátis) ou Resend com domínio próprio.

---

## Estrutura do Projeto

```
site-next/
├── app/                          ← Páginas e APIs (Next.js App Router)
│   ├── page.tsx                  ← Landing page pública
│   ├── layout.tsx                ← Layout global (HTML, fonts)
│   ├── globals.css               ← Estilos globais
│   ├── registro/page.tsx         ← Página de cadastro
│   ├── login/page.tsx            ← Página de login
│   ├── confirmar-email/page.tsx  ← Confirmação de e-mail via token
│   ├── checkout/page.tsx         ← Página de compra + QR Code PIX
│   ├── obrigado/page.tsx         ← Pós-pagamento + escolha de licença
│   ├── minha-conta/page.tsx      ← Área do usuário
│   ├── minhas-compras/page.tsx   ← Histórico de compras pagas
│   ├── admin/page.tsx            ← Login do administrador
│   ├── admin/dashboard/page.tsx  ← Painel admin completo
│   └── api/                      ← Backend (API Routes)
│       ├── auth/registro/        ← POST: criar conta
│       ├── auth/login/           ← POST: login usuário
│       ├── auth/logout/          ← POST: logout
│       ├── auth/me/              ← GET: dados do usuário logado
│       ├── auth/confirmar-email/ ← GET: validar token de confirmação
│       ├── auth/reenviar-confirmacao/ ← POST: reenviar e-mail
│       ├── admin/login/          ← POST: login admin
│       ├── admin/dados/          ← GET: stats/cupons/usuários/vendas
│       ├── admin/cupons/         ← POST/PATCH: gerenciar cupons
│       ├── admin/config/         ← GET/PATCH: configurações do site
│       ├── admin/licencas/       ← CRUD de licenças
│       ├── admin/ips/            ← Monitoramento de IPs
│       ├── cupom/validar/        ← POST: validar cupom em tempo real
│       ├── pagamento/criar/      ← POST: gerar QR Code PIX
│       ├── pagamento/status/     ← GET: polling do status do pagamento
│       ├── webhook/              ← POST: confirmação do Mercado Pago
│       ├── licenca/validar/      ← POST: validação de licença (chamado pelo .exe)
│       ├── licenca/escolher-tipo/← POST: definir key ou usuário+senha
│       ├── minha-licenca/        ← GET: dados da licença do usuário
│       ├── minha-conta/          ← GET: perfil + pedidos
│       └── config-publica/       ← GET: preços públicos (sem auth)
├── components/
│   └── NavBar.tsx                ← Barra de navegação com estado de login
└── lib/
    ├── supabase.ts               ← Clientes Supabase (público e admin)
    ├── auth.ts                   ← JWT, bcrypt, validações
    ├── email.ts                  ← Funções de envio de e-mail
    └── mercadopago.ts            ← Integração com API do MP
```

---

## Como as 3 Peças se Conectam

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUXO COMPLETO                               │
│                                                                     │
│  VOCÊ (dev)                                                         │
│    │ edita código                                                   │
│    ↓ git push                                                       │
│  GITHUB (guarda o código)                                           │
│    │ notifica mudança                                               │
│    ↓                                                                │
│  VERCEL (hospeda e executa)                                         │
│    │ build Next.js → disponibiliza na URL                          │
│    │ Serverless Functions rodam quando chamadas                     │
│    ↓                                                                │
│  SUPABASE (banco de dados)                                          │
│    │ Vercel consulta/escreve dados                                  │
│    │ Nunca exposto diretamente ao browser                           │
│    ↓                                                                │
│  MERCADO PAGO (pagamentos)                                          │
│    │ Vercel chama API do MP para gerar PIX                         │
│    │ MP chama Vercel (webhook) quando pagamento confirmado         │
│    ↓                                                                │
│  GMAIL SMTP (e-mails)                                               │
│    │ Vercel envia e-mails via nodemailer                           │
│    ↓ chega ao usuário                                               │
│  USUÁRIO FINAL (browser)                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Sistema de Autenticação — Como Funciona

### Cadastro
1. Usuário preenche formulário com nome, sobrenome, username, telefone, e-mail e senha
2. Backend valida os dados
3. Senha é transformada em hash com bcrypt (impossível reverter)
4. Conta criada com `email_confirmado = false`
5. Token único de 64 chars gerado e salvo no banco (expira em 24h)
6. E-mail enviado com link contendo o token
7. Usuário clica no link → token validado → `email_confirmado = true`

### Login
1. Usuário digita e-mail/username + senha
2. Backend busca o usuário no banco
3. Compara a senha com o hash usando bcrypt
4. Se correto → gera um JWT (token de sessão) válido por 7 dias
5. JWT salvo em cookie `httpOnly` (JavaScript do browser não consegue ler — mais seguro)
6. A cada request autenticada, o backend lê e verifica o cookie

### JWT (JSON Web Token)
- É como um "crachá digital" — contém: ID do usuário, e-mail, role (user/admin), data de expiração
- Assinado com uma chave secreta (`ADMIN_SECRET_KEY`) — impossível forjar sem a chave
- Armazenado em cookie `httpOnly; Secure; SameSite=Lax`

---

## Sistema de Pagamento — Como Funciona

### Geração do QR Code
1. Usuário acessa `/checkout?plano=mensal` (ou semestral/anual)
2. Frontend busca o preço atual do banco via `/api/config-publica`
3. Usuário pode aplicar um cupom de desconto
4. Ao clicar "Gerar QR Code PIX":
   - Backend cria um registro "pedido" no banco com status "pendente"
   - Chama a API do Mercado Pago com o valor final, nome do usuário e ID do pedido
   - MP retorna: `qr_code` (string para copiar e colar) e `qr_code_base64` (imagem PNG)
   - Frontend exibe o QR Code com timer de 30 minutos
   - Polling a cada 5 segundos verificando se foi pago

### Confirmação via Webhook
1. Usuário paga via app do banco
2. Mercado Pago envia POST para `https://sumblercontrol-app.vercel.app/api/webhook`
3. Backend consulta o status do pagamento diretamente na API do MP (segurança dupla)
4. Se aprovado:
   - Pedido marcado como "pago" no banco
   - Cupom incrementado se foi usado
   - Licença criada (nova) ou renovada (se usuário já tinha)
   - E-mail de confirmação enviado com link de download
5. Frontend detecta o pagamento via polling → redireciona para `/obrigado`

---

## Sistema de Licenças — Como Funciona

### Tipos de licença
- **Key**: chave no formato `SC-XXXX-XXXX-XXXX-XXXX` gerada pelo sistema
- **Usuário e Senha**: usa as mesmas credenciais do site

### HWID (Hardware ID)
- Na primeira vez que o usuário abre o software e faz login, o .exe gera um ID único do PC (baseado em: serial do disco C, CPU ID, MachineGUID do Windows)
- Esse ID é enviado junto com as credenciais para a API `/api/licenca/validar`
- Backend salva o HWID na licença
- Na próxima abertura: compara o HWID enviado com o salvo
- Se diferente → acesso negado ("licença registrada em outro PC")
- Só o admin pode resetar o HWID pelo painel

### Validação pelo .exe
```
.exe abre
  → gera HWID do PC
  → faz POST para /api/licenca/validar com {tipo, key/login, senha, hwid}
  → API verifica: licença existe? ativa? não expirou? HWID correto?
  → retorna { valido: true/false, nome, expira, diasRestantes }
  → se válido: app abre normalmente
  → se inválido: mostra mensagem de erro e não abre
  → sem internet: não abre (sem cache offline)
```

---

## Variáveis de Ambiente Necessárias

Configuradas no Vercel (Settings → Environment Variables):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Mercado Pago
MP_PUBLIC_KEY=APP_USR-...
MP_ACCESS_TOKEN=APP_USR-...
MP_WEBHOOK_SECRET=...

# Gmail SMTP
GMAIL_USER=seu@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Site
NEXT_PUBLIC_SITE_URL=https://seusite.vercel.app
DOWNLOAD_LINK=https://link-do-arquivo.com/arquivo.exe

# Admin JWT
ADMIN_SECRET_KEY=sua-chave-secreta-aqui
```

---

## Dependências do Projeto (package.json)

```bash
# Instalar todas as dependências:
npm install

# Principais dependências:
next                  # Framework principal
react                 # UI
react-dom             # DOM do React
typescript            # Tipagem
@supabase/supabase-js # Cliente do banco de dados
bcryptjs              # Hash de senhas
jsonwebtoken          # Tokens JWT de sessão
nodemailer            # Envio de e-mails
mercadopago           # PIX e pagamentos
@types/bcryptjs       # Tipos TypeScript
@types/jsonwebtoken   # Tipos TypeScript
```

---

## Como Rodar Localmente

```bash
# 1. Clonar o repositório
git clone https://github.com/fiiregod30-cell/sumblercontrol-app

# 2. Entrar na pasta
cd sumblercontrol-app

# 3. Instalar dependências
npm install

# 4. Criar arquivo .env.local com as variáveis (copiar do Vercel)

# 5. Rodar em desenvolvimento
npm run dev
# Acessar: http://localhost:3000

# 6. Build de produção
npm run build
npm start
```

---

## Como Fazer Deploy

```bash
# Qualquer push na branch main faz deploy automático no Vercel:
git add .
git commit -m "descrição da mudança"
git push

# O Vercel detecta, faz o build e atualiza o site em ~30 segundos
```

---

## Como Atualizar o Preço ou Link de Download

1. Acesse `/admin` → login com `admin@sumblercontrol.com`
2. Clique em **⚙️ Configurações**
3. Altere o preço ou o link
4. Clique **Salvar**
5. O site atualiza imediatamente — sem necessidade de redeploy

---

## Conceitos Importantes Para Ensinar

### O que é SSR (Server Side Rendering)?
A landing page (`/`) é renderizada no servidor a cada requisição. Isso significa que o HTML já vem pronto do servidor com os preços atuais do banco — sem precisar de JavaScript para mostrar o conteúdo inicial. Bom para SEO e performance.

### O que é uma API Route?
Em Next.js, qualquer arquivo `route.ts` dentro de `app/api/` vira automaticamente um endpoint HTTP. Exemplo: `app/api/auth/login/route.ts` → `POST /api/auth/login`. Não precisa de servidor Node.js separado.

### O que é uma Serverless Function?
O Vercel executa cada API Route como uma função isolada que só "liga" quando recebe uma requisição. Não fica rodando 24h — economiza recursos e é gratuito até certos limites.

### O que é um Webhook?
É uma URL que você registra em um serviço externo (como Mercado Pago) para receber notificações automáticas. Quando algo acontece lá (pagamento confirmado), eles chamam sua URL com os dados. É o oposto de você ficar perguntando "já pagou?" — eles te avisam quando acontece.

### O que é JWT?
JSON Web Token — um token que contém dados codificados e uma assinatura criptográfica. O servidor gera e assina; o browser guarda. A cada requisição, o browser envia de volta; o servidor verifica a assinatura e sabe quem é o usuário sem consultar o banco.

### O que é bcrypt?
Algoritmo de hash para senhas. Transforma "senha123" em algo como `$2a$12$xwsq...`. Irreversível — não dá para saber a senha original. Com "salt" (valor aleatório) embutido, o mesmo texto gera hashes diferentes cada vez.

---

## Arquitetura Resumida

```
Browser (React/Next.js)
    ↕ HTTP / cookies
Vercel (Next.js API Routes)
    ↕ supabase-js SDK
Supabase (PostgreSQL)

Vercel → mercadopago SDK → Mercado Pago API
Mercado Pago → POST webhook → Vercel

Vercel → nodemailer SMTP → Gmail → Usuário
```

---

*Documentação criada em: Outubro/Novembro 2026*
*Projeto: SumblerControl — Site de Vendas de Software*
*Stack: Next.js 16 + Supabase + Vercel + Mercado Pago + Gmail SMTP*
