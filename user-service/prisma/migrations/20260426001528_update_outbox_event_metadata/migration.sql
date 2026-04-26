/*
  Warnings:

  - A unique constraint covering the columns `[eventId]` on the table `OutboxEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `eventId` to the `OutboxEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `occurredAt` to the `OutboxEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `producerService` to the `OutboxEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "deadLetteredAt" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT NOT NULL,
ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "producerService" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventId_key" ON "OutboxEvent"("eventId");
