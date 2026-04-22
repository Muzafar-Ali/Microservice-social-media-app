export type MediaUploadCompletedPayload = {
  userId: string;
  postId: string;
  secureUrl: string;
  publicId: string;
  mediaType: "image" | "video";
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
