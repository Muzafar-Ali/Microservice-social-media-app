export type PostCreatedEventPayload = {
  postId: string;
  authorId: string;
  content: string;
  themeKey: string | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  media: Array<{
    id: string;
    type: "IMAGE" | "VIDEO";
    url: string;
    publicId: string | null;
    thumbnailUrl: string | null;
    duration: number | null;
    width: number | null;
    height: number | null;
    order: number;
  }>;
};