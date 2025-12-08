import config from "../config/config.js";
import ApiErrorHandler from "../utils/apiErrorHanlderClass.js";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
const { JsonWebTokenError, TokenExpiredError, verify } = jwt;
const isAuthenticated = async (req, res, next) => {
    try {
        let token;
        if (req.cookies?.auth_token) {
            token = req.cookies.auth_token;
        }
        if (req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            }
        }
        if (!token) {
            throw new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Please login");
        }
        const decode = verify(token, config.jwtSecret);
        req.userId = decode.userId;
        next();
    }
    catch (error) {
        if (error instanceof TokenExpiredError) {
            return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Session expired, please login again"));
        }
        if (error instanceof JsonWebTokenError) {
            return next(new ApiErrorHandler(StatusCodes.UNAUTHORIZED, "Invalid token, please login again"));
        }
        return next(error);
    }
};
export default isAuthenticated;
