-- Remove only the temporary-password/first-access columns.
-- Password recovery tokens, token_version and password_changed_at are kept.
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "must_change_password",
  DROP COLUMN IF EXISTS "temporary_password_expires_at";
