import { jest } from '@jest/globals';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { PostService } from '../../src/services/post.service.js';
import prisma from '../../src/config/prismaClient.js';
import { redis } from '../../src/config/redisClient.js';
import { createCreatePostDto } from '../factories/post.factory.js';

const postId = '550e8400-e29b-41d4-a716-446655440000';
const userId = 'user-1';
const webSessionId = 'web-session-1';
const mobileSessionId = 'mobile-session-1';

jest.mock('../../src/config/prismaClient.js', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

jest.mock('../../src/config/redisClient.js', () => ({
  __esModule: true,
  redis: {
    get: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    on: jest.fn(),
    isOpen: true,
    connect: jest.fn(),
  },
  initRedis: jest.fn(),
}));

jest.mock('../../src/repositories/post.repository.js', () => ({
  __esModule: true,
  PostRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/utils/mapUserFeedPost.js', () => ({
  __esModule: true,
  default: jest.fn((post) => post),
}));

jest.mock('../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('post routes integration', () => {
  let app: Express;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;
  const mockRedis = redis as jest.Mocked<typeof redis>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }] as never);
    mockRedis.get.mockResolvedValue(JSON.stringify({ userId }) as never);
    mockRedis.incr.mockResolvedValue(1 as never);
    mockRedis.expire.mockResolvedValue(1 as never);
    mockRedis.ttl.mockResolvedValue(60 as never);

    app = await createApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns health status without authentication', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'post-service',
    });
  });

  it('returns readiness after the database probe succeeds', async () => {
    const response = await request(app).get('/ready').expect(200);

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      status: 'ready',
      service: 'post-service',
    });
  });

  it('returns a structured 404 response for unknown routes', async () => {
    const response = await request(app).get('/api/posts/not-found/path').set('Cookie', [`sid=${webSessionId}`]).expect(404);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 404,
    });
    expect(response.body.message).toContain('not found');
  });

  it('rejects protected routes when no Redis session id is provided', async () => {
    const response = await request(app).get('/api/posts/me').expect(401);

    expect(mockRedis.get).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      success: false,
      message: 'Please login',
      statusCode: 401,
    });
  });

  it('creates a post through the real route stack for web cookie sessions', async () => {
    const createPostSpy = jest.spyOn(PostService.prototype, 'createPost').mockResolvedValue({ id: postId } as never);
    const payload = createCreatePostDto({ content: 'route-level post', media: [] });

    const response = await request(app).post('/api/posts').set('Cookie', [`sid=${webSessionId}`]).send(payload).expect(201);

    expect(mockRedis.get).toHaveBeenCalledWith(`auth:session:${webSessionId}`);
    expect(createPostSpy).toHaveBeenCalledWith(
      {
        content: 'route-level post',
        media: [],
      },
      userId,
    );
    expect(response.body).toEqual({
      success: true,
      message: 'post created successfuly',
      postId,
    });
  });

  it('supports mobile bearer sessions through the same Redis auth middleware', async () => {
    const feed = { items: [], pagination: { limit: 25, nextCursor: null, hasNextPage: false } };
    const getHomeFeedSpy = jest.spyOn(PostService.prototype, 'getHomeFeed').mockResolvedValue(feed as never);

    const response = await request(app)
      .get('/api/posts/feed/home?limit=25')
      .set('Authorization', `Bearer ${mobileSessionId}`)
      .expect(200);

    expect(mockRedis.get).toHaveBeenCalledWith(`auth:session:${mobileSessionId}`);
    expect(getHomeFeedSpy).toHaveBeenCalledWith(userId, {
      limit: 25,
      cursor: undefined,
    });
    expect(response.body).toEqual({
      success: true,
      data: feed,
    });
  });

  it('rejects invalid post create payloads before calling the service', async () => {
    const createPostSpy = jest.spyOn(PostService.prototype, 'createPost').mockResolvedValue({ id: postId } as never);

    const response = await request(app).post('/api/posts').set('Cookie', [`sid=${webSessionId}`]).send({ media: [] }).expect(400);

    expect(createPostSpy).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 400,
    });
    expect(response.body.message).toContain('Post must include either content text or at least one media item');
  });

  it('rejects invalid route params through the global error handler', async () => {
    const getPostByIdSpy = jest.spyOn(PostService.prototype, 'getPostById').mockResolvedValue({ id: postId } as never);

    const response = await request(app).get('/api/posts/not-a-uuid').set('Cookie', [`sid=${webSessionId}`]).expect(400);

    expect(getPostByIdSpy).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 400,
    });
  });

  it('rejects invalid comment bodies before calling the service', async () => {
    const createCommentSpy = jest.spyOn(PostService.prototype, 'createPostComment').mockResolvedValue({ id: 'comment-1' } as never);

    const response = await request(app)
      .post(`/api/posts/${postId}/comments`)
      .set('Cookie', [`sid=${webSessionId}`])
      .send({ content: '' })
      .expect(400);

    expect(createCommentSpy).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      success: false,
      statusCode: 400,
    });
    expect(response.body.message).toContain('Comment content is required');
  });

  it('returns 429 and Retry-After when route rate limits are exceeded', async () => {
    jest.spyOn(PostService.prototype, 'likePost').mockResolvedValue({ postId, liked: true, likesCount: 1 } as never);
    mockRedis.incr.mockResolvedValue(121 as never);
    mockRedis.ttl.mockResolvedValue(42 as never);

    const response = await request(app).post(`/api/posts/${postId}/like`).set('Cookie', [`sid=${webSessionId}`]).expect(429);

    expect(response.headers['retry-after']).toBe('42');
    expect(response.body).toMatchObject({
      success: false,
      message: 'Too many engagement requests, please slow down',
      statusCode: 429,
    });
  });
});
