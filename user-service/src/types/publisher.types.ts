export type BaseEvent<TData> = {
  eventId: string;
  eventName: string;
  eventVersion: number;
  occurredAt: string;
  producerService: string;
  partitionKey: string;
  data: TData;
};

export type UserProfileImagePayload = {
  secureUrl: string;
  publicId: string;
} | null;

export type UserCreatedPayload = {
  userId: string;
  username: string;
  displayName: string | null;
  profileImage: UserProfileImagePayload;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type UserUpdatedPayload = {
  userId: string;
  username: string;
  displayName: string | null;
  profileImage: UserProfileImagePayload;
  status: string;
  updatedAt: string;
};

export type UserCreatedEvent = BaseEvent<UserCreatedPayload>;

export type UserUpdatedEvent = BaseEvent<UserUpdatedPayload>;
