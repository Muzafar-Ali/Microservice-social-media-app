import { NextFunction, Request, Response } from "express";
import ApiErrorHandler from "../utils/apiErrorHandlerClass";
import config from "../config/config";

const globalErrorHandler = async (err: ApiErrorHandler, req: Request, res: Response, next: NextFunction) => {

  const statusCode = err.statusCode || 500;
  const message = err.message || "internal server error";
  
  res.status(statusCode).json({
    success: false,
    message,
    statusCode,
    stack: config.environment === "development" ? err.stack : null
  });
}

export default globalErrorHandler;