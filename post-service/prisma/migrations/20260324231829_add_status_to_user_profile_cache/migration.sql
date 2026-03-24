/*
  Warnings:

  - You are about to drop the column `isDeleted` on the `UserProfileCache` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `UserProfileCache` table. All the data in the column will be lost.
  - Added the required column `status` to the `UserProfileCache` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserProfileCache" DROP COLUMN "isDeleted",
DROP COLUMN "isVerified",
ADD COLUMN     "status" TEXT NOT NULL;
