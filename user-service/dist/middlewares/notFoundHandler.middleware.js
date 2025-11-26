import ApiErrorHandler from "../utils/apiErrorHanlderClass.js";
const notFoundHandler = async (req, res, next) => {
    const notFound = new ApiErrorHandler(404, `Route ${req.originalUrl} not found`);
    next(notFound);
};
export default notFoundHandler;
