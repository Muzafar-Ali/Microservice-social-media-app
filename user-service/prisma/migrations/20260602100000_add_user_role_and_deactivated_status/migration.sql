-- Add user-initiated deactivation status and role-based access control.
ALTER TYPE "Status" ADD VALUE IF NOT EXISTS 'DEACTIVATED';

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'MODERATOR', 'SUPPORT');

ALTER TABLE "User"
ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

CREATE INDEX "User_role_idx" ON "User"("role");
