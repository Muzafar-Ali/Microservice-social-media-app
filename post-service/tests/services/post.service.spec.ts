import { mockDeep, DeepMockProxy } from "jest-mock-extended";
import { PostRepository } from "../../src/repositories/post.repository";
import { PostService } from "../../src/services/post.service";
import { PostEventPublisher } from "../../src/events/producer";
import { postCreatedCounter } from "../../src/monitoring/metrics";

// Optional: mock metrics so it doesn't touch real Prometheus objects
jest.mock("../../src/monitoring/metrics", () => ({
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
    expect(postCreatedCounter.inc).toHaveBeenCalledWith(1)
    expect(result).toBe(createdPost);
  });

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

  it("should fetch all posts", () => {
    
  })
});
