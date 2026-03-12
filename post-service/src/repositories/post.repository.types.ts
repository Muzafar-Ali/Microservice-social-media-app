import { Prisma } from "../generated/prisma";

export const userGridPostSelect = {
  id: true,
  authorId: true,
  content: true,
  themeKey: true,
  createdAt: true,
  _count: {
    select: {
      media: true,
      likes: true,
      comments: true,
    },
  },
  media: {
    orderBy: {
      order: "asc" as const,
    },
    take: 1,
    select: {
      type: true,
      url: true,
      thumbnailUrl: true,
      width: true,
      height: true,
    },
  },
} satisfies Prisma.PostSelect;

export type UserGridPost = Prisma.PostGetPayload<{
  select: typeof userGridPostSelect;
}>;

export type PostUpdate = {
  content?: string;
  editedAt?: Date;
  isEdited?: boolean;
}
