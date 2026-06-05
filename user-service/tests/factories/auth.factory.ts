export const createUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'user@example.com',
  username: 'testuser',
  password: 'hashed-password',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createLoginContext = (overrides = {}) => ({
  identifier: 'user@example.com',
  ip: '127.0.0.1',
  userAgent: 'jest',
  ...overrides,
});

export const createUserLoginDto = (overrides = {}) => ({
  email: 'user@example.com',
  password: 'password123',
  ...overrides,
});

export const createForgotPasswordDto = (overrides = {}) => ({
  email: 'user@example.com',
  ...overrides,
});

export const createResetPasswordDto = (overrides = {}) => ({
  token: 'reset-token',
  password: 'NewPassword123!',
  ...overrides,
});

export const createChangePasswordDto = (overrides = {}) => ({
  currentPassword: 'CurrentPassword123!',
  newPassword: 'NewPassword123!',
  ...overrides,
});

export const createSessionInput = (overrides = {}) => ({
  userId: 'user-1',
  ip: '127.0.0.1',
  userAgent: 'jest-agent',
  deviceName: 'Chrome on Windows',
  ...overrides,
});

export const createSession = (overrides = {}) => ({
  id: 'session-123',
  userId: 'user-1',
  deviceName: 'Chrome on Windows',
  userAgent: 'jest-agent',
  refreshTokenHash: 'hashed-token',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  ...overrides,
});