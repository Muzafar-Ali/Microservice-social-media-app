import { z } from "zod";
// export const createUserSchema = z.object({
//   // auth-service or gateway will send this (optional if you want auth to choose id)
//   id: z.string().cuid().optional(),
//   username: z
//     .string()
//     .min(3)
//     .max(30)
//     .regex(/^[a-zA-Z0-9_\.]+$/, "Username can only contain letters, numbers, _, .")
//     .transform((value) => value.toLowerCase().trim()),
//   name: z.string().min(1).max(100).transform((value) => value.trim()),
//   bio: z.string().max(500).optional().transform((value) => v?.trim() || undefined),
//   profileImage: z.string().url().optional(),
//   gender: z.enum(["male", "female", "other"]).optional(),
//   isPrivate: z.boolean().optional(),
// });
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
    email: z.preprocess((val) => (typeof val === 'string' ? val.trim().toLowerCase() : val), z.email({ error: "Invalid email format" })),
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
