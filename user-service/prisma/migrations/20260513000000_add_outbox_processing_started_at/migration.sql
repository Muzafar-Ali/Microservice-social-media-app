-- Track when an outbox event is claimed so crashed workers can be recovered.
ALTER TABLE "OutboxEvent"
ADD COLUMN "processingStartedAt" TIMESTAMP(3);
