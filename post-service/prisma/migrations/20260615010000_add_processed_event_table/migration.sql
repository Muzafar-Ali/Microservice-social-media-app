CREATE TABLE "ProcessedEvent" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "consumerName" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedEvent_eventId_consumerName_key"
ON "ProcessedEvent"("eventId", "consumerName");

CREATE INDEX "ProcessedEvent_processedAt_idx"
ON "ProcessedEvent"("processedAt");
