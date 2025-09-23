import "dotenv/config.js";
// TLS/SSL handling for corporate environments
// - USE_WIN_CA=1: load Windows root store into Node (fixes corporate MITM certs)
// - EMAIL_TLS_INSECURE=1: disable TLS verification (DEV ONLY)
if (process.platform === 'win32') {
  try {
    if (process.env.USE_WIN_CA === '1') {
      await import('win-ca');
      console.log('[TLS] Loaded Windows root certificates via win-ca');
    }
  } catch (e) {
    console.warn('[TLS] Failed to load win-ca:', e?.message || e);
  }
}
if (process.env.EMAIL_TLS_INSECURE === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[TLS] WARNING: TLS verification disabled (EMAIL_TLS_INSECURE=1). Use for DEV only.');
}

// Proxy support for outbound HTTPS (e.g., SendGrid) in corporate environments
try {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    const { bootstrap } = await import('global-agent');
    process.env.GLOBAL_AGENT_HTTP_PROXY = proxyUrl;
    bootstrap();
    console.log('[Proxy] Enabled global proxy via global-agent');
  }
} catch (e) {
  // Non-fatal if global-agent is not installed
}
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/database.js";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import llmRoutes from "./routes/llm.js";
import toolsRoutes from "./routes/tools.js";
import gameRoutes from "./routes/games.js";
import scoresRoutes from "./routes/scores.js";
import dataGenRoutes from "./routes/dataGen.js";
import adminRoutes from "./routes/admin.js";
import { initSocket } from "./services/socketService.js";
import { getSeasonConfig } from "./services/seasonService.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

// Snapshot key DataGen env variables at startup (sanitized) to confirm loading
const dgEnvSnapshot = {
  DATA_GEN_TEST_TOKEN_URL: process.env.DATA_GEN_TEST_TOKEN_URL ? 'set' : 'missing',
  DATA_GEN_TEST_SCOPE: process.env.DATA_GEN_TEST_SCOPE ? 'set' : 'missing',
  DATA_GEN_TEST_CLIENT_ID: process.env.DATA_GEN_TEST_CLIENT_ID ? 'set' : 'missing',
  DATA_GEN_TEST_CLIENT_SECRET: process.env.DATA_GEN_TEST_CLIENT_SECRET ? '***' : 'missing',
  DATA_GEN_TEST_MULTI_URL: process.env.DATA_GEN_TEST_MULTI_URL ? 'set' : 'missing',
  DATA_GEN_TEST_BUSINESS_REGION: process.env.DATA_GEN_TEST_BUSINESS_REGION || null,
  DATA_GEN_CA_FILE: process.env.DATA_GEN_CA_FILE || null,
  DATA_GEN_DEBUG_OUTBOUND: process.env.DATA_GEN_DEBUG_OUTBOUND || '0',
  DATA_GEN_DEBUG_TLS: process.env.DATA_GEN_DEBUG_TLS || '0'
};
console.log('[Startup] DataGen env snapshot:', dgEnvSnapshot);

// Email env snapshot for quick diagnostics
const emailEnvSnapshot = {
  SENDGRID_API_KEY_set: !!process.env.SENDGRID_API_KEY,
  MAIL_FROM: process.env.MAIL_FROM || null,
};
console.log('[Startup] Email env snapshot:', emailEnvSnapshot);

// Validate environments for DataGen (warn about placeholders)
function warnIfPlaceholder(name, val){
  if(!val) return;
  if(/example\/token/.test(val) || /dev-multi\.example/.test(val) || /uat-multi\.example/.test(val)){
    console.warn(`[Startup][DataGen] WARNING: ${name} appears to be a placeholder: ${val}`);
  }
}
warnIfPlaceholder('DATA_GEN_DEV_TOKEN_URL', process.env.DATA_GEN_DEV_TOKEN_URL);
warnIfPlaceholder('DATA_GEN_TEST_TOKEN_URL', process.env.DATA_GEN_TEST_TOKEN_URL);
warnIfPlaceholder('DATA_GEN_UAT_TOKEN_URL', process.env.DATA_GEN_UAT_TOKEN_URL);
warnIfPlaceholder('DATA_GEN_DEV_MULTI_URL', process.env.DATA_GEN_DEV_MULTI_URL);
warnIfPlaceholder('DATA_GEN_TEST_MULTI_URL', process.env.DATA_GEN_TEST_MULTI_URL);
warnIfPlaceholder('DATA_GEN_UAT_MULTI_URL', process.env.DATA_GEN_UAT_MULTI_URL);
if(process.env.DATA_GEN_DEBUG_OUTBOUND === '1'){
  console.log('[Startup][DataGen] Outbound debug ENABLED');
}

// ---- CORS configuration (single source of truth) ----
const allowList = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / server-to-server
    if (allowList.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(express.json({ limit: "1mb" }));

// Preflight early response
app.options("*", cors(corsOptions));
// Apply CORS globally
app.use(cors(corsOptions));

// Expose headers optionally
app.use((req, res, next) => {
  res.setHeader("Access-Control-Expose-Headers", "*");
  next();
});

// Lightweight request logger (can be toggled off later)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.json({ ok: true, dbConnected });
});

// Authenticated read-only feature flags for clients
app.get("/api/features", requireAuth, async (_req, res) => {
  try {
    const cfg = await getSeasonConfig();
    res.json({ enableQATools: !!cfg.enableQATools, enableChatbot: !!cfg.enableChatbot });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'failed' });
  }
});

// ✅ Mount API routes
app.use("/auth", authRoutes);
app.use("/llm", llmRoutes);
app.use("/tools", toolsRoutes);
app.use("/datagen", dataGenRoutes);
app.use("/scores", scoresRoutes);

app.use(cookieParser());
app.get("/", (_req, res) => res.json({ ok: true, service: "qa-break-room-api" }));
app.use("/api/auth", authRoutes);
app.use("/api", gameRoutes);
app.use("/api/admin", adminRoutes);
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowList, credentials: true } });
initSocket(io);
const PORT = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if(process.env.SKIP_DB === '1'){
  console.warn('[Startup] SKIP_DB=1 set – skipping Mongo connection (DataGen-only mode).');
  server.listen(PORT, () => console.log(`🚀 API (no DB) http://localhost:${PORT}`));
} else {
  if (!mongoUri) {
    console.error("DB error Missing MONGODB_URI (or MONGO_URI) environment variable. Set it in a .env file or your environment. (Set SKIP_DB=1 to bypass for DataGen debug)");
    process.exit(1);
  }
  connectDB(mongoUri)
    .then(() => server.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`)))
    .catch((e) => { console.error("DB error", e); process.exit(1); });
}

  
export default app;