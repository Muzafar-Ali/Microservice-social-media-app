import { FollowStatus } from '../generated/prisma/enums.js';

export type BaseEvent<TData> = {
  eventId: string;
  eventName: string;
  eventVersion: number;
  occurredAt: string;
  producerService: string;
  partitionKey: string;
  data: TData;
};

export type PublishSocialGraphEventInput<TPayload> = {
  eventId: string;
  eventName: string;
  eventVersion: number;
  occurredAt: string;
  producerService: string;
  partitionKey: string;
  payload: TPayload;
};

export type FollowCreatedPayload = {
  followerId: string;
  followeeId: string;
  status: FollowStatus;
  createdAt: string;
};

export type UnFollowCreatedPayload = {
  followerId: string;
  followeeId: string;
  removedAt: string;
};

export type FollowCreatedEvent = BaseEvent<FollowCreatedPayload>;
export type UnFollowCreatedEvent = BaseEvent<UnFollowCreatedPayload>;