import { UserEventPublisher } from '../../events/producers.js';
import { USER_EVENT_NAMES } from '../../events/topics.js';
import { OutboxEvent, PrismaClient } from '../../generated/prisma/client.js';
import {
  outboxCleanupDeletedTotal,
  outboxDeadLetteredEventsGauge,
  outboxEventsClaimedTotal,
  outboxEventsDeadLetteredTotal,
  outboxEventsPublishedTotal,
  outboxPendingEventsGauge,
  outboxPublishFailuresTotal,
} from '../../monitoring/outbox.metrics.js';
import { UserCreatedPayload, UserUpdatedPayload } from '../../types/publisher.types.js';
import logger from '../../utils/logger.js';

export class OutboxWorker {
  private readonly maxRetries = 5;
  private readonly processingTimeoutMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly userEventPublisher: UserEventPublisher,
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
      outboxEventsClaimedTotal.inc({ event_name: outboxEvent.eventName });
      try {
        switch (outboxEvent.eventName) {
          case USER_EVENT_NAMES.USER_CREATED:
            await this.userEventPublisher.publishUserCreated(
              outboxEvent.payload as UserCreatedPayload,
              outboxEvent.eventId,
            );
            break;

          case USER_EVENT_NAMES.USER_UPDATED:
            await this.userEventPublisher.publishUserUpdated(
              outboxEvent.payload as UserUpdatedPayload,
              outboxEvent.eventId,
            );
            break;

          default:
            throw new Error(`Unsupported user outbox event: ${outboxEvent.eventName}`);
        }

        await this.prisma.outboxEvent.update({
          where: { id: outboxEvent.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            processingStartedAt: null,
            error: null,
          },
        });

        outboxEventsPublishedTotal.inc({ event_name: outboxEvent.eventName });
      } catch (error) {
        outboxPublishFailuresTotal.inc({ event_name: outboxEvent.eventName });
        const nextRetryCount = outboxEvent.retryCount + 1;
        const isExhausted = nextRetryCount >= this.maxRetries;
        const errorMessage = error instanceof Error ? error.message : String(error);

        await this.prisma.$executeRaw`
          UPDATE "OutboxEvent"
          SET
            status = ${isExhausted ? 'DEAD_LETTERED' : 'FAILED'}::"OutboxEventStatus",
            "retryCount" = ${nextRetryCount},
            error = ${errorMessage},
            "processingStartedAt" = NULL,
            "deadLetteredAt" = ${isExhausted ? new Date() : null},
            "updatedAt" = NOW()
          WHERE id = ${outboxEvent.id};
        `;

        if (isExhausted) {
          outboxEventsDeadLetteredTotal.inc({ event_name: outboxEvent.eventName });
        }

        logger.error(
          {
            error,
            outboxEventId: outboxEvent.id,
            eventId: outboxEvent.eventId,
            eventName: outboxEvent.eventName,
            retryCount: nextRetryCount,
            deadLettered: isExhausted,
          },
          isExhausted ? 'Outbox event moved to dead-letter state' : 'Outbox event publishing failed',
        );
      }
    }

    await this.updateOutboxGauges();
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
        'Recovered stale outbox event stuck in PROCESSING',
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

    outboxCleanupDeletedTotal.inc(result.count);

    logger.info(
      {
        deletedCount: result.count,
      },
      'Published outbox events cleaned up',
    );
  }

  private async updateOutboxGauges(): Promise<void> {
    const pendingEventsCount = await this.prisma.outboxEvent.count({
      where: {
        status: {
          in: ['PENDING', 'FAILED'],
        },
        retryCount: {
          lt: this.maxRetries,
        },
      },
    });

    const deadLetteredEventsCount = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "OutboxEvent"
      WHERE status = 'DEAD_LETTERED'::"OutboxEventStatus";
    `;

    outboxPendingEventsGauge.set(pendingEventsCount);
    outboxDeadLetteredEventsGauge.set(Number(deadLetteredEventsCount[0]?.count ?? 0));
  }
}
