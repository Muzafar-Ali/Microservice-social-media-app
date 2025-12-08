import config from "../config/config";
import pino from "pino";

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

const productionLogger = pino({
  level: config.logLevel || "info",
  base: {
    service: config.serviceName || "media-service",
  },
  redact: ["req.headers.authorization", "*.password"],
});

const isProduction = config.environment === "production";
const logger = isProduction ? productionLogger : developmentLogger;

export default logger;
