# QA Games – Architecture & How It Works

## Overview
This repo contains a small full‑stack app used by a QA team for practice and internal tooling:
- Casual games + leaderboards (seasonal)
- Admin controls (season, feature flags)
- A Chatbot integrated with LLM (Azure OpenAI or OpenAI.com) via LangChain
- A Test Case Generator (LLM backed) with an optional Playwright C# converter path on the client

---

## Authentication & Authorization
- Signup/Login endpoints: `POST /auth/signup`, `POST /auth/login`.
- Passwords: hashed with `bcryptjs` on the server.
aaw3- JWT: issued with `jsonwebtoken`; configured in `backend/src/config/auth.js`.
  - Payload includes `id`, `email`, `role`, and `name`.
  - Expiration: `7d`.
- Allowed email domain: requests are accepted only for emails under `ALLOWED_EMAIL_DOMAIN` (exact match or its subdomains). Enforced in both controller and middleware.
- Admin role: set when a valid `ADMIN_INVITE_CODE` is supplied at signup. Otherwise, role is `user`.
- Middleware:
  - `requireAuth`: validates `Authorization: Bearer <token>` and domain policy; attaches `req.user`.
  - `requireAdmin`: ensures `req.user.role === 'admin'`.

Relevant files:
- `backend/src/controllers/authController.js`
- `backend/src/middleware/auth.js`
- `backend/src/config/auth.js`

---

## Tech Stack
- Frontend: React 18 + Vite 5
  - Entry: `frontend/src/index.jsx`, main app in `frontend/src/App.jsx`
  - UI is component‑based; styles primarily in `frontend/src/styles/global.css`
- Backend: Node.js (ESM) + Express 4
  - Entry: `backend/src/app.js`
  - MongoDB via Mongoose (scores, settings, resource links)
  - Socket.IO for realtime presence/notifications (`services/socketService.js`)
  - a333333333333333333333333333333333333333333333in for LLM orchestration, OpenAI/Azure clients in `llm/clients.js`
- Middleware & libs: `cors`, `cookie-parser`, `dotenv`, `zod`, `jsonwebtoken`, `bcryptjs`

---

## Middleware & Feature Flags
- CORS: single allow‑list via `CORS_ORIGIN` env (comma‑separated). Applied to REST and Socket.IO.
- JSON body limit: `1mb`.
- Cookie parser and a simple request logger are enabled.
- Feature flags are stored in season settings and exposed to clients:
  - Public read: `GET /api/features` (auth required) returns `{ enableQATools, enableChatbot }`.
  - Admin update: `POST /api/admin/features`.
- Route guards consuming flags:
  - `requireQAToolsEnabled` on `/tools/*` routes (non‑admins blocked if flag off).
  - `requireChatbotEnabled` on `/llm/*` routes (non‑admins blocked if flag off).

Files:
- `backend/src/app.js` (CORS, routes, feature read endpoint)
- `backend/src/routes/tools.js` (QA tools + guard)
- `backend/src/routes/llm.js` (chatbot + guard)
- `backend/src/components/Admin/SeasonAdmin.jsx` (admin UI to toggle flags)

---

## Chatbot Architecture
The chatbot uses LangChain with tool calling, session memory, and Server‑Sent Events (SSE) streaming.

Data flow (high‑level):
```
[React Chatbot UI]
   ⬇ streams via fetch(SSE)
[Backend /llm/chat]  --(requireAuth + requireChatbotEnabled)-->  [--
in Chat Model]
                                   │
                                   ├─ Tools: get_app_links, qa_docs_search, confluence_search, datagen_generate_order
                                   │
                                   └─ Vector store (optional): Confluence/doc search for grounding
   ⬆ SSE tokens back to UI
```

Key details:
- Frontend (`frontend/src/components/Games/Chatbot.jsx`)
  - Opens an SSE stream to `POST /llm/chat` and incrementally renders tokens.
  - Falls back to `POST /llm/chat_sync` when streaming is interrupted.
- Backend (`backend/src/routes/llm.js`)
  - Enforces feature flag and JWT.
  - Plan phase: binds tools for the LLM to call (LangChain tools).
  - Executes any tool calls returned by the model, then composes a final concise answer.
  - Streaming endpoint writes `event: data` frames continuously; non‑streaming endpoint returns JSON.
- LLM client selection (`backend/src/llm/clients.js`)
  - If `AZURE_OPENAI_*` env vars exist: uses Azure OpenAI Chat + Embeddings deployments.
  - Else falls back to OpenAI.com with `OPENAI_API_KEY` and model names.
- Vector/RAG (optional): Confluence pages indexed into a vector store; tools `qa_docs_search` and `confluence_search` surface relevant snippets.

---

## Test Case Generator
- Endpoint: `POST /tools/testcases/generate` (JWT + `requireQAToolsEnabled`).
- Request body (validated with zod):
  - `feature` (string), optional `criteria`, `risk` (low|medium|high), `categories` array, `countPerCategory`, `detailed` (boolean), `format` (standard|gherkin).
- Implementation (`backend/src/controllers/toolsController.js`):
  - Calls `makeChatModel()` and prompts the LLM to return either:
    - Raw JSON with cases (standard mode), or
    - Plain Gherkin text (gherkin mode), sanitized to remove unwanted tags.
  - Robust post‑processing parses JSON even if the model returns extra text (fence stripping and substring extraction).
  - Normalizes cases (truncation, step shaping, summary).
- Frontend usage (`frontend/src/components/Games/Chatbot.jsx`):
  - Detects “generate test cases for <feature>” intents and calls the generator.
  - Displays a human‑readable block and caches it.
  - For Playwright C# conversion requests, it first attempts a deterministic client‑side conversion. If the format is irregular, it falls back to an LLM conversion via `/llm/chat_sync` with strict instructions to output only code.

---

## DataGen Order Tool (optional)
- Tool name: `datagen_generate_order` (LangChain tool) in `backend/src/llm/tools.js`.
- Requires PowerShell calls on the server (`DATA_GEN_ALLOW_PWSH=1`).
- Flow:
  1) Load a feed template JSON from `backend/generated/<feed>/<type>/source_*.json`.
  2) Transform payload and submit to the external gateway using feed‑specific token acquisition.
  3) Poll order list API for a matching `keyword` (e.g., last name) or fallback identifiers.
  4) Return `{ id, orderReference, link }` if found.

---

## Running Locally (PowerShell)
1) Backend
```powershell
# In backend folder
$env:PORT=3001
$env:MONGODB_URI="mongodb://localhost:27017/qa_games"
$env:JWT_SECRET="change-me"
$env:ALLOWED_EMAIL_DOMAIN="innovation.group"
# Optional: Azure/OpenAI config
# $env:AZURE_OPENAI_API_KEY="..."; $env:AZURE_OPENAI_API_INSTANCE_NAME="..."; $env:AZURE_OPENAI_API_DEPLOYMENT_NAME="gpt-4o-mini"
# Or OpenAI.com
# $env:OPENAI_API_KEY="..."; $env:OPENAI_MODEL="gpt-4o-mini"
# CORS for Vite dev server
$env:CORS_ORIGIN="http://localhost:5173"
# Optional flags
$env:SKIP_DB="0"            # set to 1 to run without Mongo features
$env:CONFLUENCE_RAG="0"     # set to 1 to auto-ground with Confluence search

npm install
npm run dev
```

2) Frontend
```powershell
# In frontend folder
$env:VITE_API_BASE="http://localhost:3001"

npm install
npm run dev
```

Notes:
- If both dev servers are running, open `http://localhost:5173`.
- Ensure MongoDB is available if `SKIP_DB` is `0`.

---

## Environment Variables (selected)
- Auth: `JWT_SECRET`, `ALLOWED_EMAIL_DOMAIN`, `ADMIN_INVITE_CODE`
- Email (SMTP): `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` (true|false), `MAIL_FROM` (sender), `APP_BASE_URL` (frontend base for reset/verify links), `EMAIL_VERIFY_ON_SIGNUP` (set to `1` to require email verification on signup)
- LLM (Azure): `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_INSTANCE_NAME`, `AZURE_OPENAI_API_DEPLOYMENT_NAME`, `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`
- LLM (OpenAI.com): `OPENAI_API_KEY`, `OPENAI_MODEL`, `EMBEDDING_MODEL`
- App: `PORT`, `CORS_ORIGIN`, `MONGODB_URI`, `SKIP_DB`, `CONFLUENCE_RAG`
- Feature toggles: stored in season config; admin UI can change them.
- DataGen (optional PowerShell path): `DATA_GEN_ALLOW_PWSH`, various `DATA_GEN_*` settings

---

## Admin: Season & Feature Controls
- Season Control: toggle auto season (calendar month), apply season override, reset season/all‑time scores with safety checks.
- Feature Control: toggles visibility for non‑admin users of QA Tools and Chatbot. Admins always see all.
- UI: `frontend/src/components/Admin/SeasonAdmin.jsx` (heading centered; features listed vertically with clear spacing).

---

## Request Flow Examples
- Login
  - Client: `POST /auth/login` -> stores `token` in `localStorage`.
  - Subsequent API calls add `Authorization: Bearer <token>`.
- Chatbot ask
  - Client: `POST /llm/chat` (SSE) with `messages[]` -> streamed tokens.
  - If stream fails -> `POST /llm/chat_sync` for a one‑shot response.
- Generate test cases
  - Client: `POST /tools/testcases/generate` with feature/risk/etc. -> structured JSON -> formatted in UI.

---

## Diagrams
High‑level components:
```
[React (Vite)]  --HTTP-->  [Express API]  --Mongoose-->  [MongoDB]
       |                          |
       |                          ├-- LangChain -> (Azure OpenAI | OpenAI)
       |                          └-- Socket.IO
```

Chatbot flow with tools:
```
User ➜ React Chatbot ➜ /llm/chat (SSE)
   ➜ LangChain Chat Model
       ├─ get_app_links (Mongo)
       ├─ qa_docs_search (Vector)
       ├─ confluence_search (Vector)
       └─ datagen_generate_order (PowerShell path)
   ➜ Response tokens ➜ UI
```

---

## Email Flows: Quick Local Test (PowerShell)
1) Backend
```powershell
cd backend
npm install
$env:PORT=3001
$env:MONGODB_URI="mongodb://localhost:27017/qa_games"
$env:JWT_SECRET="dev-secret"
$env:ALLOWED_EMAIL_DOMAIN="innovation.group"
$env:CORS_ORIGIN="http://localhost:5173"
$env:APP_BASE_URL="http://localhost:5173"
# Optional SMTP (if omitted, emails are logged to console)
# $env:SMTP_HOST="smtp.example.com"
# $env:SMTP_PORT="587"
# $env:SMTP_USER="apikey"
# $env:SMTP_PASS="<password>"
# $env:MAIL_FROM="QA Games <no-reply@example.com>"
# Require verification on signup (optional)
$env:EMAIL_VERIFY_ON_SIGNUP="1"
npm run dev
```

2) Frontend
```powershell
cd frontend
npm install
npm run dev
```

3) Test
- Signup with an allowed-domain email. If `EMAIL_VERIFY_ON_SIGNUP=1`, a verification email/link is sent. If SMTP isn’t configured, the link is printed in the backend logs.
- Use “Forgot password” in the login modal to trigger a reset email. The reset link is also printed to logs when SMTP is not set.
