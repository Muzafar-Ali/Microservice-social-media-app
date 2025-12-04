import logger from '../utils/logger.js';
import config from '../config/config.js';
const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "internal service error";
    logger.error({
        statusCode,
        message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
    }, "Unhandled error");
    res.status(statusCode).json({
        success: false,
        message,
        statusCode,
        stack: config.env === "development" ? err.stack : null,
    });
};
export default globalErrorHandler;
