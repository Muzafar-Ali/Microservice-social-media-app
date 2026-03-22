import { Prisma } from '../../generated/prisma/client.js';

export const userFeedPostSelect = {
  id: true,
  authorId: true,
  content: true,
  themeKey: true,
  isEdited: true,
  createdAt: true,
  updatedAt: true,
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
    select: {
      id: true,
      type: true,
      url: true,
      thumbnailUrl: true,
      duration: true,
      width: true,
      height: true,
      order: true,
    },
  },
} satisfies Prisma.PostSelect;

export type UserFeedPost = Prisma.PostGetPayload<{
  select: typeof userFeedPostSelect;
}>;