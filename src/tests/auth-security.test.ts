import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/test";
process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.BCRYPT_SALT_ROUNDS ??= "10";

const { isValidCpf, normalizeCpf } = await import("../utils/cpf.js");
const {
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
} = await import("../services/password-service.js");
const {
  clearLoginFailures,
  getLoginAttemptState,
  registerLoginFailure,
} = await import("../services/login-attempt-service.js");

test("normaliza e valida CPF matematicamente", () => {
  assert.equal(normalizeCpf("529.982.247-25"), "52998224725");
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("529.982.247-24"), false);
});

test("bcrypt armazena o CPF inicial apenas como hash", async () => {
  const cpf = "52998224725";
  const passwordHash = await hashPassword(cpf);

  assert.notEqual(passwordHash, cpf);
  assert.equal(passwordHash.includes(cpf), false);
  assert.equal(await verifyPassword(cpf, passwordHash), true);
});

test("politica de redefinicao recusa senha curta, CPF, e-mail e senha atual", async () => {
  await assert.rejects(
    () => assertPasswordPolicy("curta"),
    /mínimo de 10 caracteres/,
  );

  await assert.rejects(
    () =>
      assertPasswordPolicy("529.982.247-25", {
        cpf: "52998224725",
      }),
    /igual ao CPF/,
  );

  await assert.rejects(
    () =>
      assertPasswordPolicy("PROFESSOR@ESCOLA.COM", {
        email: "professor@escola.com",
      }),
    /igual ao e-mail/,
  );

  const currentPasswordHash = await hashPassword("SenhaAtualSegura123");
  await assert.rejects(
    () =>
      assertPasswordPolicy("SenhaAtualSegura123", {
        currentPasswordHash,
      }),
    /diferente da senha atual/,
  );
});

test("politica aceita senha longa que nao coincide com dados do usuario", async () => {
  await assert.doesNotReject(() =>
    assertPasswordPolicy("uma senha longa e exclusiva", {
      cpf: "52998224725",
      email: "professor@escola.com",
    }),
  );
});

test("bloqueia login temporariamente na terceira credencial incorreta", () => {
  const email = "tentativas-teste@escola.com";
  const ip = "127.0.0.123";
  clearLoginFailures(email, ip);

  const primeira = registerLoginFailure(email, ip);
  assert.equal(primeira.blocked, false);
  assert.equal(primeira.attemptsRemaining, 2);

  const segunda = registerLoginFailure(email, ip);
  assert.equal(segunda.blocked, false);
  assert.equal(segunda.attemptsRemaining, 1);

  const terceira = registerLoginFailure(email, ip);
  assert.equal(terceira.blocked, true);
  assert.equal(terceira.attemptsRemaining, 0);
  assert.ok((terceira.retryAfterSeconds ?? 0) > 0);

  const bloqueado = getLoginAttemptState(email, ip);
  assert.equal(bloqueado.blocked, true);

  clearLoginFailures(email, ip);
  assert.equal(getLoginAttemptState(email, ip).blocked, false);
});
