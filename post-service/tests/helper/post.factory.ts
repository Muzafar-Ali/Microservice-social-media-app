export const buildPost = (overrides: Partial<any> = {}) => {
  const postId = overrides.id ?? "ckzq1wq9b0001l8x0abcd123";
  const authorId = overrides.authorId ?? "ckzq1user0001l8x0user123";

  return {
    id: postId,
    authorId,
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
    ...overrides,
  };
};
