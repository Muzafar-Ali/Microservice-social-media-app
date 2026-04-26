import { PrismaClient } from '../generated/prisma/client.js';
import { SOCIAL_GRAPH_EVENT_NAMES } from '../events/socialGraph-event.topics.js';
import { SocialGraphEventPublisher } from '../events/socialGraph-producer.js';
import {
  FollowCreatedPayload,
  UnFollowCreatedPayload,
} from '../types/social-graph-event-publisher.types.js';
import logger from '../utils/logger.js';

export class OutboxWorker {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly socialGraphEventPublisher: SocialGraphEventPublisher,
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

        if (
          outboxEvent.eventName === SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_CREATED ||
          outboxEvent.eventName === SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REQUESTED
        ) {
          await this.socialGraphEventPublisher.publishFollowCreated({
            eventId: outboxEvent.eventId,
            eventName: outboxEvent.eventName,
            eventVersion: outboxEvent.eventVersion,
            occurredAt: outboxEvent.occurredAt.toISOString(),
            producerService: outboxEvent.producerService,
            partitionKey: outboxEvent.partitionKey,
            payload: outboxEvent.payload as FollowCreatedPayload,
          });
        }

        if (outboxEvent.eventName === SOCIAL_GRAPH_EVENT_NAMES.FOLLOW_REMOVED) {
          await this.socialGraphEventPublisher.publishFollowRemoved({
            eventId: outboxEvent.eventId,
            eventName: outboxEvent.eventName,
            eventVersion: outboxEvent.eventVersion,
            occurredAt: outboxEvent.occurredAt.toISOString(),
            producerService: outboxEvent.producerService,
            partitionKey: outboxEvent.partitionKey,
            payload: outboxEvent.payload as UnFollowCreatedPayload,
          });
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