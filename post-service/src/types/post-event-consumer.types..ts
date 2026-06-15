export type MediaUploadCompletedPayload = {
  userId: string;
  postId: string;
  secureUrl: string;
  publicId: string;
  mediaType: 'image' | 'video';
};

export type FailedMessageContext = {
  topic: string;
  partition: number;
  offset: string;
  rawValue: string;
  reason: string;
};

export type MediaDeletedPayload = {
  postId: string;
  mediaId: string;
};

export type ActiveFollowEventName = 'follow.created' | 'follow.accepted' | 'follow.removed';

export type ApplyActiveFollowEventInput = {
  eventId: string;
  eventName: ActiveFollowEventName;
  followerId: string;
  followeeId: string;
  occurredAt: Date;
};
