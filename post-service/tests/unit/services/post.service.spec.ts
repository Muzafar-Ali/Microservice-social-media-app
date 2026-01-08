import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PostRepository } from "../../../src/repositories/post.repository";
import { PostService } from "../../../src/services/post.service";
import { PostEventPublisher } from "../../../src/events/producer";
import { postCreatedCounter } from "../../../src/monitoring/metrics";
import { buildPost } from "../../helper/post.factory";

// Optional: mock metrics so it doesn't touch real Prometheus objects
jest.mock("../../../src/monitoring/metrics", () => ({
  __esModule: true,
  postCreatedCounter: { inc: jest.fn() },
}));

describe("PostService", () => {
  let postService: PostService;
  let mockPostRepository: DeepMockProxy<PostRepository>;
  let mockPostEventPublisher: DeepMockProxy<PostEventPublisher>;

  beforeEach(() => {
    mockPostRepository = mockDeep<PostRepository>();
    mockPostEventPublisher = mockDeep<PostEventPublisher>();

    postService = new PostService(mockPostRepository, mockPostEventPublisher);
  });

  describe("createPost", () => {

    it("should create post, increase metric, and publish event", async () => {
      const input = {
        content: "Hello world",
        media: [],
      };
  
      const userId = "user-1";
  
      const createdPost = {
        id: "post-1",
        content: "Hello world",
        authorId: userId,
        editedAt: null,
        isEdited: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        media: [],
      };
  
      mockPostRepository.create.mockResolvedValue(createdPost as any);
      mockPostEventPublisher.publishPostCreatedEvent.mockResolvedValue(undefined);
  
      const result = await postService.createPost(input as any, userId);
  
      expect(mockPostRepository.create).toHaveBeenCalledWith(input, userId);
      expect(mockPostEventPublisher.publishPostCreatedEvent).toHaveBeenCalledWith(createdPost);
      expect(postCreatedCounter.inc).toHaveBeenCalledTimes(1);
      expect(result).toBe(createdPost);
    });
  })

  describe("getPostById", () => {

    it("Should get post by id", async () => {
  
      const postId = "ckzq1wq9b0001l8x0abcd123";
      const post = {
      id: postId,
        authorId: "ckzq1user0001l8x0user123",
        content: "Post with multiple media types for Jest testing",
        media: [
          {
            id: "ckzq1media0001l8x0media1",
            postId,
            type: "IMAGE",
            url: "https://cdn.example.com/images/post-image-1.jpg",
            width: 1080,
            height: 1350,
            order: 0,
          },
          {
            id: "ckzq1media0002l8x0media2",
            postId,
            type: "VIDEO",
            url: "https://cdn.example.com/videos/post-video-1.mp4",
            thumbnailUrl: "https://cdn.example.com/thumbnails/video-thumb-1.jpg",
            duration: 30,
            width: 1280,
            height: 720,
            order: 1,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
  
      mockPostRepository.findById.mockResolvedValue(post as any);
      const result = await postService.getPostById(postId);
  
      expect(mockPostRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockPostRepository.findById).toHaveBeenCalledWith(postId);
      expect(result).toBe(post);
    })
  })

  describe("getAllPosts", () => {

    it("should fetch all posts", async () => {
      const postId = "ckzq1wq9b0001l8x0abcd123";
      const page = 1;
      const limit = 50;
      const skip = (page - 1 ) * limit;
  
      const posts = [
        {
          id: postId,
          authorId: "ckzq1user0001l8x0user123",
          content: "Post with multiple media types for Jest testing",
          media: [
            {
              id: "ckzq1media0001l8x0media1",
              postId,
              type: "IMAGE",
              url: "https://cdn.example.com/images/post-image-1.jpg",
              width: 1080,
              height: 1350,
              order: 0,
            },
            {
              id: "ckzq1media0002l8x0media2",
              postId,
              type: "VIDEO",
              url: "https://cdn.example.com/videos/post-video-1.mp4",
              thumbnailUrl: "https://cdn.example.com/thumbnails/video-thumb-1.jpg",
              duration: 30,
              width: 1280,
              height: 720,
              order: 1,
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
  
      mockPostRepository.findAllPaginated.mockResolvedValue({ posts, total: 1 } as any);
      
      const resutl = await postService.getAllPosts(page, limit, skip)
  
      expect(mockPostRepository.findAllPaginated).toHaveBeenCalledWith(skip, limit);
      expect(mockPostRepository.findAllPaginated).toHaveBeenCalledTimes(1);
      expect(resutl).toEqual({
        posts,
        meta: {
          page,
          limit,
          total: 1, 
          totalPages: 1,
          hasNextPage: false,
          hasPrevious: false
        }
      })
  
    });
  })

  describe("updatePost", () => {

    const post = buildPost();

    // post not exist (Failure)
    it("should throw 404 if post does not exist", async () => {
      mockPostRepository.findById.mockResolvedValue(null);

      await expect( 
        postService.updatePost( { postId: "fake-postId", content: "updated" }, "fake-postId", post.authorId)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Post not found",
      });

      expect(mockPostRepository.update).not.toHaveBeenCalled();
    });

    // if user not found (Failure)
    it("should throw 403 if user is not the author", async () => {
      
      mockPostRepository.findById.mockResolvedValue(post as any);
      
      await expect (
        postService.updatePost({ postId: post.id, content: post.content}, post.id, "fake-author")
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Forbidden"
      });

      expect(mockPostRepository.update).not.toHaveBeenCalled();
    });

    // success call
    it("should update the post", async () => {
      mockPostRepository.findById.mockResolvedValue(post as any);
      mockPostRepository.update.mockResolvedValue(post as any);

      const result = await postService.updatePost(
        { 
          postId: post.id, 
          content: post.content 
        },
        post.id,
        post.authorId
      );

      expect(mockPostRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockPostRepository.findById).toHaveBeenCalledWith(post.id);

      expect(mockPostRepository.update).toHaveBeenCalledTimes(1);
      expect(mockPostRepository.update).toHaveBeenCalledWith(post.id, {
        content: post.content,
        editedAt: expect.any(Date),
        isEdited: true,
      });

      expect(result).toBe(post);
    });

  })

  describe("deletePost", () => {
    
    const post = buildPost();

    // post not exist (Failure)
    it("should throw 404 if post does not exist", async () => {
      mockPostRepository.findById.mockResolvedValue(null);

      await expect(postService.deletePost(post.id, post.authorId)).rejects.toMatchObject({
        statusCode: 404,
        message: "Post not found",
      });

      expect(mockPostRepository.delete).not.toHaveBeenCalled();
    });

    // if user not found (Failure)
    it("should throw 403 if user is not the author", async () => {
      mockPostRepository.findById.mockResolvedValue(post as any);
      
      await expect (postService.deletePost(post.id, "fake-author")).rejects.toMatchObject({
        statusCode: 403,
        message: "Forbidden"
      });

      expect(mockPostRepository.delete).not.toHaveBeenCalled();
    });

    it("should delete the post", async () => {
      mockPostRepository.findById.mockResolvedValue(post as any);
      mockPostRepository.delete.mockResolvedValue(undefined as any);

      await expect(postService.deletePost(post.id, post.authorId)).resolves.toBeUndefined();

      expect(mockPostRepository.findById).toHaveBeenCalledWith(post.id);
      expect(mockPostRepository.findById).toHaveBeenCalledTimes(1);
      
      expect(mockPostRepository.delete).toHaveBeenCalledWith(post.id);
      expect(mockPostRepository.delete).toHaveBeenCalledTimes(1);

    })
  })

});
