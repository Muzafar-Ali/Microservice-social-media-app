import { PostRepository } from '../repositories/post.repository.js';
import { CreatePostDto, UpdatePostDto } from '../schema/post.schema.js';
import { Producer } from 'kafkajs';
import logger from '../utils/logger.js';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';
import { postCreatedCounter, postUpdatedCounter, postDeletedCounter } from "../monitoring/metrics.js";

export class PostService {
  constructor(
    private postRepository: PostRepository,
    private producer: Producer
  ) {}

  async createPost(input: CreatePostDto, userId: string) {

    const post = await this.postRepository.create({ ...input, authorId: userId });

    postCreatedCounter.inc(); // Increment the counter

    // In a real application, you would have more robust event publishing
    // with proper topics, schemas, and error handling.
    try {
      await this.producer.send({
        topic: 'post-events',
        messages: [
          {
            key: 'post-created',
            value: JSON.stringify(post),
          },
        ],
      });
      logger.info('Post created event sent to Kafka');
    } catch (error) {
      logger.error({error},'Failed to send post created event to Kafka');
      // Depending on the business requirements, you might want to handle this failure.
      // For example, retry sending the event, or log it for later processing.
    }

    return post;
  }

  async getPostById(id: string) {
    const postId = parseInt(id, 10);
    if (isNaN(postId)) {
      throw new ApiErrorHandler(400, 'Invalid post ID');
    }
    return this.postRepository.findById(postId);
  }

  async getAllPosts() {
    return this.postRepository.findAll();
  }

  async updatePost(input: UpdatePostDto, authorId: string) {

    const existingPost = await this.postRepository.findById(input.postId!);
    if (!existingPost) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    if (existingPost.authorId !== authorId) {
      throw new ApiErrorHandler(403, 'Forbidden');
    }

    const post = await this.postRepository.update(input.postId!, input);

    postUpdatedCounter.inc();

    try {
      await this.producer.send({
        topic: 'post-events',
        messages: [
          {
            key: 'post-updated',
            value: JSON.stringify(post),
          },
        ],
      });
      logger.info('Post updated event sent to Kafka');
    } catch (error) {
      logger.error({error},'Failed to send post updated event to Kafka');
    }

    return post;
  }

  async deletePost(id: string, userId: string) {
    const postId = parseInt(id, 10);
    if (isNaN(postId)) {
      throw new ApiErrorHandler(400, 'Invalid post ID');
    }

    const userIdNumber = parseInt(userId, 10);
    if (isNaN(userIdNumber)) {
      throw new ApiErrorHandler(400, 'Invalid user ID');
    }

    const existingPost = await this.postRepository.findById(postId);
    if (!existingPost) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    if (existingPost.userId !== userIdNumber) {
      throw new ApiErrorHandler(403, 'Forbidden');
    }

    await this.postRepository.delete(postId);

    postDeletedCounter.inc();

    try {
      await this.producer.send({
        topic: 'post-events',
        messages: [
          {
            key: 'post-deleted',
            value: JSON.stringify({ id: postId }),
          },
        ],
      });
      logger.info('Post deleted event sent to Kafka');
    } catch (error) {
      logger.error({error},'Failed to send post deleted event to Kafka');
    }
  }
}
