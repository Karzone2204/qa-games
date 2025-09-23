import { Router } from "express";
import { makeChatModel } from "../llm/clients.js";
import { requireAuth } from "../middleware/auth.js";
import { getSeasonConfig } from "../services/seasonService.js";
import { getAppLinksTool, qaDocsSearchTool, unscrambleTool, confluenceSearchTool, dataGenGenerateOrderTool } from "../llm/tools.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

import { loadVectorStore } from "../llm/vector.js";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

function toLCMessages(arr = []) {
  const out = [];
  for (const m of arr) {
    if (!m?.role || typeof m.content !== "string") continue;
    if (m.role === "user") out.push(new HumanMessage(m.content));
    else if (m.role === "assistant") out.push(new AIMessage(m.content));
    else if (m.role === "system") out.push(new SystemMessage(m.content));
  }
  return out;
}

const router = Router();

async function requireChatbotEnabled(req, res, next){
  const cfg = await getSeasonConfig();
  if (!cfg.enableChatbot && req.user?.role !== 'admin') {
    return res.status(403).json({ error: "Chatbot is disabled by admin" });
  }
  next();
}

// Simple per-session memory (in-memory map)
const sessions = new Map();
function getHistory(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, new InMemoryChatMessageHistory());
  return sessions.get(sessionId);
}

// Wrap tool defs for LangChain
function toStructuredTool(def) {
  return tool(def.func, {
    name: def.name,
    description: def.description,
    schema: def.schema,
  });
}

const tools = [
  toStructuredTool(getAppLinksTool),
  toStructuredTool(qaDocsSearchTool),
  toStructuredTool(unscrambleTool),
  toStructuredTool(confluenceSearchTool),
  toStructuredTool(dataGenGenerateOrderTool),
];

// Preload vector store on boot (ok if empty)
loadVectorStore().catch(() => {});

router.post("/ingest", requireAuth, requireChatbotEnabled, async (_req, res) => {
  const out = await loadVectorStore().catch((e) => ({ ok: false, error: e?.message }));
  res.json(out || { ok: false });
});

// Style guidance shared by sync + streaming routes
const STYLE_RULES =
  "Be direct and task-focused. NEVER repeat or quote the user's question verbatim. " +
  "ALWAYS answer the explicit user request FIRST before offering alternatives or asking questions. " +
  "Never respond only with a meta question like 'Would you like...' or 'Do you need...'. Provide the substantive answer instead. " +
  "If the user requests test case(s), output a numbered list of diverse test cases (positive, negative, edge, security, validation). For each: Title, Steps (numbered), Expected Result. 5-10 cases unless user specifies a number. " +
  "If user requests a single test case, still provide at least one complete test case with Steps and Expected Result. " +
  "If the user only replies with a short confirmation (e.g. 'yes', 'yeah', 'y', 'ok', 'okay', 'sure'), treat it as a follow-up request for elaboration/next steps—DO NOT restate their prior question. " +
  "Do NOT add filler like 'If you need further customization...' or 'feel free to ask'. " +
  "When providing code, include one concise fenced code block and minimal comments. " +
  "Prefer runnable examples over generic advice. Keep answers under ~300 lines.";

const BASE_SYSTEM =
  "You are QA Bot, a helpful testing assistant for a software QA team. " +
  "Use tools when helpful (get_app_links, qa_docs_search, confluence_search, datagen_generate_order). " +
  "If the user mentions Confluence, specific page names (e.g., Gateway Testing Strategy, Integration Requests, DAT for Mercedes, BMW ProNet), or asks for internal documentation details, you MUST call confluence_search first and cite the page URL. " +
  "When the user asks to generate an order and retrieve the orderId, call datagen_generate_order with environment, feed, and requestType=Order and return the id and orderReference if found. " +
  "Cite docs as (Doc) if you used QA docs. " + STYLE_RULES;

// Non-streaming agent: plan -> tools -> answer (JSON response)
/**
 * NEW /chat_sync implementation (original preserved below commented for rollback)
 * - Tighter system/style prompt to reduce boilerplate
 * - Robust AIMessage content extraction (string or array parts)
 * - Larger max_tokens + lower temperature for focused answers
 */
router.post("/chat_sync", requireAuth, requireChatbotEnabled, async (req, res) => {
  try {
    const { messages = [], system } = req.body || {};

    const systemPrompt = system ? `${system}\n\n${STYLE_RULES}` : BASE_SYSTEM;

  const toolDefs = [getAppLinksTool, qaDocsSearchTool, unscrambleTool, confluenceSearchTool, dataGenGenerateOrderTool];
    const toolByName = Object.fromEntries(toolDefs.map((t) => [t.name, t]));

    // Helper: normalize AIMessage content to plain text
    function toText(msg) {
      if (!msg) return "";
      if (typeof msg.content === "string") return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content
          .map((p) => (typeof p === "string" ? p : p?.text ?? ""))
          .join("");
      }
      return String(msg.content ?? "");
    }

    // ---- PLAN (allow tool calls) ----
    const planPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("messages"),
    ]);

    const planModel = makeChatModel({
      streaming: false,
      temperature: 0.2,
      modelKwargs: { max_tokens: 1200, response_format: { type: "text" } },
    }).bindTools(
      toolDefs.map((t) => ({ name: t.name, description: t.description, schema: t.schema }))
    );

    const planMessages = toLCMessages(messages);

    // Optional: lightweight pre-retrieval (no tool binding) for grounding if enabled
    let groundingContext = "";
    if (process.env.CONFLUENCE_RAG === '1') {
      try {
        const lastUser = [...messages].reverse().find(m=>m.role==='user');
        if (lastUser && lastUser.content?.length > 15) {
          const hits = await confluenceSearchTool.func({ query: lastUser.content, k: 3 });
          if (hits?.length) {
            groundingContext = hits.map(h=>`Title: ${h.title}\nURL: ${h.url}\nSnippet: ${h.snippet}\n---`).join('\n');
          }
        }
      } catch (e) { /* silent */ }
    }
    const plannedAI = await planPrompt.pipe(planModel).invoke({ messages: planMessages });

    // ---- EXECUTE TOOLS (if any) ----
    const toolCalls =
      plannedAI?.tool_calls ||
      plannedAI?.additional_kwargs?.tool_calls ||
      plannedAI?.kwargs?.tool_calls ||
      [];

    const toolMsgs = [];
    for (const call of toolCalls) {
      const name = call?.name || call?.function?.name;
      const args = call?.args ?? call?.function?.arguments ?? {};
      const callId = call?.id || call?.tool_call_id || `call_${Math.random().toString(36).slice(2)}`;
      const def = toolByName[name];
      if (!def) continue;
      try {
        const parsed = typeof args === "string" ? JSON.parse(args || "{}") : args;
        const result = await def.func(parsed);
        toolMsgs.push(new ToolMessage({ tool_call_id: callId, content: JSON.stringify(result) }));
      } catch (e) {
        toolMsgs.push(
          new ToolMessage({ tool_call_id: callId, content: JSON.stringify({ error: e?.message || "tool failed" }) })
        );
      }
    }

    // ---- FINAL ANSWER (no tools bound; concise) ----
    const systemWithContext = groundingContext ? `${systemPrompt}\n\nCONFLUENCE CONTEXT:\n${groundingContext}\n\nUse only the above context for Confluence-derived facts.` : systemPrompt;
    const answerPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemWithContext],
      new MessagesPlaceholder("messages"),
    ]);
    const answerModel = makeChatModel({
      streaming: false,
      temperature: 0.2,
      modelKwargs: { max_tokens: 1200, response_format: { type: "text" } },
    });

    const answerMessages = [...planMessages];
    if (plannedAI) answerMessages.push(plannedAI);
    if (toolMsgs.length) answerMessages.push(...toolMsgs);

    const finalMsg = await answerPrompt.pipe(answerModel).invoke({ messages: answerMessages });
    let text = toText(finalMsg).trim();
    // Heuristic: if user provided a single likely scrambled word & model failed to answer, attempt unscramble
    try {
      const lastUserRaw = [...messages].reverse().find(m=>m.role==='user')?.content || '';
      const wordMatch = lastUserRaw.match(/\b([a-zA-Z]{5,})\b$/);
      if (wordMatch) {
        const w = wordMatch[1];
        const looksLikePrompt = /scrambl|unscram|what word|which word/i.test(lastUserRaw);
        const gaveNoAnswer = /provide the scrambled word|any more scrambled/i.test(text) || text.length < 25;
        if (looksLikePrompt && gaveNoAnswer) {
          const toolRes = await unscrambleTool.func({ letters: w });
          if (toolRes?.matches?.length) {
            text = `Unscrambled: ${toolRes.matches[0]}\n\n${text}`;
          } else if (toolRes?.suggestions?.length) {
            text = `No exact match. Suggestions: ${toolRes.suggestions.join(', ')}\n\n${text}`;
          }
        }
      }
    } catch {}
    // Remove common boilerplate / filler follow-up prompts the style rules prohibit
    text = text
      .replace(/(^|\n)(If you need further customization.*)$/gi, "")
      .replace(/(^|\n)(Would you like to see .*?)(\n|$)/gi, "")
      .replace(/(^|\n)(Would you like.*?more details.*?)(\n|$)/gi, "")
      .replace(/(^|\n)(Do you need more details.*?)(\n|$)/gi, "")
      .trim();
    // Remove leading repetition of last user question (common echo) if present
    if (messages.length) {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      const prevUser = [...messages].filter(m => m.role === 'user').slice(-2, -1)[0];
      if (lastUser && prevUser) {
        const affirmRe = /^(yes|yep|yeah|y|ok|okay|sure|please|correct|affirmative)[.! ]*$/i;
        if (affirmRe.test(lastUser.content.trim())) {
          // If model echoed the prior actual question, strip it
          const q = prevUser.content.trim();
          const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`);
          const leadEcho = new RegExp(`^${escaped}\s*`, 'i');
          text = text.replace(leadEcho, '').trim();
        }
      }
    }
    return res.json({ ok: true, text });
  } catch (err) {
    console.error("chat_sync error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Agent failed" });
  }
});

// ORIGINAL IMPLEMENTATION (kept for quick rollback)
// router.post("/chat_sync_old", async (req, res) => { /* original code was here */ });

// ---------- ROBUST STREAMING AGENT ----------
router.post("/chat", requireAuth, requireChatbotEnabled, async (req, res) => {
  const t0 = Date.now();
  try {
    const { messages = [], system } = req.body || {};
    const noTools = String(req.query.notools || "").trim() === "1";

  const systemPrompt = system ? `${system}\n\n${STYLE_RULES}` : BASE_SYSTEM;

    // ---- SSE headers & safe writes ----
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let closed = false;
    const safeWrite = (chunk) => { if (!closed && !res.writableEnded) res.write(chunk); };
    req.on("close", () => (closed = true));
    res.on("close", () => (closed = true));
    res.on("finish", () => (closed = true));

    // Immediate ping so the client knows we’re alive
    safeWrite(`event: info\ndata: {"phase":"start","ts":${Date.now()}}\n\n`);

    // Heartbeat to keep proxies alive
    const hb = setInterval(() => safeWrite(`: ping ${Date.now()}\n\n`), 15000);

    // Prep messages
    const planMessages = toLCMessages(messages);

    // Helper: timeout wrapper (prevents silent hangs)
    const withTimeout = (p, ms, label) =>
      Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${label}`)), ms)),
      ]);

    // ========== BYPASS TOOLS (diagnostic) ==========
    if (noTools) {
      safeWrite(`event: info\ndata: {"phase":"bypass-tools"}\n\n`);
      const answerPrompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        new MessagesPlaceholder("messages"),
      ]);
  const answerModel = makeChatModel({ streaming: true, temperature: 0.2, modelKwargs: { max_tokens: 1200, response_format: { type: "text" } } });

      await answerPrompt.pipe(answerModel).stream(
        { messages: planMessages },
        {
          callbacks: [
            {
              handleLLMNewToken(token) { if (token) safeWrite(`data: ${token}\n\n`); },
              handleLLMEnd() {
                clearInterval(hb);
                if (!closed && !res.writableEnded) {
                  safeWrite("event: end\ndata: [DONE]\n\n");
                  res.end();
                }
              },
              handleLLMError(err) {
                clearInterval(hb);
                if (!closed && !res.writableEnded) {
                  safeWrite(`event: error\ndata: ${JSON.stringify({ error: err?.message || "LLM error" })}\n\n`);
                  res.end();
                }
              },
            },
          ],
        }
      );
      return;
    }

    // ========== PLAN (non-stream, tools bound) ==========
  const toolDefs = [getAppLinksTool, qaDocsSearchTool, unscrambleTool, confluenceSearchTool, dataGenGenerateOrderTool];
    const toolByName = Object.fromEntries(toolDefs.map(t => [t.name, t]));

    const planPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("messages"),
    ]);
  const planModel = makeChatModel({ streaming: false, temperature: 0.2, modelKwargs: { max_tokens: 1200, response_format: { type: "text" } } }).bindTools(
      toolDefs.map(t => ({ name: t.name, description: t.description, schema: t.schema }))
    );

    safeWrite(`event: info\ndata: {"phase":"plan","ts":${Date.now()}}\n\n`);
    let plannedAI;
    try {
      plannedAI = await withTimeout(planPrompt.pipe(planModel).invoke({ messages: planMessages }), 45000, "plan.invoke");
    } catch (e) {
      // If planning fails, fall back to a direct streamed answer
      safeWrite(`event: info\ndata: {"phase":"plan-failed","msg":${JSON.stringify(e.message)}}\n\n`);
      const fallbackPrompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        new MessagesPlaceholder("messages"),
      ]);
  const fallbackModel = makeChatModel({ streaming: true, temperature: 0.2, modelKwargs: { max_tokens: 1200, response_format: { type: "text" } } });
      await fallbackPrompt.pipe(fallbackModel).stream(
        { messages: planMessages },
        {
          callbacks: [{
            handleLLMNewToken(t){ if (t) safeWrite(`data: ${t}\n\n`); },
            handleLLMEnd(){ clearInterval(hb); if (!closed && !res.writableEnded){ safeWrite("event: end\ndata: [DONE]\n\n"); res.end(); } },
            handleLLMError(err){ clearInterval(hb); if (!closed && !res.writableEnded){ safeWrite(`event: error\ndata: ${JSON.stringify({ error: err?.message || "LLM error" })}\n\n`); res.end(); } },
          }],
        }
      );
      return;
    }

    // Extract tool calls across LC/OpenAI variants
    const toolCalls =
      plannedAI?.tool_calls ||
      plannedAI?.additional_kwargs?.tool_calls ||
      plannedAI?.kwargs?.tool_calls ||
      [];

    safeWrite(`event: info\ndata: {"phase":"tool-calls","count":${toolCalls.length}}\n\n`);

    // ========== EXECUTE TOOLS ==========
    const toolMsgs = [];
    for (const call of toolCalls) {
      const name = call?.name || call?.function?.name;
      const args = call?.args ?? call?.function?.arguments ?? {};
      const callId = call?.id || call?.tool_call_id || `call_${Math.random().toString(36).slice(2)}`;
      const def = toolByName[name];
      if (!def) continue;
      try {
        const parsed = typeof args === "string" ? JSON.parse(args || "{}") : args;
  // Allow long-running tools (DataGen submit+poll can take up to ~60s)
  const result = await withTimeout(def.func(parsed), 90000, `tool:${name}`);
        toolMsgs.push(new ToolMessage({ tool_call_id: callId, content: JSON.stringify(result) }));
      } catch (e) {
        toolMsgs.push(new ToolMessage({ tool_call_id: callId, content: JSON.stringify({ error: e?.message || "tool failed" }) }));
      }
    }

    // ========== STREAM FINAL ANSWER ==========
    const answerPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("messages"),
    ]);
  const answerModel = makeChatModel({ streaming: true, temperature: 0.2, modelKwargs: { max_tokens: 1200, response_format: { type: "text" } } });

  const answerMessages = [...planMessages];
    if (plannedAI) answerMessages.push(plannedAI);
    if (toolMsgs.length) answerMessages.push(...toolMsgs);

    safeWrite(`event: info\ndata: {"phase":"answer","ts":${Date.now()},"elapsedMs":${Date.now()-t0}}\n\n`);

    // Post-process echo removal buffer
    let buffered = '';
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const prevUser = [...messages].filter(m => m.role === 'user').slice(-2, -1)[0];
  const affirmRe = /^(yes|yep|yeah|y|ok|okay|sure|please|correct|affirmative)[.! ]*$/i;
  const priorQ = prevUser?.content?.trim();
  let removeEcho = !!(lastUser && prevUser && affirmRe.test(lastUser.content.trim()) && priorQ);
    const escapedQ = priorQ ? priorQ.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`) : null;
    const leadEchoRe = escapedQ ? new RegExp(`^${escapedQ}\s*`, 'i') : null;

    await answerPrompt.pipe(answerModel).stream(
      { messages: answerMessages },
      {
        callbacks: [
          {
            handleLLMNewToken(token) {
              if (!token) return;
              if (removeEcho) {
                buffered += token;
                // Only flush after we are confident potential echo has passed (~ first 150 chars or newline)
                if (buffered.length < 150 && !buffered.includes('\n')) return;
                if (leadEchoRe) buffered = buffered.replace(leadEchoRe, '');
                safeWrite(`data: ${buffered}` + '\n\n');
                if (removeEcho) buffered = '';
                // after first flush disable further buffering
                removeEcho = false;
              } else {
                safeWrite(`data: ${token}\n\n`);
              }
            },
            handleLLMEnd() {
              clearInterval(hb);
              if (buffered) {
                if (leadEchoRe) buffered = buffered.replace(leadEchoRe, '');
                // Post-process final buffered chunk for filler removal
                buffered = buffered
                  .replace(/(^|\n)(If you need further customization.*)$/gi, '')
                  .replace(/(^|\n)(Would you like to see .*?)(\n|$)/gi, '')
                  .replace(/(^|\n)(Would you like.*?more details.*?)(\n|$)/gi, '')
                  .replace(/(^|\n)(Do you need more details.*?)(\n|$)/gi, '')
                  .trim();
                safeWrite(`data: ${buffered}\n\n`);
              }
              if (!closed && !res.writableEnded) {
                safeWrite("event: end\ndata: [DONE]\n\n");
                res.end();
              }
            },
            handleLLMError(err) {
              clearInterval(hb);
              if (!closed && !res.writableEnded) {
                safeWrite(`event: error\ndata: ${JSON.stringify({ error: err?.message || "LLM error" })}\n\n`);
                res.end();
              }
            },
          },
        ],
      }
    );
  } catch (err) {
    console.error("Agent error:", err);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
    }
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err?.message || "Agent failed" })}\n\n`);
      res.end();
    }
  }
});

// Non-streaming sanity check (returns JSON or a clear Azure error)
if (process.env.ENABLE_DEBUG_ROUTES === '1') {
  router.get("/debug/azure", async (req, res) => {
    try {
      const llm = makeChatModel({ streaming: false, temperature: 0.0 });
      const result = await llm.invoke([{ role: "user", content: "ping" }]);
      res.json({ ok: true, text: typeof result?.content === "string" ? result.content : "[ok]" });
    } catch (e) {
      console.error("Azure debug error:", e);
      res.status(500).json({
        ok: false,
        message: e?.message,
        code: e?.code,
        azure: {
          endpoint: process.env.AZURE_OPENAI_API_ENDPOINT,
          instance: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
          chatDeployment: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
          embeddingsDeployment: process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
          apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        },
      });
    }
  });

  // Plain text stream probe (bypasses LangChain)
  router.get("/debug/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    let i = 0;
    const t = setInterval(() => res.write(`data: tick ${++i}\n\n`), 500);
    setTimeout(() => { clearInterval(t); res.write("event: end\ndata: [DONE]\n\n"); res.end(); }, 4000);
  });
}

export default router;
