import { OutboxEvent, PrismaClient } from '../generated/prisma/client.js';
import { PostEventPublisher } from '../events/post-events.producer.js';
import { POST_EVENT_NAMES } from '../events/topics.js';
import { PostCreatedEventPayload } from '../types/post-event-publisher.types.js';
import logger from '../utils/logger.js';

export class OutboxWorker {
  private readonly maxRetries = 5;
  private readonly processingTimeoutMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly postEventPublisher: PostEventPublisher,
  ) {}

  async processPendingEvents(): Promise<void> {
    await this.recoverStaleProcessingEvents();

    const claimedEvents = await this.prisma.$transaction(async (transactionClient) => {
      return transactionClient.$queryRaw<OutboxEvent[]>`
        UPDATE "OutboxEvent"
        SET
          status = 'PROCESSING',
          error = NULL,
          "processingStartedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE id IN (
          SELECT id
          FROM "OutboxEvent"
          WHERE status IN ('PENDING', 'FAILED')
            AND "retryCount" < ${this.maxRetries}
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 50
        )
        RETURNING *;
      `;
    });

    for (const outboxEvent of claimedEvents) {
      try {
        if (outboxEvent.eventName !== POST_EVENT_NAMES.POST_CREATED) {
          throw new Error(`Unsupported post outbox event: ${outboxEvent.eventName}`);
        }

        await this.postEventPublisher.publishPostCreated(
          outboxEvent.payload as PostCreatedEventPayload,
          outboxEvent.eventId,
        );

        await this.prisma.outboxEvent.update({
          where: { id: outboxEvent.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            processingStartedAt: null,
            error: null,
          },
        });
      } catch (error) {
        const nextRetryCount = outboxEvent.retryCount + 1;
        const isExhausted = nextRetryCount >= this.maxRetries;

        await this.prisma.outboxEvent.update({
          where: { id: outboxEvent.id },
          data: {
            status: isExhausted ? 'DEAD_LETTERED' : 'FAILED',
            retryCount: nextRetryCount,
            processingStartedAt: null,
            deadLetteredAt: isExhausted ? new Date() : null,
            error: error instanceof Error ? error.message : String(error),
          },
        });

        logger.error(
          {
            error,
            outboxEventId: outboxEvent.id,
            eventId: outboxEvent.eventId,
            eventName: outboxEvent.eventName,
            retryCount: nextRetryCount,
            deadLettered: isExhausted,
          },
          isExhausted ? 'Post outbox event moved to dead-letter state' : 'Post outbox event publishing failed',
        );
      }
    }
  }

  private async recoverStaleProcessingEvents(): Promise<void> {
    const staleBefore = new Date(Date.now() - this.processingTimeoutMs);

    const recoveredEvents = await this.prisma.$queryRaw<Array<{ id: string; eventName: string }>>`
      UPDATE "OutboxEvent"
      SET
        status = 'PENDING',
        error = 'Recovered stale PROCESSING event after worker timeout',
        "processingStartedAt" = NULL,
        "updatedAt" = NOW()
      WHERE status = 'PROCESSING'
        AND "processingStartedAt" IS NOT NULL
        AND "processingStartedAt" < ${staleBefore}
        AND "retryCount" < ${this.maxRetries}
      RETURNING id, "eventName";
    `;

    for (const event of recoveredEvents) {
      logger.warn(
        {
          outboxEventId: event.id,
          eventName: event.eventName,
        },
        'Recovered stale post outbox event',
      );
    }
  }

  async cleanupPublishedEvents(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.outboxEvent.deleteMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    logger.info({ deletedCount: result.count }, 'Published post outbox events cleaned up');
  }
}
