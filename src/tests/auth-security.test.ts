import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/test";
process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.PASSWORD_CHANGE_TOKEN_SECRET ??=
  "test-password-change-secret-with-at-least-32-characters";
process.env.BCRYPT_SALT_ROUNDS ??= "10";

const { isValidCpf, normalizeCpf } = await import("../utils/cpf.js");
const {
  assertPasswordPolicy,
  generateTemporaryPassword,
  hashPassword,
} = await import("../services/password-service.js");

test("normaliza e valida CPF matematicamente", () => {
  assert.equal(normalizeCpf("529.982.247-25"), "52998224725");
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("529.982.247-24"), false);
});

test("gera credenciais temporarias aleatorias com tamanho adequado", () => {
  const first = generateTemporaryPassword();
  const second = generateTemporaryPassword();

  assert.ok(first.length >= 12 && first.length <= 16);
  assert.ok(second.length >= 12 && second.length <= 16);
  assert.notEqual(first, second);
});

test("politica recusa senha curta, CPF, e-mail e senha atual", async () => {
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
    /diferente da senha atual ou temporária/,
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
