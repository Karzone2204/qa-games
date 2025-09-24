import { z } from "zod";
import ResourceLink from "../models/ResourceLink.js";  // your App Links model
import { ragSearch } from "./vector.js";
import { z as z2 } from "zod";
import { confluenceSimilaritySearch } from "./confluenceStore.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ENVIRONMENTS, FEED_FILE_SUFFIXES } from "../config/dataGenConfig.js";
import { transformSourcePayload, getBearerTokenViaPwsh, postRequestViaPwsh, postJsonViaPwsh } from "../services/dataGenService.js";

// Simple deduplication cache to prevent duplicate data generation calls
const recentCalls = new Map(); // key: hash of params, value: { timestamp, promise }
const DEDUP_WINDOW_MS = 10000; // 10 seconds

function getCallKey(environment, feed, requestType) {
  return `${environment}_${feed}_${requestType}`;
}

/** Return app links by optional env/tag */
export const getAppLinksTool = {
  name: "get_app_links",
  description: "Return environment links. Optional filter by env (dev/test/stage/prod) or tag.",
  schema: z.object({
    env: z.string().optional(),
    tag: z.string().optional(),
  }),
  func: async ({ env, tag }) => {
    const where = {};
    if (env) where.env = env;
    if (tag) where.tags = tag;
    const items = await ResourceLink.find(where).lean();
    return items.map(({ name, env, url, tags }) => ({ name, env, url, tags }));
  },
};

/** Search private QA docs (RAG) */
export const qaDocsSearchTool = {
  name: "qa_docs_search",
  description: "Semantic search across internal QA docs (markdown/txt). Returns top snippets.",
  schema: z.object({
    query: z.string().min(3),
    k: z.number().int().min(1).max(8).optional(),
  }),
  func: async ({ query, k }) => {
    const hits = await ragSearch(query, k ?? 4);
    return hits;
  },
};

/** Unscramble a scrambled word using internal word list heuristics */
export const unscrambleTool = {
  name: "unscramble_word",
  description: "Unscramble a single scrambled English word (common tech/game words allowed). Provide the scrambled letters.",
  schema: z.object({ letters: z.string().min(2).max(32) }),
  func: async ({ letters }) => {
    const dict = [
      "quality","testing","automation","release","sprint","ticket","feature","backend","frontend","browser","adapter","engineer","console","memory","sudoku","typing","scramble","puzzle","javascript","react","express","database","vector","token","prompt","score","tournament","socket"
    ];
    const norm = letters.toLowerCase().replace(/[^a-z]/g, "");
    const sig = norm.split("").sort().join("");
    const matches = dict.filter(w => w.length === norm.length && w.split("").sort().join("") === sig);
    if (matches.length) return { matches };
    // Fallback suggest closest by multiset similarity
    function score(word){
      if (word.length !== norm.length) return -1;
      const a = word.split("");
      const b = norm.split("");
      let hit = 0; const used = new Array(b.length).fill(false);
      for (const ch of a){
        const idx = b.findIndex((c,i)=> c===ch && !used[i]);
        if (idx>=0){ used[idx]=true; hit++; }
      }
      return hit;
    }
    const ranked = dict.map(w=>({ w, s: score(w) })).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).slice(0,5).map(o=>o.w);
    return { matches: [], suggestions: ranked };
  }
};

export const confluenceSearchTool = {
  name: "confluence_search",
  description: "Semantic search across indexed Confluence pages (Gateway Strategy, Integration Requests, etc.)",
  schema: z2.object({ query: z2.string().min(3), k: z2.number().int().min(1).max(8).optional() }),
  func: async ({ query, k }) => {
    const hits = await confluenceSimilaritySearch(query, k ?? 4);
    return hits;
  }
};

/** Generate and submit Order via DataGen, then poll order list for orderId */
export const dataGenGenerateOrderTool = {
  name: "datagen_generate_order",
  description: "Generate and submit an Order payload, then poll for the orderId. Requires server-side PowerShell to be enabled.",
  schema: z.object({
    environment: z.enum(["dev","test","uat"]),
    feed: z.string().min(1),
    requestType: z.string().default("Order"),
    maxAttempts: z.number().int().min(1).max(10).optional()
  }),
  func: async ({ environment, feed, requestType, maxAttempts }) => {
    // Add logging to track tool calls
    const callId = Math.random().toString(36).slice(2, 8);
    console.log(`[DataGenTool-${callId}] CALLED with env=${environment}, feed=${feed}, type=${requestType}, attempts=${maxAttempts}`);
    
    // Check for recent duplicate calls
    const callKey = getCallKey(environment, feed, requestType || 'Order');
    const now = Date.now();
    
    // Clean up old entries
    for (const [key, entry] of recentCalls.entries()) {
      if (now - entry.timestamp > DEDUP_WINDOW_MS) {
        recentCalls.delete(key);
      }
    }
    
    // Check if we have a recent call for the same parameters
    if (recentCalls.has(callKey)) {
      const existingCall = recentCalls.get(callKey);
      console.log(`[DataGenTool-${callId}] DUPLICATE DETECTED - returning existing result from ${now - existingCall.timestamp}ms ago`);
      try {
        return await existingCall.promise;
      } catch (e) {
        // If the existing call failed, remove it and proceed with new call
        console.log(`[DataGenTool-${callId}] Previous call failed, proceeding with new call`);
        recentCalls.delete(callKey);
      }
    }
    
    if (process.env.DATA_GEN_ALLOW_PWSH !== '1') {
      console.log(`[DataGenTool-${callId}] FAILED: PowerShell disabled`);
      throw new Error("PowerShell path disabled (DATA_GEN_ALLOW_PWSH!=1)");
    }
    
    // Create and cache the execution promise
    const executionPromise = executeDataGeneration(callId, environment, feed, requestType, maxAttempts);
    recentCalls.set(callKey, { timestamp: now, promise: executionPromise });
    
    try {
      const result = await executionPromise;
      return result;
    } finally {
      // Remove from cache after completion (successful or failed)
      recentCalls.delete(callKey);
    }
  }
};

// Extract the main execution logic to a separate function
async function executeDataGeneration(callId, environment, feed, requestType, maxAttempts) {
    const envCfg = ENVIRONMENTS[environment];
    if (!envCfg) throw new Error(`Unknown environment: ${environment}`);
    // Normalize feed to internal key
    let feedKey = String(feed || '').toLowerCase().replace(/\s|_/g,'');
    if (feedKey === '3c' || feedKey === 'threec') feedKey = 'threec';
    if (feedKey === 'atuser' || feedKey === 'at_user') feedKey = 'atUser';
    // fallback to original if it matches as-is
    if (!FEED_FILE_SUFFIXES[feedKey] && FEED_FILE_SUFFIXES[feed]) feedKey = feed;
    if (!FEED_FILE_SUFFIXES[feedKey]) throw new Error(`Unknown or unsupported feed: ${feed}`);
    const suffix = FEED_FILE_SUFFIXES[feedKey] || 'ATUser';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const genRoot = path.resolve(__dirname, '../../generated');
    const srcPath = path.join(genRoot, feedKey, requestType || 'Order', `source_${suffix}.json`);
    if (!fs.existsSync(srcPath)) {
      return { ok: false, available: false, message: `Source not found for ${feedKey}/${requestType || 'Order'} (${srcPath}).` };
    }
    const raw = fs.readFileSync(srcPath, 'utf8');
    const source = JSON.parse(raw);
    const payload = transformSourcePayload(source);

    // Submit via PowerShell using feed-specific credentials for token
  const token = await getBearerTokenViaPwsh(environment, undefined, feedKey);
    console.log(`[DataGenTool-${callId}] Submitting order payload...`);
    const submitRes = await postRequestViaPwsh({ envKey: environment, payload, token });
    if (!submitRes.ok) {
      console.log(`[DataGenTool-${callId}] SUBMIT FAILED: ${submitRes.status} - ${submitRes.data?.error || 'Submit failed'}`);
      return { ok: false, submitStatus: submitRes.status, error: submitRes.data?.error || 'Submit failed' };
    }
    console.log(`[DataGenTool-${callId}] Submit successful, status: ${submitRes.status}`);

    // Derive LastName keyword from payload to poll
    function getLastName(obj){
      try{
        const arr = obj.Payloads || obj.payloads || [];
        for(const m of arr){
          const mt = m.MessageType ?? m.messageType;
          const p = m.Payload ?? m.payload;
          if(mt === 11 && p){
            const ln = p.LastName ?? p.lastName;
            if(typeof ln === 'string' && ln.trim()) return ln.trim();
          }
        }
      }catch{}
      return null;
    }
    const keyword = getLastName(payload);
    // Build fallback keywords if needed (externalReference, policy number)
    function getOrderExternalRef(obj){
      try{
        const arr = obj.Payloads || obj.payloads || [];
        for(const m of arr){
          const mt = m.MessageType ?? m.messageType;
          if (mt !== 10) continue;
          const p = m.Payload ?? m.payload;
          if (!p) continue;
          const er = p.ExternalReference ?? p.externalReference;
          if (typeof er === 'string' && er.trim()) return er.trim();
        }
      }catch{}
      return null;
    }
    function getPolicyNumber(obj){
      try{
        const arr = obj.Payloads || obj.payloads || [];
        for(const m of arr){
          const mt = m.MessageType ?? m.messageType;
          if (mt !== 10) continue;
          const p = m.Payload ?? m.payload;
          const pol = p?.InsurancePolicy ?? p?.insurancePolicy;
          const pn = pol?.PolicyNumber ?? pol?.policyNumber;
          if (typeof pn === 'string' && pn.trim()) return pn.trim();
        }
      }catch{}
      return null;
    }
    const fallbacks = [];
    const extRef = getOrderExternalRef(payload); if (extRef) fallbacks.push(extRef);
    const policyNo = getPolicyNumber(payload); if (policyNo) fallbacks.push(policyNo);

    // Poll order list via PowerShell using gateway scope override
    const scopeOverride = 'https://tigplcb2ctest.onmicrosoft.com/gateway/.default';
  const pollToken = await getBearerTokenViaPwsh(environment, scopeOverride);
    const url = envCfg.orderListUrl;
    if (!url) return { ok:false, message:'orderListUrl not configured for environment' };
    const attempts = Math.max(1, Math.min(Number(maxAttempts) || 10, 10));
    let found; let totalAttempts = 0;
    async function tryPollWith(kw){
      for(let i=0;i<attempts;i++){
        totalAttempts++;
        const body = { paging: { number:1, size:10 }, filters: [ { by:'keyword', value: kw, type:'like' } ], sorts: [] };
        const resp = await postJsonViaPwsh({ url, token: pollToken, body, businessRegion: process.env.DATA_GEN_BUSINESS_REGION || process.env.DATA_GEN_TEST_BUSINESS_REGION });
        const ok = !!resp.ok && (resp.status >=200 && resp.status <300);
        const data = resp.data ?? resp;
        if(ok && data?.data?.results?.length){
          const hit = data.data.results[0];
          found = { attempts: totalAttempts, id: hit.id, orderReference: hit.orderReference, keyword: kw };
          return true;
        }
        if (i < attempts - 1) await new Promise(r=>setTimeout(r, 5000));
      }
      return false;
    }
    if (keyword) await tryPollWith(keyword);
    if (!found) {
      for (const fb of fallbacks){
        const ok = await tryPollWith(fb);
        if (ok) break;
      }
    }
    if (!found) {
      console.log(`[DataGenTool-${callId}] ORDER NOT FOUND after ${totalAttempts} attempts with keywords: ${[keyword, ...fallbacks].filter(Boolean).join(', ')}`);
      return { ok:true, submitted:true, submitStatus: submitRes.status, polled:true, found:false, attempts: totalAttempts, tried: [keyword, ...fallbacks].filter(Boolean) };
    }
    const link = `https://ig-weu-tst-gateway-ui.azurewebsites.net/order/${found.id}/manage/dashboard`;
    console.log(`[DataGenTool-${callId}] ORDER FOUND: id=${found.id}, ref=${found.orderReference}, keyword=${found.keyword}`);
    return { ok:true, submitted:true, submitStatus: submitRes.status, polled:true, found:true, id:found.id, orderReference: found.orderReference, link, keywordUsed: found.keyword };
}
