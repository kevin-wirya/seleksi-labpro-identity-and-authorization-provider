-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "mfa_secret" TEXT,
ADD COLUMN IF NOT EXISTS "mfa_recovery_codes" TEXT;

-- AlterTable
ALTER TABLE "authorization_codes" ADD COLUMN IF NOT EXISTS "code_challenge" TEXT,
ADD COLUMN IF NOT EXISTS "code_challenge_method" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "mfa_pending_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_pending_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mfa_pending_sessions_token_key" ON "mfa_pending_sessions"("token");

-- AddForeignKey
ALTER TABLE "mfa_pending_sessions" ADD CONSTRAINT "mfa_pending_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
