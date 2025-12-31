import z from "zod";

export const profileImageUpdateSchema = z.object({
  body: z.object({
    secureUrl: z.url("secure url is required"),
    publicId: z
      .string()
      .trim()
      .min(1, "publicId is required"),
    // userId: z.coerce
    //   .number()
    //   .int()
    //   .min(1, "userId must be a positive integer")
  })
});

export const postVideoOrImageUpladSchema = z.object({
  body: z.object({
    publicId: z
      .string()
      .trim()
      .min(1, "publicId is required"),
    postId: z
      .string()
      .trim()
      .min(1, "post id is required"),
    secureUrl: z.url("secure url is required"),
    mediaType: z.enum(["video", "image"]),
  })
})

export type ProfileImageUpdateDto = z.infer<typeof profileImageUpdateSchema>;
export type PostVideoOrImageUploadDto = z.infer<typeof postVideoOrImageUpladSchema>