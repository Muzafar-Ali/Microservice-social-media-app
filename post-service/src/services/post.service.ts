import { PostRepository } from '../repositories/post.repository.js';
import { CreatePostDto, UpdatePostDto } from '../schema/post.schema.js';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';
import { postCreatedCounter } from "../monitoring/metrics.js";
import { PostEventPublisher } from '../events/producer.js';

export class PostService {
  constructor(
    private postRepository: PostRepository,
    private postEventPublisher: PostEventPublisher
  ) {}

  async createPost(input: CreatePostDto, userId: string) {

    const post = await this.postRepository.create(input, userId);

    postCreatedCounter.inc(); // Increment the counter

    // Publish the event post created
    await this.postEventPublisher.publishPostCreatedEvent(post);

    return post;
  }

  async getPostById(postId: string) {
    return this.postRepository.findById(postId);
  }

  async getAllPosts(page: number, limit: number, skip: number) {
    const { posts, total } = await this.postRepository.findAllPaginated(skip, limit);

    return {
      posts, 
      meta: {
        page,
        limit,
        total, 
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + posts.length < total,
        hasPrevious: page > 1
      }
    }
  }

  async updatePost(input: UpdatePostDto, postId: string, authorId: string) {

    const existingPost = await this.postRepository.findById(postId);
    if (!existingPost) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    if (existingPost.authorId !== authorId) {
      throw new ApiErrorHandler(403, 'Forbidden');
    }

    const post = await this.postRepository.update(postId, { 
      content: input.content,
      editedAt: new Date(),
      isEdited: true 
    });

    // postUpdatedCounter.inc();

    // try {
    //   await this.producer.send({
    //     topic: 'post-events',
    //     messages: [
    //       {
    //         key: 'post-updated',
    //         value: JSON.stringify(post),
    //       },
    //     ],
    //   });
    //   logger.info('Post updated event sent to Kafka');
    // } catch (error) {
    //   logger.error({error},'Failed to send post updated event to Kafka');
    // }

    return post;
  }

  async deletePost(postId: string, userId: string) {

    const existingPost = await this.postRepository.findById(postId);
    if (!existingPost) {
      throw new ApiErrorHandler(404, 'Post not found');
    }

    if (existingPost.authorId !== userId) {
      throw new ApiErrorHandler(403, 'Forbidden');
    }

    await this.postRepository.delete(postId);

    // postDeletedCounter.inc();

    // try {
    //   await this.producer.send({
    //     topic: 'post-events',
    //     messages: [
    //       {
    //         key: 'post-deleted',
    //         value: JSON.stringify({ id: postId }),
    //       },
    //     ],
    //   });
    //   logger.info('Post deleted event sent to Kafka');
    // } catch (error) {
    //   logger.error({error},'Failed to send post deleted event to Kafka');
    // }
  }
}
