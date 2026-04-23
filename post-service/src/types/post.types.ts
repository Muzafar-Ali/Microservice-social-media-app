export type UserProfileCacheSummary = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  updatedAt: Date;
};

export type PostUpdate = {
  content?: string;
  editedAt?: Date;
  isEdited?: boolean;
};
