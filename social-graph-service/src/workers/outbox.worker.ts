import { OutboxEvent, PrismaClient } from '../generated/prisma/client.js';
import { SOCIAL_GRAPH_EVENT_NAMES } from '../events/socialGraph-event.topics.js';
import { SocialGraphEventPublisher } from '../events/socialGraph-producer.js';
import { FollowCreatedPayload, UnFollowCreatedPayload } from '../types/social-graph-event-publisher.types.js';
import logger from '../utils/logger.js';
import {
  outboxCleanupDeletedTotal,
  outboxDeadLetteredEventsGauge,
  outboxEventsClaimedTotal,
  outboxEventsDeadLetteredTotal,
  outboxEventsPublishedTotal,
  outboxPendingEventsGauge,
  outboxPublishFailuresTotal,
} from '../monitoring/outbox.metrics.js';

export class OutboxWorker {
  private readonly maxRetries = 5;
  private readonly processingTimeoutMs = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly socialGraphEventPublisher: SocialGraphEventPublisher,
  ) {}

  async processPendingEvents(): Promise<void> {
    await this.recoverStaleProcessingEvents();

    const claimedEvents = await this.prisma.$transaction(async (transactionClient: any) => {
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
          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED:
          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REQUESTED:
            await this.socialGraphEventPublisher.publishFollowCreated(
              outboxEvent.payload as FollowCreatedPayload,
              outboxEvent.eventId,
            );
            break;

          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_ACCEPTED:
            await this.socialGraphEventPublisher.publishFollowAccepted(
              outboxEvent.payload as FollowCreatedPayload,
              outboxEvent.eventId,
            );
            break;

          case SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED:
            await this.socialGraphEventPublisher.publishFollowRemoved(
              outboxEvent.payload as UnFollowCreatedPayload,
              outboxEvent.eventId,
            );
            break;

          default:
            throw new Error(`Unsupported social graph outbox event: ${outboxEvent.eventName}`);
        }

        await this.prisma.$executeRaw`
          UPDATE "OutboxEvent"
          SET
            status = 'PUBLISHED'::"OutboxEventStatus",
            "publishedAt" = ${new Date()},
            "processingStartedAt" = NULL,
            error = NULL,
            "updatedAt" = NOW()
          WHERE id = ${outboxEvent.id};
        `;

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
          isExhausted ? 'Social graph outbox event moved to dead-letter state' : 'Outbox event publishing failed',
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
        'Recovered stale social graph outbox event',
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
      'Published social graph outbox events cleaned up',
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
