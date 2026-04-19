/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `UserProfileCache` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserProfileCache_username_idx";

-- AlterTable
ALTER TABLE "UserProfileCache" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileCache_username_key" ON "UserProfileCache"("username");

-- CreateIndex
CREATE INDEX "UserProfileCache_status_idx" ON "UserProfileCache"("status");
