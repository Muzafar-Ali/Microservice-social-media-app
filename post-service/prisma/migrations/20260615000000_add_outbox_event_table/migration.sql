CREATE TYPE "OutboxEventStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'PUBLISHED',
    'FAILED',
    'DEAD_LETTERED'
);

CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "partitionKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "producerService" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "deadLetteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboxEvent_eventId_key"
ON "OutboxEvent"("eventId");

CREATE INDEX "OutboxEvent_status_createdAt_idx"
ON "OutboxEvent"("status", "createdAt");

CREATE INDEX "OutboxEvent_status_retryCount_idx"
ON "OutboxEvent"("status", "retryCount");

CREATE INDEX "OutboxEvent_eventName_idx"
ON "OutboxEvent"("eventName");

CREATE INDEX "OutboxEvent_aggregateId_idx"
ON "OutboxEvent"("aggregateId");
