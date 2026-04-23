import { z } from 'zod';

type CursorPaginationOptions = {
  defaultLimit: number;
  maxLimit: number;
  isCursorRequired?: boolean;
};

const createCursorPaginationSchema = ({ defaultLimit, maxLimit, isCursorRequired }: CursorPaginationOptions) => {
  const cursorSchema = isCursorRequired
    ? z.string().trim().min(1, 'cursor is required')
    : z.string().trim().min(1, 'cursor can not be empty').optional();

  return z.object({
    limit: z.coerce
      .number()
      .int('limit must be an integer')
      .positive('limit must be greater than 0')
      .max(maxLimit, `limit can not exceed ${maxLimit}`)
      .default(defaultLimit),
    cursor: cursorSchema,
  });
};

export default createCursorPaginationSchema;
