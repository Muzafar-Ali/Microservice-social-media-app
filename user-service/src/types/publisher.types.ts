export type BaseEvent<TData> = {
  eventId: string;
  eventName: string;
  eventVersion: number;
  occurredAt: string;
  producerService: string;
  partitionKey: string;
  data: TData;
};

export type UserCreatedPayload = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: {
    secureUrl: string;
    publicId: string;
  } | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type UserCreatedEvent = BaseEvent<UserCreatedPayload>;
