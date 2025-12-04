import z from "zod";
export const userLoginSchema = z.object({
    username: z
        .string()
        .trim()
        .min(1)
        .max(30)
        .regex(/^[a-zA-Z0-9_\.]+$/, "Username can only contain letters, numbers, _, .")
        .optional(),
    email: z.preprocess((val) => (typeof val === 'string' ? val.trim().toLowerCase() : val), z.email({ error: "Invalid email format" })).optional(),
    password: z
        .string()
        .min(1, { error: "must provide password" })
        .max(32, { error: "password can not excced 6 charachters long" })
}).refine((data) => data.username || data.email, {
    message: "Either username or email is required",
    path: ["username"], // where to attach the error
});
