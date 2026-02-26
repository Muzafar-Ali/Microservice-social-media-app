import client from "prom-client";
import { Request, Response, NextFunction } from "express";

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics();

const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = httpRequestDurationMs.startTimer();

  res.on("finish", () => {
    // Express route may be undefined for 404 routes
    const route = (req.route?.path as string) || req.path;
    end({ method: req.method, route, status_code: String(res.statusCode) });
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
}