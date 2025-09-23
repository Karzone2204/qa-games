import ResourceLink from "../models/ResourceLink.js";
import mongoose from "mongoose";
import { z } from "zod";
import { makeChatModel } from "../llm/clients.js";

const testCaseRequestSchema = z.object({
  feature: z.string().min(3).max(200),
  criteria: z.string().max(5000).optional().default(""),
  risk: z.enum(["low","medium","high"]).optional().default("medium"),
  categories: z.array(z.enum(["functional","edge","negative","security","i18n","perf","accessibility"]))
    .optional().default(["functional","edge","negative"]),
  countPerCategory: z.number().int().min(1).max(6).optional().default(2),
  detailed: z.boolean().optional().default(false),
  format: z.enum(["standard","gherkin"]).optional().default("standard")
});

export async function generateTestCases(req, res){
  const parsed = testCaseRequestSchema.safeParse(req.body || {});
  if (!parsed.success){
    return res.status(400).json({ error: parsed.error.issues.map(i=>i.message).join("; ") });
  }
  const { feature, criteria, risk, categories, countPerCategory, detailed, format } = parsed.data;
  const model = makeChatModel({ streaming: false, temperature: 0.3 });
  if (format === 'gherkin'){
    const sys = [
      "You are a senior QA test designer.",
      "Return ONLY plain Gherkin syntax as text. No markdown fences, no backticks, no commentary.",
      "Use: Feature, Scenario/Scenario Outline, Given/When/Then/And, and tables where appropriate.",
      "Do NOT include @Story, @Epic, @AC or any work-item/Jira tags. If using tags, include exactly one functional tag derived from the feature name (e.g., @ReviewExpertise) above each Scenario.",
      "If the acceptance criteria contains pre-requisites (also known as preconditions or assumptions), include a Background section with one or more Given steps that state them succinctly.",
      "Be detailed and align with the provided feature and acceptance criteria."
    ].join(" ");
    const gherkinPrompt = `Feature: ${feature}\n` +
      (criteria ? `\nAcceptance criteria or user story:\n\"\"\"${criteria}\"\"\"\n` : "") +
  `\nPlease generate multiple Scenarios (and Scenario Outlines if variations exist). ` +
      `Use clear Given/When/Then steps, include tables (| Col | Col |) where needed. ` +
  `If pre-requisites are present in the acceptance criteria, add them as Background with Given lines. ` +
  `Avoid any surrounding prose; output must start with Feature and contain only valid Gherkin.`;
    const resp = await model.invoke([
      { role: 'system', content: sys },
      { role: 'user', content: gherkinPrompt }
    ]);
    let text = resp?.content?.[0]?.text || resp?.content || "";
    // Strip any accidental code fences
    text = (text || '').replace(/```[a-z]*\n([\s\S]*?)```/gi, '$1').trim();
    // Remove undesired tags (@Story, @Epic, @AC) and keep others, then ensure a single functional tag is added per Scenario
    const makeFunctionalTag = (feat)=>{
      const words = String(feat||'').split(/[^A-Za-z]+/).filter(w=>w.length>=3);
      const picked = words.slice(0,2);
      const camel = picked.map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('') || 'Feature';
      return '@' + camel.replace(/[^A-Za-z]/g,'').slice(0,30);
    };
    const funcTag = makeFunctionalTag(feature);
    const lines = text.split(/\r?\n/);
    const cleaned = [];
    for(let i=0;i<lines.length;i++){
      const ln = lines[i];
      const t = ln.trim();
      if (t.startsWith('@')){
        const tokens = t.split(/\s+/).filter(tok=>!( /^@Story/i.test(tok) || /^@Epic/i.test(tok) || /^@AC/i.test(tok) ));
        if (tokens.length){ cleaned.push(tokens.join(' ')); } // keep other tags if any remain
        continue; // skip original line if emptied
      }
      // Before Scenario/Scenario Outline, ensure our functional tag exists on the prior non-empty line
      if (/^(Scenario Outline:|Scenario:)/i.test(t)){
        // Look back to find last non-empty output line
        let j = cleaned.length - 1; while (j>=0 && cleaned[j].trim()==='') j--;
        if (j < 0 || !cleaned[j].trim().startsWith('@')){
          cleaned.push(funcTag);
        } else if (!new RegExp('^'+funcTag.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+'(\s|$)').test(cleaned[j].trim())){
          // Replace any existing tag line with our functional tag only
          cleaned[j] = funcTag;
        }
      }
      cleaned.push(ln);
    }
    text = cleaned.join('\n');
    if (!/\bFeature:/i.test(text)){
      return res.status(502).json({ error: 'Model did not return Gherkin content', raw: text });
    }
    return res.json({ gherkin: text });
  }
  const sys = [
    "You are a senior QA test designer.",
    "Return ONLY raw JSON. No markdown fences, no backticks, no commentary.",
    "Do not include ```json or any explanation.",
    "Follow the provided schema exactly; omit trailing commas."
  ].join(" ");
  const userPrompt = `Generate test cases for the feature:\n"""${feature}"""\n` +
    (criteria ? `Acceptance criteria or user story:\n"""${criteria}"""\n` : "") +
    `Risk level: ${risk}\nCategories: ${categories.join(", ")}\nCount per category: ${countPerCategory}\n` +
    `If the acceptance criteria contains pre-requisites (preconditions/assumptions), extract them into a top-level array named \"prerequisites\". ` +
    (detailed
      ? `Each test case 'steps' MUST be an array of objects with properties {"action":"what tester does","expected":"observable result"}. Provide 4-8 steps per case. `
      : `Each test case 'steps' MUST be an array of action strings (no numbering). `) +
    `Return JSON: {"prerequisites":["string"...],"cases":[{"id":"string","title":"string","category":"one category","steps":` +
    (detailed ? `[{"action":"...","expected":"..."}]` : `["step"...]`) +
    `,"expected":"string (overall end state)","rationale":"why","riskAlignment":"how it addresses risk"}],"summary":{"total":number,"categories":{cat:number...},"notes":"string"}}.`;

  async function call(prompt){
    const resp = await model.invoke([
      { role: 'system', content: sys },
      { role: 'user', content: prompt }
    ]);
    return resp?.content?.[0]?.text || resp?.content || "";
  }

  let raw = await call(userPrompt);

  const stripFences = (txt)=>{
    if (!txt) return txt;
    // Remove ```json ... ``` or ``` ... ``` wrappers
    return txt.replace(/```json\s*([\s\S]*?)```/gi, '$1').replace(/```\s*([\s\S]*?)```/g, '$1').trim();
  };

  const extractJsonSubstring = (txt)=>{
    // Attempt to locate the largest balanced JSON object substring
    if (!txt) return txt;
    let best = null; let depth = 0; let start = -1;
    for (let i=0;i<txt.length;i++){
      const ch = txt[i];
      if (ch === '{'){
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}'){
        depth--;
        if (depth === 0 && start !== -1){
          const candidate = txt.slice(start, i+1);
          if (!best || candidate.length > best.length) best = candidate;
          start = -1;
        }
      }
    }
    return best || txt;
  };

  const tryParse = (txt)=>{ try { return JSON.parse(txt); } catch { return null; } };

  function attemptAll(rawText){
    let t = rawText;
    let parsed = tryParse(t);
    if (parsed) return { parsed, variant: 'raw' };
    t = stripFences(rawText);
    parsed = tryParse(t);
    if (parsed) return { parsed, variant: 'stripped' };
    const extracted = extractJsonSubstring(t);
    if (extracted && extracted !== t){
      parsed = tryParse(extracted);
      if (parsed) return { parsed, variant: 'extracted' };
    }
    return { parsed: null, variant: 'failed' };
  }

  let { parsed: parsedJson, variant } = attemptAll(raw);

  if (!parsedJson){
    // Second attempt with stronger instruction
    raw = await call(userPrompt + "\nReturn ONLY the JSON object. No code fences, no prefix, no suffix.");
    const second = attemptAll(raw);
    parsedJson = second.parsed; variant = second.variant;
  }

  if (!parsedJson || !Array.isArray(parsedJson.cases)){
    return res.status(502).json({
      error: "LLM returned unparseable output",
      hint: "Model must return raw JSON. Remove markdown fences/backticks. Ensure top-level object with cases[].",
      variantTried: variant,
      raw
    });
  }

  // Light normalization
  parsedJson.cases = parsedJson.cases.map((c,i)=>{
    const base = {
      id: c.id || String(i+1),
      title: c.title?.slice(0,180) || `Case ${i+1}`,
      category: c.category || 'functional',
      expected: c.expected || '',
      rationale: c.rationale || '',
      riskAlignment: c.riskAlignment || ''
    };
    let steps = [];
    if (Array.isArray(c.steps)){
      steps = c.steps.slice(0,12).map(s=>{
        if (detailed){
          if (s && typeof s === 'object'){
            return {
              action: String(s.action || s.step || s.do || '').slice(0,300),
              expected: String(s.expected || s.result || '').slice(0,400)
            };
          }
          // If model returned plain string despite detailed request, wrap it
          return { action: String(s).slice(0,300), expected: '' };
        } else {
          // Non-detailed mode; if object, collapse to action
            if (s && typeof s === 'object') return (s.action || s.step || s.do || '').slice(0,300);
            return String(s).slice(0,300);
        }
      });
    }
    return { ...base, steps };
  });
  parsedJson.summary = parsedJson.summary || { total: parsedJson.cases.length, categories: {} };
  if (!parsedJson.summary.total) parsedJson.summary.total = parsedJson.cases.length;
  if (!parsedJson.summary.categories || typeof parsedJson.summary.categories !== 'object'){
    parsedJson.summary.categories = parsedJson.cases.reduce((m,c)=>{ m[c.category]=(m[c.category]||0)+1; return m; }, {});
  }
  return res.json(parsedJson);
}

export async function listLinks(req, res){
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database not connected", hint: "Set MONGODB_URI or set SKIP_DB=1 to disable DB features." });
  }
  const env = (req.query.env || "").toString().trim().toLowerCase();
  const filter = env ? { env } : {};
  const items = await ResourceLink.find(filter).sort({ env:1, name:1 }).lean();
  res.json({ items, env: env || null });
}
export async function createLink(req, res){
  const { name, env="dev", url, tags=[] } = req.body || {};
  if (!name || !url) return res.status(400).json({ error: "name and url required" });
  const item = await ResourceLink.create({ name, env, url, tags, createdBy: req.user?.id });
  res.json({ item });
}
export async function updateLink(req, res){
  const { id } = req.params;
  const { name, env, url, tags } = req.body || {};
  const item = await ResourceLink.findByIdAndUpdate(id, { name, env, url, tags }, { new: true });
  if (!item) return res.status(404).json({ error: "not found" });
  res.json({ item });
}
export async function deleteLink(req, res){
  const { id } = req.params;
  await ResourceLink.findByIdAndDelete(id);
  res.json({ ok: true });
}
