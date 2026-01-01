import { NextFunction, Request, Response } from "express"
import formatZodError from "../utils/formatZodError.js";
import ApiErrorHandler from "../utils/apiErrorHanlderClass.js";
import z from "zod";

const validateRequestBody = (schema: z.ZodObject<any>) => {
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errorMessage = formatZodError(result.error);
        throw new ApiErrorHandler(400, errorMessage)
      }

      req.body = result.data.body;

    } catch (error) {
      next(error)
    }
  }
}

export default validateRequestBody;