import { NextFunction, Request, Response } from 'express';
import { Role } from '../generated/prisma/client.js';
import prisma from '../config/prismaClient.js';
import ApiErrorHandler from '../utils/apiErrorHandlerClass.js';

const requireRole = (...allowedRoles: Role[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          role: true,
          status: true,
        },
      });

      if (!user) {
        throw new ApiErrorHandler(401, 'Unauthorized');
      }

      if (user.status !== 'ACTIVE') {
        throw new ApiErrorHandler(403, 'Account is not active');
      }

      if (!allowedRoles.includes(user.role)) {
        throw new ApiErrorHandler(403, 'Insufficient permissions');
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

export default requireRole;
