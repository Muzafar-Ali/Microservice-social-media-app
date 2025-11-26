import { NextFunction, Request, Response } from "express";
import ApiErrorHandler from "../utils/apiErrorHanlderClass.js";
import config from "../config/config.js";

const globalErrorHandler = async(err: ApiErrorHandler, req: Request, res: Response, next: NextFunction) => {
  
  err.message = err.message || "internal service error"
  err.statusCode = err.statusCode || 500

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
    statusCode: err.statusCode,
    stack: config.env === 'development' ? err.stack : null
  })
}

export default globalErrorHandler;