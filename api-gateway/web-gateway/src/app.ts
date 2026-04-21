import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware'
import config from './config/config.js';

const app = express()

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "web-gateway"
  })
})

// Route: /api/user/* -> user-service/*
app.use("/api/user", createProxyMiddleware({
  target: config.userServiceUrl,
  changeOrigin: true,
  pathRewrite: (path, _req) => `/api/user${path}`,  // ✅ adds prefix back
}));


// Route: /api/auth/* -> user-service/*
app.use("/api/auth", createProxyMiddleware({
  target: config.userServiceUrl,
  changeOrigin: true,
  pathRewrite: (path, _req) => `/api/auth${path}`,  // ✅ adds prefix back

}));

// Route: /api/media/* -> media-service/*
app.use("/api/media", createProxyMiddleware({
    target: config.mediaServiceUrl,
    changeOrigin: true,
    pathRewrite: (path, _req) => `/api/media${path}`,  // ✅ adds prefix back
  })
);

// Route: /api/posts/* -> post-service/*
app.use(
  "/api/posts",
  createProxyMiddleware({
    target: config.postServiceLUrl,
    changeOrigin: true,
    pathRewrite: (path) => `/api/posts${path}`,
    on: {
      proxyReq: (proxyReq, req: any) => {
        console.log(
          `[web-gateway] proxy req ${req.method} ${req.originalUrl} -> ${config.postServiceLUrl}${proxyReq.path}`
        );
      },
      error: (err, req, res: any) => {
        console.error(
          `[web-gateway] proxy error for ${req.method} ${req.originalUrl}`,
          {
            message: err.message,
            code: (err as NodeJS.ErrnoException).code,
            stack: err.stack,
            target: config.postServiceLUrl,
          }
        );

        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
        }

        res.end(
          JSON.stringify({
            success: false,
            message: "post-service proxy failed",
            error: err.message,
            code: (err as NodeJS.ErrnoException).code ?? "UNKNOWN",
          })
        );
      },
    },
  })
);

// Route: /api/chat/* -> chat-service/*
app.use("/api/chat", createProxyMiddleware({
    target: config.chatServiceUrl,
    changeOrigin: true,
    pathRewrite: (path, _req) => `/api/chat${path}`,  // ✅ adds prefix back
  })
);

// Route: /api/social-graph/* -> social graph service/*
app.use("/api/social-graph", createProxyMiddleware({
    target: config.socialGraphServiceUrl,
    changeOrigin: true,
    pathRewrite: (path, _req) => `/api/social-graph${path}`,  // ✅ adds prefix back
  })
);

const port = Number(process.env.PORT ?? 8088);


const server = app.listen(port, () => {
  console.log(`[web-gateway] listening on http://localhost:${port}`);
  console.log(`  /api/auth  -> ${config.userServiceUrl}`);
  console.log(`  /api/user  -> ${config.userServiceUrl}`);
  console.log(`  /api/media -> ${config.mediaServiceUrl}`);
  console.log(`  /api/posts -> ${config.postServiceLUrl}`);
  console.log(`  /api/chat  -> ${config.chatServiceUrl}`);
  console.log(`  /api/social-graph  -> ${config.socialGraphServiceUrl}`);
});

// Graceful shutdown
function gracefulShutdown(signal: string) {
  console.log(`[web-gateway] ${signal} received. Shutting down gracefully...`);

  // Stop accepting new connections, finish in-flight requests
  server.close(() => {
    console.log("[web-gateway] All connections closed. Exiting.");
    process.exit(0);
  });

  // Force exit if something is stuck
  setTimeout(() => {
    console.error("[web-gateway] Force shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

// Handle Kubernetes + local shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Kubernetes / docker stop
process.on("SIGINT", () => gracefulShutdown("SIGINT"));   // Ctrl+C