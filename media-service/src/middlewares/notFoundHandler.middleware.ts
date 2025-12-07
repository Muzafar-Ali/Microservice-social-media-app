import ApiErrorHandler from "@/utils/apiErrorHandlerClass"
import { NextFunction, Request, Response } from "express"

const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new ApiErrorHandler(404, `Route ${req.originalUrl} not found`));
}

export default notFoundHandler;