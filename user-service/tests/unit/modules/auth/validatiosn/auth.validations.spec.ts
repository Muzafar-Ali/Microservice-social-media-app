import {
  changePasswordSchema,
  forgotPasswordSchema,
  passwordSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  userLoginSchema,
} from '../../../../../src/modules/auth/auth.validations.js';

describe('userLoginSchema', () => {
  it('accepts email and password login and normalizes email', () => {
    const result = userLoginSchema.safeParse({
      email: '  USER@Example.COM  ',
      password: 'password123',
    });

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.data).toEqual({
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('accepts username and password login', () => {
    const result = userLoginSchema.safeParse({
      username: 'testuser1',
      password: 'password123',
    });

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.data).toEqual({
      username: 'testuser1',
      password: 'password123',
    });
  });

  it('rejects login when both email and username are missing', () => {
    const result = userLoginSchema.safeParse({
      password: 'password123',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Either username or email is required');
  });

  it('rejects invalid email format', () => {
    const result = userLoginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toContain('email');
  });

  it('rejects empty password', () => {
    const result = userLoginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toContain('password');
  });

  it('rejects password longer than 128 characters', () => {
    const result = userLoginSchema.safeParse({
      email: 'user@example.com',
      password: 'a'.repeat(129),
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('password can not exceed 128 characters long');
  });

  it('rejects empty login payload', () => {
    const result = userLoginSchema.safeParse({});

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it('rejects non-string login email', () => {
    const result = userLoginSchema.safeParse({
      email: 123,
      password: 'password123',
    });

    expect(result.success).toBe(false);
  });

  it('rejects username with invalid characters', () => {
    const result = userLoginSchema.safeParse({
      username: 'test$user',
      password: 'password123',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Username can only contain letters, numbers, _, .');
  });

  it('rejects username longer than 30 characters', () => {
    const result = userLoginSchema.safeParse({
      username: 'a'.repeat(31),
      password: 'password123',
    });

    expect(result.success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a valid password', () => {
    const result = passwordSchema.safeParse('Password123@');

    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = passwordSchema.safeParse('');

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('password is required');
  });

  it('rejects password longer than 128 characters', () => {
    const result = passwordSchema.safeParse('Password123@'.repeat(12));

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('password is too long');
  });

  it('rejects password without uppercase letter', () => {
    const result = passwordSchema.safeParse('password123@');

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Password must contain at least one uppercase letter');
  });

  it('rejects password without lowercase letter', () => {
    const result = passwordSchema.safeParse('PASSWORD123@');

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Password must contain at least one lowercase letter');
  });

  it('rejects password without number', () => {
    const result = passwordSchema.safeParse('Password@');

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Password must contain at least one number');
  });

  it('rejects password without special character', () => {
    const result = passwordSchema.safeParse('Password123');

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Password must contain at least one special character');
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email and normalizes it', () => {
    const result = forgotPasswordSchema.safeParse({
      email: '  USER@Example.COM  ',
    });

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.data).toEqual({
      email: 'user@example.com',
    });
  });

  it('rejects invalid email format', () => {
    const result = forgotPasswordSchema.safeParse({
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Invalid email format');
  });

  it('rejects non-string forgot password email', () => {
    const result = forgotPasswordSchema.safeParse({
      email: 123,
    });

    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid reset token and strong password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'a'.repeat(32),
      password: 'Password123@',
    });

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.data).toEqual({
      token: 'a'.repeat(32),
      password: 'Password123@',
    });
  });

  it('rejects reset token shorter than 32 characters', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'short-token',
      password: 'Password123@',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('reset token is required');
  });

  it('rejects weak reset password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'a'.repeat(32),
      password: 'password123',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Password must contain at least one uppercase letter');
  });
});

describe('changePasswordSchema', () => {
  it('accepts current password and valid new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldPassword123',
      newPassword: 'NewPassword123@',
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'NewPassword123@',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('current password is required');
  });

  it('rejects weak new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldPassword123',
      newPassword: 'newpassword123',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('Password must contain at least one uppercase letter');
  });

  it('rejects when new password is same as current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'SamePassword123@',
      newPassword: 'SamePassword123@',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('new password must be different from current password');
  });
});

describe('sessionIdParamSchema', () => {
  it('accepts valid session id', () => {
    const result = sessionIdParamSchema.safeParse({
      sessionId: 'session_123',
    });

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.data).toEqual({
      sessionId: 'session_123',
    });
  });

  it('rejects empty session id', () => {
    const result = sessionIdParamSchema.safeParse({
      sessionId: '',
    });

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.issues[0]?.message).toBe('sessionId is required');
  });
});
