import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware'

const app = express()

const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? "http://user-service:4001";
const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL ?? "http://media-service:4002";
const POST_SERVICE_URL = process.env.POST_SERVICE_URL ?? "http://post-service:4003";
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL ?? "http://chat-service:4004";

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "web-gateway"
  })
})

// Route: /api/user/* -> user-service/*
app.use("/api/user", createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, _req) => `/api/user${path}`,  // ✅ adds prefix back
}));


// Route: /api/auth/* -> user-service/*
app.use("/api/auth", createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path, _req) => `/api/auth${path}`,  // ✅ adds prefix back

}));


// Route: /api/media/* -> media-service/*
app.use("/api/media", createProxyMiddleware({
    target: MEDIA_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, _req) => `/api/media${path}`,  // ✅ adds prefix back
  })
);

// Route: /api/posts/* -> post-service/*
app.use("/api/posts", createProxyMiddleware({
    target: POST_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, _req) => `/api/posts${path}`,  // ✅ adds prefix back
  })
);

// Route: /api/chat/* -> chat-service/*
app.use("/api/chat", createProxyMiddleware({
    target: CHAT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, _req) => `/api/chat${path}`,  // ✅ adds prefix back
  })
);

const port = Number(process.env.PORT ?? 8088);
app.listen(port, () => {
  console.log(`[${"web-gateway"}] listening on http://localhost:${port}`);
  console.log(`  /api/auth -> ${USER_SERVICE_URL}`);
  console.log(`  /api/user -> ${USER_SERVICE_URL}`);
  console.log(`  /api/media -> ${MEDIA_SERVICE_URL}`);
  console.log(`  /api/posts -> ${POST_SERVICE_URL}`);
  console.log(`  /api/chat  -> ${CHAT_SERVICE_URL}`);
});
