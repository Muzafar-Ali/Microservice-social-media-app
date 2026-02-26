import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";

const notFoundHandler = async(req: Request, res: Response, next: NextFunction) => {
  const notFound = new ApiErrorHandler(StatusCodes.NOT_FOUND, `Route ${req.originalUrl} not found`);
  next(notFound);
}

export default notFoundHandler;
