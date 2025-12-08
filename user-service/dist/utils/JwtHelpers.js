import JWT from "jsonwebtoken";
import config from "../config/config.js";
const JWT_SECRET = config.jwtSecret;
export const generateJwtToken = (payload) => {
    const token = JWT.sign(payload, JWT_SECRET);
    return token;
};
export const generateJwtTokenAndSaveCookies = (payload, res) => {
    const token = generateJwtToken(payload);
    const isProduction = config.environment === "production";
    res.cookie("auth_token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/"
    });
};
export const verifyToken = (token) => {
    const decodedToken = JWT.verify(token, JWT_SECRET);
    return decodedToken;
};
