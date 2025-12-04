import {
  createUserSchema,
  updateUserSchema,
  getUserByUsernameSchema,
  getUserByIdSchema,
  bulkUserLookupSchema,
} from '../../src/schema/user.schema';

describe('createUserSchema', () => {
  // Test case for valid user creation data
  it('should validate a valid user creation payload', () => {
    const validUser = {
      username: 'testuser123',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'This is a test bio.',
      profileImage: 'https://example.com/image.jpg',
      gender: 'male',
    };
    const result = createUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  // Test case for minimum required fields
  it('should validate with only required fields', () => {
    const minimalUser = {
      username: 'minuser',
      name: 'Min User',
      email: 'min@example.com',
    };
    const result = createUserSchema.safeParse(minimalUser);
    expect(result.success).toBe(true);
  });

  // Test case for invalid username - too short
  it('should invalidate if username is too short', () => {
    const invalidUser = {
      username: 'ab', // Too short
      name: 'Test User',
      email: 'test@example.com',
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid username - too long
  it('should invalidate if username is too long', () => {
    const invalidUser = {
      username: 'averylongusernameindeedthatistoolongforthisfield', // Too long
      name: 'Test User',
      email: 'test@example.com',
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid username - invalid characters
  it('should invalidate if username contains invalid characters', () => {
    const invalidUser = {
      username: 'test user', // Contains space
      name: 'Test User',
      email: 'test@example.com',
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid name - too short
  it('should invalidate if name is too short', () => {
    const invalidUser = {
      username: 'testuser',
      name: '', // Too short
      email: 'test@example.com',
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid name - too long
  it('should invalidate if name is too long', () => {
    const invalidUser = {
      username: 'testuser',
      name: 'a'.repeat(101), // Too long
      email: 'test@example.com',
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid name - contains HTML
  it('should invalidate if name contains HTML tags', () => {
    const invalidUser = {
      username: 'testuser',
      name: '<h1>Test User</h1>',
      email: 'test@example.com',
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid email format
  it('should invalidate if email format is incorrect', () => {
    const invalidUser = {
      username: 'testuser',
      name: 'Test User',
      email: 'invalid-email', // Invalid format
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it('should invalidate if email is not a string', () => {
    const invalidUser = {
      username: 'testuser',
      name: 'Test User',
      email: 123 as any, // Non-string
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });


  // Test case for invalid bio - too long
  it('should invalidate if bio is too long', () => {
    const invalidUser = {
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      bio: 'a'.repeat(501), // Too long
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid bio - contains HTML
  it('should invalidate if bio contains HTML tags', () => {
    const invalidUser = {
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      bio: '<script>alert("xss")</script>',
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid profileImage URL
  it('should invalidate if profileImage is not a valid URL', () => {
    const invalidUser = {
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      profileImage: 'not-a-url', // Invalid URL
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for invalid gender enum
  it('should invalidate if gender is not one of the allowed values', () => {
    const invalidUser = {
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      gender: 'unknown', // Invalid enum value
    };
    const result = createUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  // Test case for username transformation (toLowerCase, trim)
  it('should transform username to lowercase and trim whitespace', () => {
    const result = createUserSchema.safeParse({
      username: '  TestUser  ',
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('testuser');
    }
  });

  // Test case for name transformation (trim)
  it('should trim whitespace from name', () => {
    const result = createUserSchema.safeParse({
      username: 'testuser',
      name: '  Test User Name  ',
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test User Name');
    }
  });

  // Test case for email transformation (toLowerCase, trim)
  it('should transform email to lowercase and trim whitespace', () => {
    const result = createUserSchema.safeParse({
      username: 'testuser',
      name: 'Test User',
      email: '  TEST@EXAMPLE.COM  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
    }
  });
  
  // Test case for email transformation (toLowerCase, trim)
  it('should invalidate an email without @', () => {
      const result = createUserSchema.safeParse({
        username: 'testuser',
        name: 'Test User',
        email: 'invalidemail.com',
      });
    expect(result.success).toBe(false)
  })

  // Test case for bio transformation (trim)
  it('should trim whitespace from bio if provided', () => {
    const result = createUserSchema.safeParse({
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      bio: '  A trimmed bio  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bio).toBe('A trimmed bio');
    }
  });

  // Test case for isActive default value
  it('should set isActive to true by default if not provided', () => {
    const result = createUserSchema.safeParse({
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });
});

describe('updateUserSchema', () => {
  // Test case for valid update data
  it('should validate a valid user update payload', () => {
    const validUpdate = {
      name: 'Updated Name',
      bio: 'Updated bio content.',
      profileImage: 'https://example.com/new_image.png',
      gender: 'female',
      isPrivate: true,
    };
    const result = updateUserSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  // Test case for partial update
  it('should validate a partial update payload', () => {
    const partialUpdate = {
      name: 'Only Name Change',
    };
    const result = updateUserSchema.safeParse(partialUpdate);
    expect(result.success).toBe(true);
  });

  // Test case for invalid name - too short
  it('should invalidate if updated name is too short', () => {
    const invalidUpdate = {
      name: '',
    };
    const result = updateUserSchema.safeParse(invalidUpdate);
    expect(result.success).toBe(false);
  });

  // Test case for invalid name - contains HTML
  it('should invalidate if updated name contains HTML tags', () => {
    const invalidUpdate = {
      name: '<script>alert("xss")</script>',
    };
    const result = updateUserSchema.safeParse(invalidUpdate);
    expect(result.success).toBe(false);
  });

  // Test case for invalid bio - too long
  it('should invalidate if updated bio is too long', () => {
    const invalidUpdate = {
      bio: 'a'.repeat(501),
    };
    const result = updateUserSchema.safeParse(invalidUpdate);
    expect(result.success).toBe(false);
  });

  // Test case for invalid profileImage URL
  it('should invalidate if updated profileImage is not a valid URL', () => {
    const invalidUpdate = {
      profileImage: 'not-a-url-again',
    };
    const result = updateUserSchema.safeParse(invalidUpdate);
    expect(result.success).toBe(false);
  });

  // Test case for invalid gender enum
  it('should invalidate if updated gender is not one of the allowed values', () => {
    const invalidUpdate = {
      gender: 'alien',
    };
    const result = updateUserSchema.safeParse(invalidUpdate);
    expect(result.success).toBe(false);
  });
});

describe('getUserByUsernameSchema', () => {
  // Test case for valid username lookup
  it('should validate a valid username lookup payload', () => {
    const validLookup = {
      username: 'validusername',
    };
    const result = getUserByUsernameSchema.safeParse(validLookup);
    expect(result.success).toBe(true);
  });

  // Test case for username transformation (toLowerCase, trim)
  it('should transform username to lowercase and trim whitespace', () => {
    const result = getUserByUsernameSchema.safeParse({
      username: '  ValidUserNAME  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('validusername');
    }
  });

  // Test case for invalid username - too short (empty)
  it('should invalidate if username is empty', () => {
    const invalidLookup = {
      username: '',
    };
    const result = getUserByUsernameSchema.safeParse(invalidLookup);
    expect(result.success).toBe(false);
  });
});

describe('getUserByIdSchema', () => {
  // Test case for valid ID lookup
  it('should validate a valid user ID lookup payload', () => {
    const validLookup = {
      id: 123,
    };
    const result = getUserByIdSchema.safeParse(validLookup);
    expect(result.success).toBe(true);
  });

  // Test case for ID as string (coercion)
  it('should coerce string ID to number', () => {
    const result = getUserByIdSchema.safeParse({
      id: '456',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(456);
    }
  });

  // Test case for invalid ID - not a number
  it('should invalidate if ID is not a number', () => {
    const invalidLookup = {
      id: 'abc',
    };
    const result = getUserByIdSchema.safeParse(invalidLookup);
    expect(result.success).toBe(false);
  });

  // Test case for invalid ID - empty
  it('should invalidate if ID is empty', () => {
    const invalidLookup = {
      id: '',
    };
    const result = getUserByIdSchema.safeParse(invalidLookup);
    expect(result.success).toBe(false);
  });
});

describe('bulkUserLookupSchema', () => {
  // Test case for valid bulk ID lookup
  it('should validate a valid bulk user ID lookup payload', () => {
    const validLookup = {
      ids: ['clq0d0d0d0d0d0d0d0d0d0d0d', 'clq0d0d0d0d0d0d0d0d0d0d0e'],
    };
    const result = bulkUserLookupSchema.safeParse(validLookup);
    expect(result.success).toBe(true);
  });

  // Test case for invalid bulk ID lookup - empty array
  it('should invalidate if ids array is empty', () => {
    const invalidLookup = {
      ids: [],
    };
    const result = bulkUserLookupSchema.safeParse(invalidLookup);
    expect(result.success).toBe(false);
  });

  // Test case for invalid bulk ID lookup - invalid cuid
  it('should invalidate if an ID in the array is not a valid cuid', () => {
    const invalidLookup = {
      ids: ['clq0d0d0d0d0d0d0d0d0d0d0d', 'not-a-cuid'],
    };
    const result = bulkUserLookupSchema.safeParse(invalidLookup);
    expect(result.success).toBe(false);
  });
});
