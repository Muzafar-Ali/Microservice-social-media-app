import { UserEventPublisher } from '../../events/producers.js';
import { USER_EVENT_NAMES } from '../../events/topics.js';
import { OutboxEvent, PrismaClient } from '../../generated/prisma/client.js';
import { UserCreatedPayload, UserUpdatedPayload } from '../../types/publisher.types.js';
import logger from '../../utils/logger.js';


export class OutboxWorker {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userEventPublisher: UserEventPublisher,
  ) {}

  async processPendingEvents(): Promise<void> {
  const claimedEvents = await this.prisma.$transaction(async (transactionClient) => {
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
        if (outboxEvent.eventName === USER_EVENT_NAMES.USER_CREATED) {
          await this.userEventPublisher.publishUserCreated(
            outboxEvent.payload as UserCreatedPayload,
            outboxEvent.eventId,
          );
        }

        if (outboxEvent.eventName === USER_EVENT_NAMES.USER_UPDATED) {
          await this.userEventPublisher.publishUserUpdated(
            outboxEvent.payload as UserUpdatedPayload,
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
      'Published outbox events cleaned up',
    );
  }
}
