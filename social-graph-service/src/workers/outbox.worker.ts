import { OutboxEvent, PrismaClient } from '../generated/prisma/client.js';
import { SOCIAL_GRAPH_EVENT_NAMES } from '../events/socialGraph-event.topics.js';
import { SocialGraphEventPublisher } from '../events/socialGraph-producer.js';
import { FollowCreatedPayload, UnFollowCreatedPayload } from '../types/social-graph-event-publisher.types.js';
import logger from '../utils/logger.js';

export class OutboxWorker {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly socialGraphEventPublisher: SocialGraphEventPublisher,
  ) {}

  async processPendingEvents(): Promise<void> {
    const claimedEvents = await this.prisma.$transaction(async (transactionClient: any) => {
      return transactionClient.$queryRaw<OutboxEvent[]>`
        UPDATE "OutboxEvent"
        SET 
          status = 'PROCESSING',
          error = NULL,
          "updatedAt" = NOW()
        WHERE id IN (
          SELECT id
          FROM "OutboxEvent"
          WHERE status IN ('PENDING', 'FAILED')
            AND "retryCount" < 5
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 50
        )
        RETURNING *;
      `;
    });

    for (const outboxEvent of claimedEvents) {
      try {
        if (
          outboxEvent.eventName === SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED ||
          outboxEvent.eventName === SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REQUESTED
        ) {
          await this.socialGraphEventPublisher.publishFollowCreated(
            outboxEvent.payload as FollowCreatedPayload,
            outboxEvent.eventId,
          );
        }

        if (outboxEvent.eventName === SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED) {
          await this.socialGraphEventPublisher.publishFollowRemoved(
            outboxEvent.payload as UnFollowCreatedPayload,
            outboxEvent.eventId,
          );
        }

        await this.prisma.outboxEvent.update({
          where: { id: outboxEvent.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            error: null,
          },
        });
      } catch (error) {
        await this.prisma.outboxEvent.update({
          where: { id: outboxEvent.id },
          data: {
            status: 'FAILED',
            retryCount: {
              increment: 1,
            },
            error: error instanceof Error ? error.message : String(error),
          },
        });

        logger.error(
          {
            error,
            outboxEventId: outboxEvent.id,
            eventId: outboxEvent.eventId,
            eventName: outboxEvent.eventName,
          },
          'Outbox event publishing failed',
        );
      }
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

    logger.info(
      {
        deletedCount: result.count,
      },
      'Published social graph outbox events cleaned up',
    );
  }
}
