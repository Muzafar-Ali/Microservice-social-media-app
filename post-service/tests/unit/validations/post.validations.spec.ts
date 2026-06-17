import {
  createPostCommentSchema,
  createPostSchema,
  feedAfterQuerySchema,
  feedWindowQuerySchema,
  homeFeedAfterQuerySchema,
  homeFeedBeforeQuerySchema,
  homeFeedQuerySchema,
  postIdParamsSchema,
  postMediaItemSchema,
  updatePostSchema,
} from '../../../src/validation/post.validation.js';
import { createImagePostMediaDto, createVideoPostMediaDto } from '../../factories/post.factory.js';

const imageMedia = createImagePostMediaDto();
const videoMedia = createVideoPostMediaDto();

const expectInvalid = (result: { success: boolean }) => {
  expect(result.success).toBe(false);
};

describe('post validation schemas', () => {
  describe('postMediaItemSchema', () => {
    it('accepts valid image media from the post image folder', () => {
      const result = postMediaItemSchema.safeParse(imageMedia);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(imageMedia);
      }
    });

    it('accepts valid video media only when thumbnail is provided', () => {
      const result = postMediaItemSchema.safeParse(videoMedia);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.thumbnailUrl).toBe(videoMedia.thumbnailUrl);
      }
    });

    it('rejects non-HTTPS media URLs', () => {
      const result = postMediaItemSchema.safeParse({
        ...imageMedia,
        url: 'http://cdn.example.com/post.jpg',
      });

      expectInvalid(result);
    });

    it('rejects non-HTTPS thumbnails', () => {
      const result = postMediaItemSchema.safeParse({
        ...videoMedia,
        thumbnailUrl: 'http://cdn.example.com/thumb.jpg',
      });

      expectInvalid(result);
    });

    it('rejects image public IDs outside the allowed image folder', () => {
      const result = postMediaItemSchema.safeParse({
        ...imageMedia,
        publicId: 'social-media-app/users/avatar',
      });

      expectInvalid(result);
    });

    it('rejects video public IDs outside the allowed video folder', () => {
      const result = postMediaItemSchema.safeParse({
        ...videoMedia,
        publicId: 'social-media-app/posts/images/not-video',
      });

      expectInvalid(result);
    });

    it('rejects duration on image media', () => {
      const result = postMediaItemSchema.safeParse({
        ...imageMedia,
        duration: 10,
      });

      expectInvalid(result);
    });

    it('rejects video media without a thumbnail', () => {
      const { thumbnailUrl, ...videoWithoutThumbnail } = videoMedia;

      const result = postMediaItemSchema.safeParse(videoWithoutThumbnail);

      expectInvalid(result);
    });
  });

  describe('createPostSchema', () => {
    it('accepts text-only posts and trims content', () => {
      const result = createPostSchema.safeParse({
        content: '  hello world  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          content: 'hello world',
          media: [],
        });
      }
    });

    it('accepts media-only posts', () => {
      const result = createPostSchema.safeParse({
        media: [imageMedia],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.media).toHaveLength(1);
      }
    });

    it('accepts text-only themed posts', () => {
      const result = createPostSchema.safeParse({
        content: 'Mood of the day',
        themeKey: 'sunset',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.themeKey).toBe('sunset');
      }
    });

    it('rejects empty posts with no text and no media', () => {
      const result = createPostSchema.safeParse({
        content: '   ',
      });

      expectInvalid(result);
    });

    it('rejects themeKey when media is attached', () => {
      const result = createPostSchema.safeParse({
        content: 'caption',
        themeKey: 'sunset',
        media: [imageMedia],
      });

      expectInvalid(result);
    });

    it('rejects more than five media items', () => {
      const result = createPostSchema.safeParse({
        media: Array.from({ length: 6 }, (_, index) => ({
          ...imageMedia,
          publicId: `social-media-app/posts/images/post-${index}`,
        })),
      });

      expectInvalid(result);
    });

    it('rejects content longer than 2200 characters', () => {
      const result = createPostSchema.safeParse({
        content: 'a'.repeat(2201),
      });

      expectInvalid(result);
    });
  });

  describe('updatePostSchema', () => {
    it('accepts content updates and trims content', () => {
      const result = updatePostSchema.safeParse({
        content: '  updated caption  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('updated caption');
      }
    });

    it('rejects empty update payloads', () => {
      const result = updatePostSchema.safeParse({});

      expectInvalid(result);
    });

    it('rejects content longer than 2200 characters', () => {
      const result = updatePostSchema.safeParse({
        content: 'a'.repeat(2201),
      });

      expectInvalid(result);
    });
  });

  describe('comment and params schemas', () => {
    it('accepts valid post UUID params', () => {
      const result = postIdParamsSchema.safeParse({
        postId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid post UUID params', () => {
      const result = postIdParamsSchema.safeParse({
        postId: 'not-a-uuid',
      });

      expectInvalid(result);
    });

    it('accepts valid comments and trims content', () => {
      const result = createPostCommentSchema.safeParse({
        content: '  nice post  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('nice post');
      }
    });

    it('rejects empty comments', () => {
      const result = createPostCommentSchema.safeParse({
        content: '   ',
      });

      expectInvalid(result);
    });

    it('rejects comments longer than 1000 characters', () => {
      const result = createPostCommentSchema.safeParse({
        content: 'a'.repeat(1001),
      });

      expectInvalid(result);
    });
  });

  describe('feed query schemas', () => {
    it('defaults home feed limit and accepts optional cursor', () => {
      const result = homeFeedQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ limit: 20 });
      }
    });

    it.each([
      ['home', homeFeedQuerySchema, { limit: '51' }],
      ['home before', homeFeedBeforeQuerySchema, { cursor: 'post-1', limit: '51' }],
      ['home after', homeFeedAfterQuerySchema, { cursor: 'post-1', limit: '51' }],
      ['feed window', feedWindowQuerySchema, { postId: 'post-1', limit: '21' }],
      ['feed after', feedAfterQuerySchema, { cursor: 'post-1', limit: '21' }],
    ])('rejects excessive %s limits', (_name, schema, payload) => {
      const result = schema.safeParse(payload);

      expectInvalid(result);
    });

    it.each([
      ['home before', homeFeedBeforeQuerySchema, { limit: '10' }],
      ['home after', homeFeedAfterQuerySchema, { limit: '10' }],
      ['feed window', feedWindowQuerySchema, { limit: '10' }],
      ['feed after', feedAfterQuerySchema, { limit: '10' }],
    ])('requires cursor or anchor for %s query', (_name, schema, payload) => {
      const result = schema.safeParse(payload);

      expectInvalid(result);
    });

    it('coerces valid feed window limits', () => {
      const result = feedWindowQuerySchema.safeParse({
        postId: 'post-1',
        limit: '15',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(15);
      }
    });
  });
});
