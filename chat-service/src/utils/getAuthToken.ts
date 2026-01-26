import { Request } from "express";

const getAuthToken = (req: Request): string | null => {
  // 1️⃣ Priority: Authorization header (Mobile apps, Postman, API clients)
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  // 2️⃣ Fallback: Cookies (Web browsers)
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token;
  }

  return null;
};

export default getAuthToken;