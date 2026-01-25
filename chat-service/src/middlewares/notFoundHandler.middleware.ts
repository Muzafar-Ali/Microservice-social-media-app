import { NextFunction, Request, Response } from "express";
import ApiErrorHandler from "../utils/apiErrorHandlerClass";

const notFoundHandler = async(req: Request, res: Response, next: NextFunction) => {
  const notFound = new ApiErrorHandler(404, `Route ${req.originalUrl} not found`);
  next(notFound);
}

export default notFoundHandler;
