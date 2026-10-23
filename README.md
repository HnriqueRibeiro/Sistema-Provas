# Sistema de Gestão de Provas — Backend

API Node.js + Express 5 + TypeScript + Prisma 6 + PostgreSQL.

## Autenticação

A autenticação é própria da API, usando JWT e Bcrypt.

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
- o campo `password` recebe somente o hash Bcrypt da senha inicial.

Não existe fluxo obrigatório de primeiro acesso, senha temporária aleatória ou tela autenticada de alteração de senha.

## Tentativas incorretas de login

O backend acompanha falhas por combinação de e-mail normalizado e IP.

- 1ª senha incorreta: restam 2 tentativas;
- 2ª senha incorreta: resta 1 tentativa;
- 3ª senha incorreta: bloqueio temporário de 5 minutos;
- login correto limpa as falhas acumuladas;
- durante o bloqueio a API responde HTTP `429` com `Retry-After`;
- a mensagem orienta o usuário a utilizar **Esqueceu sua senha?** quando necessário.

O controle atual fica em memória. Caso a API passe a executar em múltiplas instâncias, a evolução recomendada é usar Redis ou serviço equivalente.

## Recuperação de senha por e-mail

### Solicitar recuperação

`POST /auth/forgot-password` recebe o e-mail e sempre retorna a mesma resposta com status `202`, exista ou não uma conta.

Para uma conta existente:

1. a API gera um token aleatório com `node:crypto`;
2. somente o hash SHA-256 do token é armazenado no banco;
3. o token real aparece apenas no link enviado ao usuário;
4. o token expira em 30 minutos;
5. uma nova solicitação invalida tokens anteriores ainda não utilizados.

### Redefinir a senha

`POST /auth/reset-password` recebe `token` e `newPassword`.

A nova senha deve:

- ter entre 6 e 8 caracteres;
- conter somente letras (`A-Z`, `a-z`) e números (`0-9`);
- ser diferente da senha atual.

A API valida o token e atualiza o usuário dentro de uma transação Prisma. Ao concluir:

- a nova senha é armazenada somente como hash Bcrypt;
- `passwordChangedAt` é atualizado;
- `tokenVersion` é incrementado para invalidar sessões antigas;
- tokens de recuperação pendentes são invalidados;
- o token utilizado não pode ser reutilizado;
- o bloqueio de login daquele e-mail/IP é limpo;
- o usuário deve fazer login novamente.

O custo Bcrypt é configurável por `BCRYPT_SALT_ROUNDS`, com mínimo 10 e padrão 12.

## Envio de e-mail com Gmail API

A recuperação de senha utiliza uma conta Gmail dedicada por meio da Gmail API e OAuth 2.0.

Não é utilizado SMTP porque os Droplets da DigitalOcean bloqueiam as portas SMTP de saída. A Gmail API funciona por HTTPS e utiliza apenas o escopo necessário para envio de mensagens (`gmail.send`).

Em produção configure:

```env
GMAIL_USER=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
```

O backend usa o refresh token para obter um access token no endpoint OAuth do Google e envia a mensagem por `users.messages.send`.

Em desenvolvimento/teste, se as credenciais do Gmail não estiverem configuradas, o link de recuperação é mostrado apenas no console local.

Nunca registre JWTs, senhas, hashes, CPF, client secret ou refresh token em logs de produção.

## Autorização no upload de provas

`POST /provas` é exclusivo de `PROFESSOR` e, antes de enviar o arquivo para o storage, o backend valida que:

- a turma existe;
- a turma pertence à mesma escola indicada no JWT (`escolaId`);
- o professor autenticado está vinculado àquela turma.

Se qualquer uma dessas condições falhar, a API responde `403` e o upload não é executado.

## Variáveis de ambiente

Consulte `.env.example`.

```env
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
FRONTEND_URL=http://localhost:3333
BCRYPT_SALT_ROUNDS=12

GMAIL_USER=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

SUPABASE_URL=
SUPABASE_ANON_KEY=
```

As variáveis do Supabase ainda existem porque o storage atual será migrado para DigitalOcean Spaces antes da produção.

## Migrations de autenticação

A migration `20261022210000_auth_password_recovery` criou `PasswordResetToken`, `tokenVersion`, `passwordChangedAt` e campos usados pelo fluxo antigo de senha temporária.

A migration `20261022223000_simplify_auth_flow` remove somente:

- `must_change_password`;
- `temporary_password_expires_at`.

Ela preserva usuários, escolas, turmas, provas, senhas atuais, tokens de recuperação, `token_version` e `password_changed_at`.

Não use `prisma migrate reset` ou `prisma db push` para substituir o fluxo versionado de migrations.

## Validação local

```bash
npm install
npx prisma generate
npm test
npm run typecheck
npm run build
npm run dev
```

Em produção, use migrations versionadas com:

```bash
npx prisma migrate deploy
```

## Rotas de autenticação

```text
POST /sessions
POST /auth/forgot-password
POST /auth/reset-password
```

Não existe rota de primeiro acesso, troca de senha autenticada ou reset administrativo de acesso.

## Checklist antes do deploy

- professor novo entra usando CPF sem pontuação como senha inicial;
- `password` contém hash Bcrypt;
- bloqueio ocorre na terceira senha incorreta;
- **Esqueceu sua senha?** não revela se o e-mail existe;
- Gmail API envia o link real para o usuário;
- token expirado, utilizado ou aleatório é recusado;
- nova senha aceita somente 6 a 8 caracteres alfanuméricos;
- JWT antigo deixa de ser válido após redefinição;
- professor não consegue enviar prova para turma de outra escola;
- professor não consegue enviar prova para turma à qual não está vinculado;
- respostas da API nunca incluem hash da senha.

## Próximas etapas para produção

- migrar storage do Supabase para DigitalOcean Spaces privado;
- restringir CORS ao domínio do frontend;
- ajustar Dockerfile de produção;
- configurar Nginx, HTTPS e firewall;
- configurar PostgreSQL Managed Database;
- configurar Gmail API/OAuth em produção;
- executar teste completo de upload, download e recuperação de senha.
