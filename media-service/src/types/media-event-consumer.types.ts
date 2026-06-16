export type FailedMessageContext = {
  topic: string;
  partition: number;
  offset: string;
  rawValue: string;
  reason: string;
};

export type PostDeletedMediaItem = {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  publicId: string | null;
};
