import dotenv from "dotenv";
dotenv.config();

const config = {
  port: process.env.PORT,
  environment: process.env.NODE_ENV, 
  logLevel: process.env.LOG_LEVEL,
  serviceName: process.env.SERVICE_NAME,
  // cloudinary
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY!,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET!,
  // JWT
  jwtSecret: process.env.JWT_SECRET,
  
}

export default config;