# Sistema de Gestão de Provas — Backend

API Node.js + Express 5 + TypeScript + Prisma 6 + PostgreSQL/Supabase.

## Autenticação

A autenticação continua sendo própria da API, com JWT e Bcrypt. Supabase é usado apenas como infraestrutura de banco/Storage; não foi adotado Supabase Auth.

### Sessão normal

`POST /sessions` valida e-mail e senha e retorna um JWT com validade de 1 dia. O token contém `sub`, `role`, `escolaId` e `tokenVersion`.

O middleware `ensureAuthenticated` valida a assinatura/expiração, consulta o usuário no banco e compara o `tokenVersion` do JWT com o valor atual do usuário. Trocas e resets de senha incrementam `tokenVersion`, invalidando imediatamente sessões antigas.

### Primeiro acesso de professor

Ao criar um professor via `POST /users`, somente um coordenador autenticado pode executar a operação. A escola é obtida de `req.user.escolaId` e o papel criado é sempre `PROFESSOR`.

O backend gera uma senha temporária aleatória com `node:crypto`, armazena somente o hash Bcrypt, marca `mustChangePassword=true` e define validade de 72 horas. A senha temporária é devolvida somente na resposta de criação e nunca pode ser consultada novamente.

Quando o professor entra em `POST /sessions` usando a senha temporária válida, a API não entrega uma sessão normal. Ela retorna um `passwordChangeToken` de curta duração (15 minutos) com propósito `PASSWORD_CHANGE`.

O frontend usa esse token em `POST /auth/first-access/change-password`. Ao concluir, a senha temporária deixa de funcionar, `mustChangePassword` volta para `false`, `temporaryPasswordExpiresAt` é limpo, `passwordChangedAt` é atualizado e `tokenVersion` é incrementado. A resposta já contém uma nova sessão JWT normal.

### Recuperação por e-mail

`POST /auth/forgot-password` recebe apenas e-mail e sempre responde com a mesma mensagem e status 202, exista ou não uma conta. Isso reduz enumeração de usuários.

Para uma conta existente, a API gera 32 bytes aleatórios, envia o token real somente no link e salva no banco apenas `SHA-256(token)`. O token expira em 30 minutos, é de uso único e uma nova solicitação invalida tokens anteriores ainda não utilizados.

`POST /auth/reset-password` recebe `token` e `newPassword`. A operação valida expiração/uso, aplica a política de senha e executa as alterações críticas em transação Prisma. Depois do reset, o usuário deve fazer login novamente.

### Reset administrativo

`POST /users/:id/reset-access` é exclusivo de `COORDENADOR`. O backend não usa `escolaId` enviado pelo frontend: compara o professor com `req.user.escolaId` e recusa usuários de outra escola ou coordenadores.

O reset gera uma nova senha temporária de 72 horas, incrementa `tokenVersion`, invalida tokens de recuperação pendentes e retorna a senha temporária somente uma vez.

### Troca voluntária de senha

`PATCH /users/me/password` exige sessão válida, `currentPassword` e `newPassword`. A senha atual é validada antes da troca. Ao concluir, as sessões anteriores são invalidadas e o frontend deve solicitar novo login.

## Política de senha

Novas senhas devem ter entre 10 e 72 caracteres. Não existe exigência artificial de símbolo, maiúscula ou número. A senha não pode ser igual ao CPF, e-mail ou senha atual/temporária.

O custo Bcrypt é configurável por `BCRYPT_SALT_ROUNDS`, com mínimo 10 e padrão 12.

## Rate limiting

Há proteção em memória para endpoints sensíveis:

- `POST /sessions`: até 8 tentativas por janela de 15 minutos por IP/e-mail;
- `POST /auth/forgot-password`: limite por IP e por e-mail normalizado;
- `POST /auth/reset-password`: limite por IP/token;
- `POST /auth/first-access/change-password`: limite por IP/token;
- `PATCH /users/me/password`: limite por IP.

Para múltiplas instâncias da API em produção, a evolução recomendada é mover o armazenamento do rate limit para Redis ou serviço equivalente.

## Serviço de e-mail

Controllers não dependem de um provedor específico. `MailService` usa uma abstração simples:

- em desenvolvimento, se `MAIL_PROVIDER_URL` não estiver configurada, o link de reset é mostrado somente no console local;
- em produção, configure `MAIL_PROVIDER_URL` para um gateway HTTP de e-mail. A API envia um `POST` JSON com `from`, `to`, `subject`, `text` e `html` e, se existir, `Authorization: Bearer <MAIL_PROVIDER_API_KEY>`.

Nunca registre tokens de reset, JWTs, senhas, hashes ou CPF em produção.

## Variáveis de ambiente

Consulte `.env.example`. As novas variáveis relacionadas à autenticação são:

```env
PASSWORD_CHANGE_TOKEN_SECRET=
FRONTEND_URL=http://localhost:3333
BCRYPT_SALT_ROUNDS=12
MAIL_FROM=
MAIL_PROVIDER_URL=
MAIL_PROVIDER_API_KEY=
```

`PASSWORD_CHANGE_TOKEN_SECRET` deve ser um segredo aleatório separado do `JWT_SECRET` e possuir pelo menos 32 caracteres.

## Migration

A migration adiciona ao usuário:

- `mustChangePassword Boolean @default(false)`;
- `temporaryPasswordExpiresAt DateTime?`;
- `tokenVersion Int @default(0)`;
- `passwordChangedAt DateTime?`.

Também adiciona o model `PasswordResetToken` com `id`, `userId`, `tokenHash`, `expiresAt`, `usedAt` e `createdAt`.

Usuários existentes permanecem com `mustChangePassword=false`. Para migrá-los gradualmente, use a ação administrativa **Redefinir acesso**.

Depois de atualizar o código local:

```bash
npm install
npx prisma migrate dev --name auth_password_recovery
npx prisma generate
npm run typecheck
npm run build
npm run dev
```

Se o banco Supabase for compartilhado/produção, não use `migrate dev` diretamente contra produção. Gere/revise a migration em ambiente de desenvolvimento e aplique em produção com o fluxo de deploy apropriado (`prisma migrate deploy`). Nunca use `prisma migrate reset`.

## Rotas de autenticação

```text
POST  /sessions
POST  /auth/forgot-password
POST  /auth/reset-password
POST  /auth/first-access/change-password
PATCH /users/me/password
POST  /users/:id/reset-access
```

As rotas existentes de provas, turmas e upload permanecem preservadas.

## Checklist manual de segurança

Valide pelo menos estes cenários antes do deploy:

- login correto e senha incorreta com mensagem genérica;
- usuário inexistente com a mesma mensagem de login;
- criação de professor retorna senha temporária uma única vez;
- senha temporária expirada é recusada;
- professor não recebe dashboard antes de concluir primeiro acesso;
- reset de e-mail não revela se a conta existe;
- banco contém apenas hash do reset token;
- reset token expirado/usado/aleatório é recusado;
- coordenador da Escola A não redefine professor da Escola B;
- coordenador não redefine outro coordenador;
- JWT emitido antes de reset/troca retorna 401 depois do incremento de `tokenVersion`;
- CPF, e-mail, senha atual e senha temporária são recusados como nova senha quando aplicável;
- respostas nunca incluem hash de senha.

## Melhorias futuras

Não fazem parte desta alteração:

- migrar sessão para cookies `HttpOnly + Secure + SameSite` ou access token em memória + refresh token HttpOnly;
- MFA TOTP para coordenadores;
- rate limiting distribuído para múltiplas instâncias.
