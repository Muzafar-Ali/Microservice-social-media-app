import z from 'zod';

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export const profileImageUpdateSchema = z.object({
  secureUrl: z.url('secure url is required'),
  publicId: z.string().trim().min(1, 'publicId is required'),
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
  type: z.enum(['image', 'video']),
});

export const postMediaUploadedSchema = z.object({
  publicId: z.string().min(1, 'publicId is required'),
  secureUrl: z.url('secureUrl must be a valid URL'),
  resourceType: z.enum(['image', 'video']),
  bytes: z.number().int().positive('bytes must be greater than 0'),
  format: z.string().trim().min(1, 'format is required'),
  thumbnailUrl: z.url('Thumbnail URL must be a valid URL').optional(),
  duration: z.number().positive('Duration must be greater than 0').optional(),
  width: z.number().int().positive('Width must be greater than 0'),
  height: z.number().int().positive('Height must be greater than 0'),
}).superRefine((media, ctx) => {
  const maxBytes = media.resourceType === 'image' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;

  if (media.bytes > maxBytes) {
    ctx.addIssue({
      code: 'custom',
      path: ['bytes'],
      message: media.resourceType === 'image' ? 'Image must not exceed 10 MB' : 'Video must not exceed 100 MB',
    });
  }

  if (media.resourceType === 'video') {
    if (!media.thumbnailUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['thumbnailUrl'],
        message: 'Video uploads require a thumbnail URL',
      });
    }

    if (!media.duration) {
      ctx.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'Video uploads require duration',
      });
    }
  }
});

export type PostMediaUploadedDto = z.infer<typeof postMediaUploadedSchema>;
export type PostMediaUploadSignatureDto = z.infer<typeof postMediaUploadSignatureSchema>;
export type ProfileImageUpdateDto = z.infer<typeof profileImageUpdateSchema>;
// export type PostVideoOrImageUploadDto = z.infer<typeof postVideoOrImageUpladSchema>
