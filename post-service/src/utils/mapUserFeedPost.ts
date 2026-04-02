import { UserFeedPost } from "../prisma/selects/userFeedPostSelect.js";
import { MediaType } from '../generated/prisma/client.js';

const mapUserFeedPost = (post: UserFeedPost) => {
  return {
    id: post.id,
    authorId: post.authorId,
    content: post.content,
    themeKey: post.themeKey ?? null,
    mediaCount: post._count.media,
    likesCount: post._count.likes,
    commentsCount: post._count.comments,
    isEdited: post.isEdited,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    media: post.media.map((mediaItem: any) => ({
      id: mediaItem.id,
      type: mediaItem.type === MediaType.IMAGE ? "image" : "video",
      url: mediaItem.url,
      thumbnailUrl: mediaItem.thumbnailUrl ?? null,
      duration: mediaItem.duration ?? null,
      width: mediaItem.width ?? null,
      height: mediaItem.height ?? null,
      order: mediaItem.order,
    })),
  };
}

export default mapUserFeedPost;