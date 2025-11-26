import client from "prom-client";
// Registry that holds all metrics
export const register = new client.Registry();
// Collect default Node.js / process metrics
client.collectDefaultMetrics({ register });
// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDuration);
// Optional: business metric for users created
export const userCreatedCounter = new client.Counter({
    name: "user_created_total",
    help: "Total number of users successfully created",
});
register.registerMetric(userCreatedCounter);
// Middleware to measure every request
export const metricsMiddleware = (req, res, next) => {
    const end = httpRequestDuration.startTimer();
    res.on("finish", () => {
        end({
            method: req.method,
            route: (req.route && req.route.path) || req.path,
            status_code: res.statusCode,
        });
    });
    next();
};
// /metrics handler for Prometheus
export const metricsHandler = async (_req, res) => {
    res.set("Content-Type", register.contentType);
    res.send(await register.metrics());
};
