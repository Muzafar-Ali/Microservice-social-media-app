import pino from "pino";
import config from "../config/config.js";

const productionLogger = pino({
  level: config.logLevel || "info",
  base: {
    services: config.serviceName || "chat-service",
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.token",
      "req.body.refreshToken"
    ],
    censor: "[REDACTED]"
  }
})

const developmentLogger = pino({
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

const isProduction = config.environment === "production";
const logger = isProduction ? productionLogger : developmentLogger;

export default logger;