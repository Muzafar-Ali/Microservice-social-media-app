export type UserProfileCacheSummary = {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  isPrivate: boolean;
  updatedAt: Date;
};

export type PostUpdate = {
  content?: string;
  editedAt?: Date;
  isEdited?: boolean;
};
