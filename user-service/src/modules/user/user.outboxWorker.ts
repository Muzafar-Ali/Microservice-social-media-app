import { UserEventPublisher } from '../../events/producers.js';
import { USER_EVENT_NAMES } from '../../events/topics.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { UserCreatedPayload, UserUpdatedPayload } from '../../types/publisher.types.js';
import logger from '../../utils/logger.js';


export class OutboxWorker {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userEventPublisher: UserEventPublisher,
  ) {}

  async processPendingEvents(): Promise<void> {
    const pendingEvents = await this.prisma.outboxEvent.findMany({
      where: {
        status: {
          in: ['PENDING', 'FAILED'],
        },
        retryCount: {
          lt: 5,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 50,
    });

    for (const outboxEvent of pendingEvents) {
      try {
        await this.prisma.outboxEvent.update({
          where: { id: outboxEvent.id },
          data: {
            status: 'PROCESSING',
            error: null,
          },
        });

        if (outboxEvent.eventName === USER_EVENT_NAMES.USER_CREATED) {
          const payload = outboxEvent.payload as UserCreatedPayload;
          
          await this.userEventPublisher.publishUserCreated(payload);
        }

        if (outboxEvent.eventName === USER_EVENT_NAMES.USER_UPDATED) {
          const payload = outboxEvent.payload as UserUpdatedPayload;

          await this.userEventPublisher.publishUserUpdated(payload);
        }

        await this.prisma.outboxEvent.update({
          where: { id: outboxEvent.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
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
