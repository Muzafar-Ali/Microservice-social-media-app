import { NextFunction, Request, Response } from 'express';
import ApiErrorHandler from '../utils/apiErrorHanlderClass.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

const globalErrorHandler = ( err: ApiErrorHandler, req: Request, res: Response, next: NextFunction ) => {
  
  const statusCode = err.statusCode || 500;
  const message = err.message || "internal service error";

  logger.error(
    {
      statusCode,
      message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    },
    "Unhandled error"
  );

  res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    stack: config.environment === "development" ? err.stack : null,
  });
};

export default globalErrorHandler;
