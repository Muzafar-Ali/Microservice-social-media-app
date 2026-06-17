import { MediaType } from '../../src/generated/prisma/enums.js';

export const testCreatedAt = new Date('2026-01-01T10:00:00.000Z');
export const testUpdatedAt = new Date('2026-01-02T10:00:00.000Z');

export const createProfileCache = (overrides: Record<string, unknown> = {}) => ({
  userId: 'author-1',
  username: 'author_one',
  displayName: 'Author One',
  avatarUrl: 'https://cdn.example.com/avatar.jpg',
  status: 'active',
  isPrivate: false,
  updatedAt: testUpdatedAt,
  ...overrides,
});

export const createFeedPost = (overrides: Record<string, unknown> = {}) => ({
  id: 'post-1',
  authorId: 'author-1',
  content: 'Hello world',
  themeKey: null,
  isEdited: false,
  createdAt: testCreatedAt,
  updatedAt: testUpdatedAt,
  media: [],
  _count: {
    media: 0,
    likes: 0,
    comments: 0,
  },
  ...overrides,
});

export const createImageMedia = (overrides: Record<string, unknown> = {}) => ({
  id: 'media-1',
  type: MediaType.IMAGE,
  url: 'https://cdn.example.com/image.jpg',
  thumbnailUrl: null,
  duration: null,
  width: 1080,
  height: 1350,
  order: 0,
  ...overrides,
});

export const createVideoMedia = (overrides: Record<string, unknown> = {}) => ({
  id: 'media-2',
  type: MediaType.VIDEO,
  url: 'https://cdn.example.com/video.mp4',
  thumbnailUrl: 'https://cdn.example.com/video-thumb.jpg',
  duration: 30,
  width: 1280,
  height: 720,
  order: 0,
  ...overrides,
});

export const createComment = (overrides: Record<string, unknown> = {}) => ({
  id: 'comment-1',
  postId: 'post-1',
  authorId: 'comment-author',
  content: 'Nice post',
  createdAt: testCreatedAt,
  updatedAt: testUpdatedAt,
  ...overrides,
});

export const createImagePostMediaDto = (overrides: Record<string, unknown> = {}) => ({
  type: 'image',
  url: 'https://res.cloudinary.com/demo/image/upload/social-media-app/posts/images/post.jpg',
  publicId: 'social-media-app/posts/images/post',
  width: 1080,
  height: 1350,
  ...overrides,
});

export const createVideoPostMediaDto = (overrides: Record<string, unknown> = {}) => ({
  type: 'video',
  url: 'https://res.cloudinary.com/demo/video/upload/social-media-app/posts/videos/post.mp4',
  publicId: 'social-media-app/posts/videos/post',
  thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/social-media-app/posts/videos/post-thumb.jpg',
  duration: 30,
  width: 1280,
  height: 720,
  ...overrides,
});

export const createCreatePostDto = (overrides: Record<string, unknown> = {}) => ({
  content: 'Launch post',
  media: [],
  ...overrides,
});

export const createUpdatePostDto = (overrides: Record<string, unknown> = {}) => ({
  content: 'Updated caption',
  ...overrides,
});
