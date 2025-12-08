import config from "../config/config";
import ApiErrorHandler from "../utils/apiErrorHandlerClass";
import { NextFunction, Request, Response } from "express"
import { StatusCodes } from "http-status-codes";
import { JsonWebTokenError, JwtPayload, TokenExpiredError, verify } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

interface UserToken extends JwtPayload {
  username: string,
  userId: string,

}

const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;

    if(req.cookies.token) {
      token = req.cookies.token;
    }

    if(req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if(authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if(!token) {
      throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login")
    }

    const decode = verify(token, config.jwtSecret!) as UserToken


    req.userId = decode.userId
    
    next();

  } catch (error) {
    if( error instanceof TokenExpiredError) {
      return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Session expired, please login again"))
    }

    if( error instanceof JsonWebTokenError) {
      return next( new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Invalid token, please login again"))
    }

    return next(error)
  }
}

export default isAuthenticated;