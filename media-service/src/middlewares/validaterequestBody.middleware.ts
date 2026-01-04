import { NextFunction, Request, Response } from "express";
import z from "zod";
import ApiErrorHandler from "../utils/apiErrorHandlerClass";
import formatZodError from "../utils/formatZodError";
import { StatusCodes } from "http-status-codes";

const validateRequestBody = ( schema: z.ZodObject<any> ) => {

  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if(!result.success) {
        const errorMessages = formatZodError(result.error);
        throw new ApiErrorHandler(StatusCodes.BAD_REQUEST, errorMessages);
      }

      req.body = result.data.body;

    } catch (error) {
      next(error)
    }
  }
}

export default validateRequestBody