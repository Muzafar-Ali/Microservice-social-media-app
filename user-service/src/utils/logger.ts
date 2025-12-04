import pino from 'pino';
import config from "../config/config.js";

const isProduction = config.env === "production";

const logger = isProduction ? 
    pino({
      level: config.logLevel || "info",
      base: { service: config.serviceName || "auth-service" },
      redact: ["req.headers.authorization", "*.password"],
    }) : 
    pino({
      level: "debug",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:dd-mm-yyyy HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    });

export default logger;
