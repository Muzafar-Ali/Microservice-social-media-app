// src/monitoring/metrics.ts
import { Request, Response, NextFunction } from "express";
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

// Optional: business metric for posts created
export const postCreatedCounter = new client.Counter({
  name: "post_created_total",
  help: "Total number of posts successfully created",
});

register.registerMetric(postCreatedCounter);

// Middleware to measure every request
export const metricsMiddleware = ( req: Request, res: Response, next: NextFunction ) => {
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
export const metricsHandler = async (_req: Request, res: Response) => {
  res.set("Content-Type", register.contentType);
  res.send(await register.metrics());
};
