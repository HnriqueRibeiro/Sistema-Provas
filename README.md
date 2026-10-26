# Provas — Gestão Escolar

Backend de um sistema web desenvolvido para **centralizar o envio, a organização e o gerenciamento de provas escolares**.

O projeto nasceu de uma necessidade real de um colégio municipal: provas eram enviadas diretamente para a coordenação, muitas vezes de forma repetida, ocupando armazenamento no celular e tornando difícil localizar, revisar e encaminhar os arquivos para impressão.

A solução permite que professores enviem suas próprias provas para a plataforma, enquanto a coordenação acompanha os materiais de forma centralizada e a equipe responsável pode acessá-los para impressão.

> Projeto desenvolvido a partir de um problema real, com foco em regras de negócio, segurança, organização de arquivos e controle de acesso.

## Principais funcionalidades

- Autenticação com JWT.
- Perfis de acesso para `PROFESSOR` e `COORDENADOR`.
- Isolamento dos dados por escola.
- Cadastro e gerenciamento de professores.
- Cadastro e gerenciamento de turmas.
- Vinculação de professores às turmas.
- Upload de provas em PDF, Word e imagens.
- Armazenamento privado de arquivos no Cloudflare R2.
- Geração de URLs assinadas para acesso temporário aos arquivos.
- Organização das provas por turma, professor, bimestre e ano letivo.
- Controle de status das provas: `PENDENTE`, `CONCLUIDA` e `CANCELADA`.
- Recuperação de senha por e-mail.
- Proteções contra tentativas repetidas de login.

## Perfis e permissões

| Recurso | Professor | Coordenador |
| --- | :---: | :---: |
| Visualizar suas turmas | ✅ | ✅ |
| Visualizar provas permitidas | ✅ | ✅ |
| Enviar prova | ✅ | — |
| Excluir prova | Próprias | ✅ |
| Alterar status de prova | — | ✅ |
| Gerenciar professores | — | ✅ |
| Gerenciar turmas | — | ✅ |
| Vincular professores às turmas | — | ✅ |

As permissões são validadas no backend. A interface do frontend não é responsável pela segurança das regras de acesso.

## Tecnologias

- **Node.js**
- **TypeScript**
- **Express 5**
- **PostgreSQL**
- **Prisma ORM 6**
- **Zod**
- **JWT**
- **Bcrypt**
- **Multer**
- **Cloudflare R2**
- **AWS SDK / S3 API**
- **Resend**

## Segurança

A API possui algumas decisões voltadas para segurança e controle de acesso:

- senhas armazenadas somente como hash Bcrypt;
- autenticação stateless com JWT;
- invalidação de sessões antigas por `tokenVersion` após redefinição de senha;
- recuperação de senha utilizando tokens de uso único e com expiração;
- resposta genérica na solicitação de recuperação para evitar enumeração de usuários;
- bloqueio temporário após tentativas incorretas de autenticação;
- validação de permissões por role;
- validação da escola e da turma antes do upload de uma prova;
- arquivos armazenados em bucket privado;
- acesso aos arquivos por URLs assinadas de curta duração;
- validação das variáveis de ambiente com Zod.

## Arquitetura

O backend segue uma separação de responsabilidades baseada em:

```text
src/
├── configs/
├── controllers/
├── database/
├── middlewares/
├── routes/
├── services/
├── tests/
├── types/
└── utils/
```

Os controllers concentram o fluxo das requisições HTTP, middlewares cuidam de autenticação e autorização e services encapsulam responsabilidades como envio de e-mails, autenticação e armazenamento de arquivos.

## Principais endpoints

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/sessions` | Login |
| `POST` | `/auth/forgot-password` | Solicitar recuperação de senha |
| `POST` | `/auth/reset-password` | Redefinir senha |
| `GET` | `/users/professores` | Listar professores |
| `POST` | `/users` | Cadastrar professor |
| `PUT` | `/users/:id` | Atualizar professor |
| `PATCH` | `/users/:id/status` | Ativar ou desativar usuário |
| `GET` | `/turmas` | Listar turmas disponíveis |
| `POST` | `/turmas` | Criar turma |
| `PUT` | `/turmas/:id` | Atualizar turma |
| `POST` | `/turmas/:turmaId/professores` | Vincular professor à turma |
| `GET` | `/provas` | Listar provas |
| `GET` | `/provas/:id` | Consultar prova |
| `POST` | `/provas` | Enviar nova prova |
| `PATCH` | `/provas/:id/status` | Alterar status da prova |
| `DELETE` | `/provas/:id` | Excluir prova |

## Executando localmente

### Pré-requisitos

- Node.js
- npm
- PostgreSQL

### Instalação

```bash
git clone https://github.com/HnriqueRibeiro/Sistema-Provas.git
cd Sistema-Provas
npm install
```

Crie o arquivo `.env` usando `.env.example` como referência e configure suas credenciais.

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
FRONTEND_URL=http://localhost:3333
BCRYPT_SALT_ROUNDS=12

RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=Provas Gestão Escolar

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

Depois, prepare o Prisma e execute a aplicação:

```bash
npx prisma generate
npx prisma migrate dev
npm run dev
```

A API será iniciada por padrão em:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev        # ambiente de desenvolvimento
npm run build      # gera a build TypeScript
npm start          # executa a build
npm run typecheck  # valida os tipos
npm test           # executa os testes automatizados
```

Em produção, as migrations devem ser aplicadas com:

```bash
npx prisma migrate deploy
```

## Frontend

A interface web do sistema está em um repositório separado:

**[HnriqueRibeiro/provas-frontend](https://github.com/HnriqueRibeiro/provas-frontend)**

O frontend foi desenvolvido com React, TypeScript e Vite e consome exclusivamente esta API.

## Status do projeto

O sistema foi desenvolvido para atender uma necessidade real de um colégio municipal e segue em evolução conforme o fluxo de uso da instituição.

Entre os pontos trabalhados no projeto estão autenticação, autorização por perfil, armazenamento de arquivos em nuvem, recuperação segura de senha, regras de negócio escolares e integração entre frontend e backend.

---

Desenvolvido por **Henrique Ribeiro**  
[GitHub](https://github.com/HnriqueRibeiro)
