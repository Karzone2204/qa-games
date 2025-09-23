#!/usr/bin/env bash
set -euo pipefail

ROOT="qa-break-room"
mkdir -p "$ROOT"/{backend/src/{config,models,routes,middleware,controllers,services},frontend/src/{components/{Auth,Games,Dashboard,Admin,Layout},services,contexts,styles}}

############################
# backend package.json
############################
cat > "$ROOT/backend/package.json" <<'EOF'
{
  "name": "qa-break-room-backend",
  "version": "0.1.0",
  "type": "module",
  "main": "src/app.js",
  "scripts": {
    "dev": "node --watch src/app.js",
    "start": "node src/app.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.5.1",
    "socket.io": "^4.7.5"
  }
}
EOF

############################
# backend .env
############################
cat > "$ROOT/backend/.env" <<'EOF'
# Fill these with your Atlas cluster values
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
JWT_SECRET=replace-me
PORT=4000
CORS_ORIGIN=http://localhost:5173
ALLOWED_EMAIL_DOMAIN=innovation-group
EOF

############################
# backend config/database.js
############################
cat > "$ROOT/backend/src/config/database.js" <<'EOF'
import mongoose from "mongoose";

export async function connectDB(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("✅ MongoDB connected");
}
EOF

############################
# backend config/auth.js
############################
cat > "$ROOT/backend/src/config/auth.js" <<'EOF'
export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: "7d"
};
export const allowedEmailDomain = process.env.ALLOWED_EMAIL_DOMAIN || "innovation-group";
EOF

############################
# backend models
############################
cat > "$ROOT/backend/src/models/User.js" <<'EOF'
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  name:  { type: String, required: true },
  role:  { type: String, enum: ["user", "admin"], default: "user" },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
EOF

cat > "$ROOT/backend/src/models/Score.js" <<'EOF'
import mongoose from "mongoose";

const scoreSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  game:   { type: String, enum: ["bugSmasher", "memory", "sudoku", "tictactoe"], required: true },
  score:  { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model("Score", scoreSchema);
EOF

cat > "$ROOT/backend/src/models/Tournament.js" <<'EOF'
import mongoose from "mongoose";

const tournamentSchema = new mongoose.Schema({
  name: String,
  season: Number,
  status: { type: String, enum: ["upcoming","running","completed"], default: "upcoming" },
  game: { type: String, enum: ["bugSmasher", "memory", "sudoku", "tictactoe"], required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  results: Object
}, { timestamps: true });

export default mongoose.model("Tournament", tournamentSchema);
EOF

############################
# backend middleware
############################
cat > "$ROOT/backend/src/middleware/auth.js" <<'EOF'
import jwt from "jsonwebtoken";
import { jwtConfig, allowedEmailDomain } from "../config/auth.js";

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, jwtConfig.secret);
    // Domain enforcement
    const domain = (payload.email.split("@")[1] || "").toLowerCase();
    if (!domain.includes(allowedEmailDomain.toLowerCase())) {
      return res.status(403).json({ error: "Email domain not allowed" });
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}
EOF

cat > "$ROOT/backend/src/middleware/admin.js" <<'EOF'
import { requireAuth, requireAdmin } from "./auth.js";
export { requireAuth, requireAdmin };
EOF

############################
# backend controllers
############################
cat > "$ROOT/backend/src/controllers/authController.js" <<'EOF'
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { jwtConfig, allowedEmailDomain } from "../config/auth.js";

export async function signup(req, res) {
  try {
    const { email, name, password, inviteCode } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: "Missing fields" });
    if (!email.includes("@")) return res.status(400).json({ error: "Invalid email" });
    const domain = email.split("@")[1].toLowerCase();
    if (!domain.includes(allowedEmailDomain.toLowerCase())) {
      return res.status(403).json({ error: "Email domain not allowed" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "User exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const role = inviteCode === process.env.ADMIN_INVITE_CODE ? "admin" : "user";
    const user = await User.create({ email, name, role, passwordHash });

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
    res.json({ token, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
  } catch (e) {
    res.status(500).json({ error: "Signup failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
    res.json({ token, user: { id: user._id, email: user.email, role: user.role, name: user.name } });
  } catch (e) {
    res.status(500).json({ error: "Login failed" });
  }
}
EOF

cat > "$ROOT/backend/src/controllers/gameController.js" <<'EOF'
import Score from "../models/Score.js";

export async function submitScore(req, res) {
  const { game, score } = req.body;
  if (!game || typeof score !== "number") return res.status(400).json({ error: "Invalid payload" });
  const doc = await Score.create({ player: req.user.id, game, score });
  res.json({ ok: true, id: doc._id });
}

export async function topScores(req, res) {
  const { game } = req.query;
  const q = game ? { game } : {};
  const rows = await Score.find(q).sort({ score: -1 }).limit(20).populate("player","name email role");
  res.json(rows);
}
EOF

cat > "$ROOT/backend/src/controllers/adminController.js" <<'EOF'
let seasons = [{ number: 1, week: 1 }];
let tournaments = [];

export function getSeason(req, res){ res.json(seasons[0]); }

export function newSeason(req, res){
  const last = seasons[0];
  const next = { number: last.number + 1, week: 1 };
  seasons.unshift(next);
  res.json(next);
}

export function setWeek(req,res){
  const { week } = req.body;
  seasons[0].week = Number(week) || 1;
  res.json(seasons[0]);
}

export function createTournament(req,res){
  const { name, game } = req.body;
  const t = { id: String(Date.now()), name, game, status: "upcoming", participants: [] };
  tournaments.push(t);
  res.json(t);
}

export function listTournaments(req,res){ res.json(tournaments); }
EOF

############################
# backend routes
############################
cat > "$ROOT/backend/src/routes/auth.js" <<'EOF'
import { Router } from "express";
import { signup, login } from "../controllers/authController.js";

const r = Router();
r.post("/signup", signup);
r.post("/login",  login);
export default r;
EOF

cat > "$ROOT/backend/src/routes/games.js" <<'EOF'
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { submitScore, topScores } from "../controllers/gameController.js";

const r = Router();
r.get("/scores", requireAuth, topScores);
r.post("/scores", requireAuth, submitScore);
export default r;
EOF

cat > "$ROOT/backend/src/routes/scores.js" <<'EOF'
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { topScores } from "../controllers/gameController.js";
const r = Router();
r.get("/", requireAuth, topScores);
export default r;
EOF

cat > "$ROOT/backend/src/routes/admin.js" <<'EOF'
import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getSeason, newSeason, setWeek, createTournament, listTournaments } from "../controllers/adminController.js";

const r = Router();
r.use(requireAuth, requireAdmin);
r.get("/season", getSeason);
r.post("/season/new", newSeason);
r.post("/season/week", setWeek);
r.post("/tournaments", createTournament);
r.get("/tournaments", listTournaments);
export default r;
EOF

############################
# backend services/socketService.js
############################
cat > "$ROOT/backend/src/services/socketService.js" <<'EOF'
export function initSocket(io){
  io.on("connection", (socket) => {
    // simple broadcast for leaderboard/tournament updates if needed
    socket.on("score:new", (payload) => socket.broadcast.emit("score:refresh", payload));
  });
}
EOF

############################
# backend src/app.js
############################
cat > "$ROOT/backend/src/app.js" <<'EOF'
import "dotenv/config.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/database.js";
import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/games.js";
import adminRoutes from "./routes/admin.js";
import { initSocket } from "./services/socketService.js";

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*", credentials: true }));

app.get("/", (_req, res) => res.json({ ok: true, service: "qa-break-room-api" }));
app.use("/api/auth", authRoutes);
app.use("/api", gameRoutes);
app.use("/api/admin", adminRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN?.split(",") || "*"} });
initSocket(io);

const PORT = process.env.PORT || 4000;
connectDB(process.env.MONGODB_URI)
  .then(() => server.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`)))
  .catch((e) => { console.error("DB error", e); process.exit(1); });
EOF

############################
# frontend package.json (Vite React)
############################
cat > "$ROOT/frontend/package.json" <<'EOF'
{
  "name": "qa-break-room-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.1"
  }
}
EOF

############################
# frontend .env
############################
cat > "$ROOT/frontend/.env" <<'EOF'
VITE_API_BASE=http://localhost:4000/api
EOF

############################
# frontend vite config & index.html
############################
cat > "$ROOT/frontend/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>QA Break Room</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.js"></script>
  </body>
</html>
EOF

############################
# frontend src
############################
cat > "$ROOT/frontend/src/index.js" <<'EOF'
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(<App />);
EOF

cat > "$ROOT/frontend/src/App.jsx" <<'EOF'
import React from "react";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import Header from "./components/Layout/Header.jsx";
import Navigation from "./components/Layout/Navigation.jsx";
import GameSelector from "./components/Dashboard/GameSelector.jsx";

export default function App(){
  return (
    <AuthProvider>
      <Header />
      <Navigation />
      <div style={{padding:20}}>
        <GameSelector />
      </div>
    </AuthProvider>
  );
}
EOF

cat > "$ROOT/frontend/src/styles/global.css" <<'EOF'
/* Drop your existing theme styles here (from index.html) */
body{ margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: linear-gradient(135deg,#667eea 0%, #764ba2 100%); color:white; min-height:100vh; }
button{ cursor:pointer; }
EOF

############################
# frontend components (stubs)
############################
cat > "$ROOT/frontend/src/components/Layout/Header.jsx" <<'EOF'
import React from "react";
export default function Header(){
  return (
    <div className="main-header" style={{textAlign:"center", padding:"20px 0"}}>
      <h1>🎮 QA Break Room Ultimate 🎮</h1>
      <div className="season-banner">🏆 Season <span>1</span> - Week <span>1</span> 🏆</div>
      <p>Compete, Play, Win Tournaments!</p>
    </div>
  );
}
EOF

cat > "$ROOT/frontend/src/components/Layout/Navigation.jsx" <<'EOF'
import React from "react";
export default function Navigation(){
  return (
    <div className="nav-tabs" style={{display:"flex", gap:12, justifyContent:"center"}}>
      <div className="nav-tab active">🎮 Games</div>
      <div className="nav-tab">🏆 Tournament</div>
      <div className="nav-tab">📊 Season Stats</div>
      <div className="nav-tab">🌟 Achievements</div>
    </div>
  );
}
EOF

cat > "$ROOT/frontend/src/components/Dashboard/GameSelector.jsx" <<'EOF'
import React from "react";
export default function GameSelector(){
  return (
    <div className="game-selector" style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:20, maxWidth:1000, margin:"0 auto"}}>
      <div className="game-card"><div className="game-icon">🐛</div><h3>Bug Smasher</h3></div>
      <div className="game-card"><div className="game-icon">🧠</div><h3>Memory Match</h3></div>
      <div className="game-card"><div className="game-icon">🔢</div><h3>Sudoku Master</h3></div>
      <div className="game-card"><div className="game-icon">❌</div><h3>Tic Tac Toe</h3></div>
      <div className="game-card"><div className="game-icon">🤖</div><h3>QA Bot Chat</h3></div>
    </div>
  );
}
EOF

cat > "$ROOT/frontend/src/components/Auth/Login.jsx" <<'EOF'
import React, { useState } from "react";
import { api } from "../../services/api.js";
export default function Login(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  async function onSubmit(e){ e.preventDefault(); await api.login(email,password); }
  return (<form onSubmit={onSubmit}><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password"/><button>Login</button></form>);
}
EOF

cat > "$ROOT/frontend/src/components/Auth/Signup.jsx" <<'EOF'
import React, { useState } from "react";
import { api } from "../../services/api.js";
export default function Signup(){
  const [email,setEmail]=useState(""); const [name,setName]=useState(""); const [password,setPassword]=useState("");
  async function onSubmit(e){ e.preventDefault(); await api.signup(email,name,password); }
  return (<form onSubmit={onSubmit}><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email"/><input value={name} onChange={e=>setName(e.target.value)} placeholder="name"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password"/><button>Signup</button></form>);
}
EOF

############################
# frontend services/api.js
############################
cat > "$ROOT/frontend/src/services/api.js" <<'EOF'
const BASE = import.meta.env.VITE_API_BASE;

function token(){ return localStorage.getItem("token"); }
function setToken(t){ localStorage.setItem("token", t); }

export const api = {
  async signup(email, name, password){
    const r = await fetch(`${BASE}/auth/signup`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email, name, password }) });
    const d = await r.json(); if (d.token) setToken(d.token); return d;
  },
  async login(email, password){
    const r = await fetch(`${BASE}/auth/login`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email, password }) });
    const d = await r.json(); if (d.token) setToken(d.token); return d;
  },
  async topScores(game){
    const r = await fetch(`${BASE}/scores?game=${encodeURIComponent(game||"")}`, { headers: { Authorization: `Bearer ${token()}` }});
    return r.json();
  },
  async submitScore(game, score){
    const r = await fetch(`${BASE}/scores`, { method:"POST", headers:{ "Content-Type":"application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify({ game, score }) });
    return r.json();
  }
};
EOF

############################
# frontend contexts/AuthContext.jsx
############################
cat > "$ROOT/frontend/src/contexts/AuthContext.jsx" <<'EOF'
import React, { createContext, useContext, useState, useMemo } from "react";
import { api } from "../services/api.js";

const Ctx = createContext(null);
export function AuthProvider({ children }){
  const [user,setUser]=useState(null);
  const value = useMemo(()=>({
    user,
    async signup(email,name,password){ const d = await api.signup(email,name,password); setUser(d.user||null); },
    async login(email,password){ const d = await api.login(email,password); setUser(d.user||null); },
    logout(){ localStorage.removeItem("token"); setUser(null); }
  }),[user]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = ()=> useContext(Ctx);
EOF

############################
# docker-compose.yml
############################
cat > "$ROOT/docker-compose.yml" <<'EOF'
version: "3.9"
services:
  api:
    build: ./backend
    image: qa-break-room-api
    container_name: qa-break-room-api
    ports: ["4000:4000"]
    env_file: ./backend/.env
    restart: unless-stopped
EOF

############################
# README.md
############################
cat > "$ROOT/README.md" <<'EOF'
# QA Break Room

Minimal full-stack scaffold with RBAC (admin/user), domain lock to `innovation-group`, and game score endpoints.

## Quick start
```bash
cd backend && npm i && npm run dev
# in another terminal
cd ../frontend && npm i && npm run dev