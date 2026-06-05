import z from 'zod';

export const passwordSchema = z
  .string()
  .min(1, { error: 'password is required' })
  .max(128, 'password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const userLoginSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(/^[a-zA-Z0-9_.]+$/, 'Username can only contain letters, numbers, _, .')
      .optional(),

    email: z
      .preprocess(
        (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
        z.email({ error: 'Invalid email format' }),
      )
      .optional(),

    password: z
      .string()
      .min(1, { error: 'must provide password' })
      .max(128, { error: 'password can not exceed 128 characters long' }),
  })
  .refine((data) => data.username || data.email, {
    message: 'Either username or email is required',
    path: ['username'], // where to attach the error
  });

export const forgotPasswordSchema = z.object({
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
    z.email({ error: 'Invalid email format' }),
  ),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32, { error: 'reset token is required' }),
  password: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'current password is required' }).max(128),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'new password must be different from current password',
    path: ['newPassword'],
  });

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1, { error: 'sessionId is required' }),
});

export type UserLoginDto = z.infer<typeof userLoginSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type SessionIdParamDto = z.infer<typeof sessionIdParamSchema>;
