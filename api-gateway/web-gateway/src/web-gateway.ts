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
    service: "mobile-gateway"
  })
})

// Route: /api/users/* -> user-service/*
app.use("/api/user", createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { "^/api/users": "" },
}));

// Route: /api/media/* -> media-service/*
app.use("/api/media", createProxyMiddleware({
    target: MEDIA_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/media": "" },
  })
);

// Route: /api/posts/* -> post-service/*
app.use("/api/posts", createProxyMiddleware({
    target: POST_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/posts": "" },
  })
);

// Route: /api/chat/* -> chat-service/*
app.use("/api/chat", createProxyMiddleware({
    target: CHAT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/chat": "" },
  })
);

const port = Number(process.env.PORT ?? 8088);
app.listen(port, () => {
  console.log(`[${"web-gateway"}] listening on http://localhost:${port}`);
  console.log(`  /api/users -> ${USER_SERVICE_URL}`);
  console.log(`  /api/media -> ${MEDIA_SERVICE_URL}`);
  console.log(`  /api/posts -> ${POST_SERVICE_URL}`);
  console.log(`  /api/chat  -> ${CHAT_SERVICE_URL}`);
});
