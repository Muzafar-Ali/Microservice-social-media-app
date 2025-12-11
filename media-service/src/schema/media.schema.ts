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

export type ProfileImageUpdateDto = z.infer<typeof profileImageUpdateSchema>;