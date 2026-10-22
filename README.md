# Sistema de Gestão de Provas — Backend

API Node.js + Express 5 + TypeScript + Prisma 6 + PostgreSQL/Supabase.

## Autenticação

A autenticação é própria da API, usando JWT e Bcrypt. Supabase é utilizado como infraestrutura de banco de dados e Storage; o projeto não utiliza Supabase Auth.

### Login

`POST /sessions` recebe e-mail e senha. Em caso de sucesso, retorna um JWT com validade de 1 dia contendo `sub`, `role`, `escolaId` e `tokenVersion`.

O middleware `ensureAuthenticated` valida o JWT, consulta o usuário no banco e compara o `tokenVersion` do token com o valor atual do usuário. Uma redefinição de senha incrementa `tokenVersion`, invalidando sessões anteriores.

### Senha inicial do professor

O sistema é fechado e os professores são cadastrados pelo coordenador.

Ao criar um professor via `POST /users`:

- somente um `COORDENADOR` autenticado pode criar o usuário;
- a escola é obtida de `req.user.escolaId`;
- a role é definida no backend como `PROFESSOR`;
- o CPF é normalizado para 11 números e utilizado como senha inicial;
- o CPF usado como senha nunca é armazenado em texto puro no campo `password`;
- o backend gera e salva somente o hash Bcrypt da senha inicial.

O CPF continua armazenado no campo próprio `cpf` porque faz parte do cadastro do professor. A coluna `password` contém apenas o hash Bcrypt.

Não existe fluxo obrigatório de primeiro acesso, senha temporária aleatória ou tela autenticada de alteração de senha.

## Tentativas incorretas de login

O backend acompanha falhas de autenticação por combinação de e-mail normalizado e IP.

- 1ª senha incorreta: a resposta informa que restam 2 tentativas;
- 2ª senha incorreta: a resposta informa que resta 1 tentativa;
- 3ª senha incorreta: o login é bloqueado temporariamente por 5 minutos;
- um login correto limpa as falhas acumuladas;
- durante o bloqueio, a resposta utiliza HTTP `429` e envia `Retry-After`;
- a mensagem também orienta o usuário a utilizar **Esqueceu sua senha?** quando necessário.

Além disso, existe um rate limit geral por IP para reduzir abuso automatizado. O controle atual fica em memória; se a API passar a executar em múltiplas instâncias, a evolução recomendada é armazenar esse estado em Redis ou serviço equivalente.

## Recuperação de senha por e-mail

### Solicitar recuperação

`POST /auth/forgot-password` recebe o e-mail e sempre retorna a mesma resposta com status `202`, exista ou não uma conta. Isso reduz enumeração de usuários.

Para uma conta existente:

1. a API gera um token aleatório criptograficamente seguro com `node:crypto`;
2. somente o hash SHA-256 do token é armazenado no banco;
3. o token real aparece apenas no link enviado ao usuário;
4. o token expira em 30 minutos;
5. uma nova solicitação invalida tokens anteriores ainda não utilizados.

### Redefinir a senha

`POST /auth/reset-password` recebe `token` e `newPassword`.

A API valida se o token existe, ainda não foi usado e ainda não expirou. Depois aplica a política de senha e atualiza o usuário dentro de uma transação Prisma.

Ao concluir:

- a nova senha é armazenada somente como hash Bcrypt;
- `passwordChangedAt` é atualizado;
- `tokenVersion` é incrementado para invalidar sessões antigas;
- os demais tokens de recuperação pendentes são invalidados;
- o token utilizado não pode ser reutilizado;
- o usuário deve fazer login novamente.

## Política da nova senha

A política abaixo é aplicada ao fluxo **Esqueceu sua senha?**:

- mínimo de 10 caracteres;
- máximo de 72 caracteres;
- não pode ser igual ao CPF;
- não pode ser igual ao e-mail;
- não pode ser igual à senha atual.

Não há exigência artificial de símbolo, letra maiúscula ou número.

O custo Bcrypt é configurável por `BCRYPT_SALT_ROUNDS`, com mínimo 10 e padrão 12.

## Serviço de e-mail

Os controllers não dependem diretamente de um provedor específico. O `MailService` utiliza uma abstração simples.

Em desenvolvimento, se `MAIL_PROVIDER_URL` não estiver configurada, o link de redefinição pode ser exibido somente no console local para permitir testes.

Em produção, configure um gateway HTTP de e-mail usando:

```env
MAIL_FROM=
MAIL_PROVIDER_URL=
MAIL_PROVIDER_API_KEY=
```

A API envia um `POST` JSON com os dados necessários para a mensagem. Nunca registre JWTs, senhas, hashes, CPF ou tokens de recuperação em logs de produção.

## Variáveis de ambiente

Consulte `.env.example`.

```env
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
FRONTEND_URL=http://localhost:3333
BCRYPT_SALT_ROUNDS=12
MAIL_FROM=
MAIL_PROVIDER_URL=
MAIL_PROVIDER_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## Migrations de autenticação

A migration:

```text
20261022210000_auth_password_recovery
```

criou `PasswordResetToken`, `tokenVersion`, `passwordChangedAt` e também campos que eram usados pelo fluxo de senha temporária.

Depois que o fluxo foi simplificado, a migration:

```text
20261022223000_simplify_auth_flow
```

remove apenas:

- `must_change_password`;
- `temporary_password_expires_at`.

Ela preserva usuários, escolas, turmas, provas, senhas atuais, tokens de recuperação, `token_version` e `password_changed_at`.

Para o banco Supabase já existente, utilize migrations versionadas. Não use `prisma migrate reset` e não use `prisma db push` para substituir este fluxo de migrations.

Depois de atualizar o código local:

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm test
npm run typecheck
npm run build
npm run dev
```

## Rotas de autenticação

```text
POST /sessions
POST /auth/forgot-password
POST /auth/reset-password
```

A gestão de professores continua usando as rotas CRUD existentes em `/users`. Não existe mais rota de primeiro acesso, troca de senha autenticada ou reset administrativo de acesso.

## Checklist manual

Antes do deploy, valide:

- professor novo consegue entrar usando CPF sem pontuação como senha inicial;
- o campo `password` no banco contém hash Bcrypt e não o CPF em texto puro;
- login correto funciona normalmente;
- primeira senha errada informa 2 tentativas restantes;
- segunda senha errada informa 1 tentativa restante;
- terceira senha errada gera bloqueio temporário de 5 minutos;
- login correto limpa falhas anteriores;
- **Esqueceu sua senha?** não revela se o e-mail existe;
- banco armazena somente o hash do reset token;
- token expirado, utilizado ou aleatório é recusado;
- nova senha não pode ser igual ao CPF, e-mail ou senha atual;
- JWT emitido antes da redefinição deixa de ser válido após o incremento de `tokenVersion`;
- respostas da API nunca incluem o hash da senha.

## Melhorias futuras

Possíveis evoluções, caso o projeto precise crescer:

- Redis para rate limiting e bloqueio de login distribuído;
- cookies `HttpOnly + Secure + SameSite` ou refresh token seguro;
- MFA para coordenadores;
- integração direta com um provedor de e-mail transacional.
