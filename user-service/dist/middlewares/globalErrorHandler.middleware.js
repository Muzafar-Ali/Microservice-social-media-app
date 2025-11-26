import config from "../config/config.js";
const globalErrorHandler = async (err, req, res, next) => {
    err.message = err.message || "internal service error";
    err.statusCode = err.statusCode || 500;
    res.status(err.statusCode).json({
        success: false,
        message: err.message,
        statusCode: err.statusCode,
        stack: config.env === 'development' ? err.stack : null
    });
};
export default globalErrorHandler;
