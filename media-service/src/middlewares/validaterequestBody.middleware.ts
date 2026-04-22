import { NextFunction, Request, Response } from "express";
import z from "zod";
import ApiErrorHandler from "../utils/apiErrorHandlerClass.js";
import formatZodError from "../utils/formatZodError.js";

const validateRequestBody = (schema: z.ZodObject<any>) => {
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errorMessages = formatZodError(result.error);
        throw new ApiErrorHandler(400, errorMessages)
      }

      req.body = result.data;

      next();

    } catch (error) {
      next(error)
    }
  }
}

export default validateRequestBody;