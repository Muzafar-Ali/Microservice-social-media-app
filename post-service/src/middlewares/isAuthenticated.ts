import config from "../config/config.js";
import ApiErrorHandler from "../utils/apiErrorHanlderClass.js";
import { NextFunction, Request, Response } from "express"
import { StatusCodes } from "http-status-codes"; // This dependency needs to be added
import jwt,  { JwtPayload } from "jsonwebtoken";

const { JsonWebTokenError, TokenExpiredError, verify } = jwt;

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

    if (req.cookies?.auth_token) {
      token = req.cookies.auth_token;
    }
    
    if(req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if(authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if(!token) {
      throw new ApiErrorHandler(401, "Please login") // Using 401 directly
    }

    if (!config.jwtSecret) {
      throw new ApiErrorHandler(500, "JWT secret is not configured");
    }

    const decode = verify(token, config.jwtSecret) as UserToken


    req.userId = decode.userId
    
    next();

  } catch (error) {
    if( error instanceof TokenExpiredError) {
      return next(new ApiErrorHandler(401, "Session expired, please login again")) // Using 401
    }

    if( error instanceof JsonWebTokenError) {
      return next( new ApiErrorHandler(401, "Invalid token, please login again")) // Using 401
    }

    return next(error)
  }
}

export default isAuthenticated;
