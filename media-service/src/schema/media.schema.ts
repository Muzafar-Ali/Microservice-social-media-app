import z from "zod";

export const profileImageUpdateSchema = z.object({
  secureUrl: z.url("secure url is required"),
  publicId: z
    .string()
    .trim()
    .min(1, "publicId is required"),
  // userId: z.coerce
  //   .number()
  //   .int()
  //   .min(1, "userId must be a positive integer")
});

// export const postVideoOrImageUpladSchema = z.object({
//   body: z.object({
//     publicId: z
//       .string()
//       .trim()
//       .min(1, "publicId is required"),
//     postId: z
//       .string()
//       .trim()
//       .min(1, "post id is required"),
//     secureUrl: z.url("secure url is required"),
//     mediaType: z.enum(["video", "image"]),
//   })
// })

export const postMediaUploadSignatureSchema = z.object({
  type: z.enum(["image", "video"]),
});

export const postMediaUploadedSchema = z.object({
  publicId: z.string().min(1, "publicId is required"),
  secureUrl: z.string().url("secureUrl must be a valid URL"),
  resourceType: z.enum(["image", "video"]),
  thumbnailUrl: z.url("Thumbnail URL must be a valid URL").optional(),
  duration: z.number().positive("Duration must be greater than 0").optional(),
  width: z.number().int().positive("Width must be greater than 0").optional(),
  height: z.number().int().positive("Height must be greater than 0").optional(),
});

export type PostMediaUploadedDto = z.infer<typeof postMediaUploadedSchema>;
export type PostMediaUploadSignatureDto = z.infer<typeof postMediaUploadSignatureSchema>;
export type ProfileImageUpdateDto = z.infer<typeof profileImageUpdateSchema>;
// export type PostVideoOrImageUploadDto = z.infer<typeof postVideoOrImageUpladSchema>
