import { z } from "zod";


export const createUserSchema = z.object({
  // DB will generate id, so no `id` here
    // auth-service or gateway will send this (optional if you want auth to choose id)
    // id: z.string().cuid().optional(),

  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_\.]+$/, "Username can only contain letters, numbers, _, .")
    .toLowerCase(),

  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[^<>]+$/, "Name cannot contain HTML"),

  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.email({ error: "Invalid email format" })
  ),

  password: z
    .string()
    .min(1, {error: "password is required"})
    .max(128, "passsword is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),

  bio: z
    .string()
    .trim()
    .max(500)
    .regex(/^[^<>]*$/, "Bio cannot contain HTML tags")
    .optional(),

  profileImage: z
    .url({ message: "Invalid profile image URL" })
    .optional(),

  // gender: z.nativeEnum(Gender).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),

  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[^<>]+$/, "Name cannot contain HTML")
    .optional(),
  bio: z
    .string()
    .trim()
    .max(500)
    .optional(),
  profileImage: z
    .url({ message: "Invalid profile image URL" })
    .optional(),
  gender: z
    .enum(["male", "female", "other"])
    .optional(),
  isPrivate: z
    .boolean()
    .optional(),
});

export const getUserByUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toLowerCase()),
});

export const getUserByIdSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .min(1, { message: "User ID must be a positive integer" }),
});

export const bulkUserLookupSchema = z.object({
  ids: z
    .array(z.string().cuid())
    .nonempty(),
});

export const updateProfileImageSchema = z.object({
  secureUrl: z
    .url({error: "secure url is required"}),
  publicId: z
    .string()
    .min(1, {error: " public Id is not provided"})
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type GetUserByIdDto = z.infer<typeof getUserByIdSchema>;
export type GetUserByUsernameDto = z.infer<typeof getUserByUsernameSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type UpdateProfileImageDto = z.infer<typeof updateProfileImageSchema>;