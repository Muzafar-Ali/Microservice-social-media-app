import JWT from "jsonwebtoken";
import config from "../config/config.js";
import { Response } from "express";

type UserTokenPayload = {
  userId: number;
  email: string;
  username: string
}

const JWT_SECRET = config.jwtSecret as string; 

export const generateJwtToken = (payload: UserTokenPayload) => {
  const token = JWT.sign(payload, JWT_SECRET);
  return token
}

export const generateJwtTokenAndSaveCookies = (payload: UserTokenPayload, res: Response) => {
  
  const token = generateJwtToken(payload);

  const isProduction = config.env === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/"
  })
}

export const verifyToken = (token: string) => {
  const decodedToken = JWT.verify(token, JWT_SECRET!);
  return decodedToken
}