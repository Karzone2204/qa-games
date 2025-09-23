import React, { useEffect, useRef, useState } from "react";
import { apiBase } from "../../services/apiBase.js"; // small helper below

function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Shared bubble container style factory
const bubbleRow = (side) => ({
  display: "flex",
  flexDirection: side === "left" ? "row" : "row-reverse",
  alignItems: "flex-start",
  gap: 8,
  margin: "6px 0",
  maxWidth: "85%",
  alignSelf: side === "left" ? "flex-start" : "flex-end",
});

const avatarStyle = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  flexShrink: 0,
  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
};

function BotBubble({ text }) {
  // simple linkify (http/https)
  const parts = text.split(/(https?:\/\/[^\s)]+[^\s.,)])/g);
  return (
    <div style={bubbleRow("left")}>      
      <div style={{...avatarStyle, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"#fff"}}>🤖</div>
      <div style={{
        background: "rgba(255,255,255,0.15)",
        padding: "10px 14px",
        borderRadius: 14,
        lineHeight: 1.4,
        fontSize: 14,
        backdropFilter: "blur(2px)",
        border: "1px solid rgba(255,255,255,0.15)",
        flexGrow: 1,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}>
        {parts.map((p,i)=> i%2===1 ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{color:'#8dc8ff', textDecoration:'underline'}}>{p}</a> : p)}
      </div>
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div style={bubbleRow("right")}>      
      <div style={{...avatarStyle, background:"linear-gradient(135deg,#f093fb,#f5576c)", color:"#fff"}}>🧑‍💻</div>
      <div style={{
        background: "rgba(255,255,255,0.92)",
        color: "#222",
        padding: "10px 14px",
        borderRadius: 14,
        lineHeight: 1.4,
        fontSize: 14,
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        flexGrow: 1,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}>{text}</div>
    </div>
  );
}

export default function Chatbot({ fill = false, boxHeight = 360 }){
  const [messages, setMessages] = useState([
    { role:"assistant", content:"Hi! I’m QA Bot. Type /help for commands." }
  ]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | connecting | streaming | error
  const [error, setError] = useState(null);
  const boxRef = useRef(null);
  const abortRef = useRef(null);
  // Cache the last generated manual test cases (normalized text block)
  const [lastManualTests, setLastManualTests] = useState(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior:"smooth" });
  }, [messages]);

  async function askLLM(history) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("connecting");
    setError(null);

    const res = await fetch(`${apiBase()}/llm/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ messages: history }),
      mode: "cors",
      credentials: "include",
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) {
      setPhase("error");
      throw new Error(`LLM HTTP ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedAny = false;
    let assistantIndex = null; // create on first token
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";
      for (const frame of frames) {
        if (frame.startsWith(":")) continue; // heartbeat
        const lines = frame.split(/\n/).filter(Boolean);
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === "[DONE]") { setPhase("idle"); return; }
            if (!receivedAny) {
              receivedAny = true;
              setPhase("streaming");
              // insert assistant message now
              setMessages(ms => {
                assistantIndex = ms.length;
                return [...ms, { role: "assistant", content: payload }];
              });
            } else {
              setMessages(ms => {
                const copy = ms.slice();
                const idx = assistantIndex ?? copy.findLastIndex(m=>m.role==='assistant');
                if (idx >= 0) copy[idx] = { ...copy[idx], content: copy[idx].content + payload };
                return copy;
              });
            }
          } else if (line.startsWith("event: error")) {
            setPhase("error");
          }
        }
      }
    }
    setPhase(receivedAny ? "idle" : "error");
  }

  async function askLLMWithFallback(history){
    // streaming attempt with timeout
    let gotToken = false;
    const ctrl = new AbortController();
    // Slightly larger timeout to allow first token for longer answers (esp. code)
    const timeoutMs = 8000;
    const timer = setTimeout(() => { if (!gotToken) ctrl.abort(); }, timeoutMs);
    setPhase("connecting");
    setError(null);
    try {
  const res = await fetch(`${apiBase()}/llm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ messages: history }),
        mode: "cors",
        credentials: "include",
        signal: ctrl.signal,
      });
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantIndex = null;
        while (true) {
          const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split("\n\n");
            buffer = frames.pop() || "";
            for (const f of frames) {
              if (f.startsWith(":")) continue; // heartbeat
              if (f.startsWith("data:")) {
                const token = f.slice(5).trim();
                if (!token) continue;
                if (token === "[DONE]") continue;
                if (!gotToken) { gotToken = true; setPhase("streaming"); }
                if (assistantIndex === null) {
                  setMessages(ms => { assistantIndex = ms.length; return [...ms, { role:'assistant', content: token }]; });
                } else {
                  setMessages(ms => {
                    const copy = ms.slice();
                    copy[assistantIndex] = { ...copy[assistantIndex], content: copy[assistantIndex].content + token };
                    return copy;
                  });
                }
              }
            }
        }
        clearTimeout(timer);
        setPhase("idle");
        return;
      }
    } catch (e) {
      // aborted or failed -> fallback
    }
    clearTimeout(timer);
    // fallback non-streaming
    try {
      setPhase("connecting");
      const r2 = await fetch(`${apiBase()}/llm/chat_sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ messages: history }),
        mode: "cors",
        credentials: "include",
      });
      const j = await r2.json();
      setMessages(m => [...m, { role: "assistant", content: j.text || "(no response)" }]);
      setPhase(j.ok ? "idle" : "error");
      if (!j.ok) setError(j.error || "LLM error");
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: "(fallback failed)" }]);
      setPhase("error");
      setError(err.message);
    }
  }

  async function handleSubmit(e){
    e.preventDefault();
    const text = input.trim();
    if (!text || phase === "connecting" || phase === "streaming") return;
    setInput("");
    setMessages((m)=>[...m, { role:"user", content:text }]);
    // Direct Playwright generation intent (without 'convert') e.g. "write playwright tests for login"
    if (/playwright/i.test(text) && /test/i.test(text) && !/convert|turn|transform/i.test(text)) {
      try {
        setPhase('connecting');
        // Derive feature after 'for'
        let feature = 'Feature';
        const m = text.match(/for\s+([^!.?]{3,80})/i);
        if (m) feature = m[1].replace(/playwright|tests?|test cases?/ig,'').trim();
        if (feature.length < 3) feature = 'Feature';
        // Ensure we have manual tests (generate if absent)
        let manualBlock = lastManualTests;
        if (!manualBlock) {
          const genBody = {
            feature: feature.charAt(0).toUpperCase()+feature.slice(1),
            criteria: '', risk:'medium', categories:['functional','edge','negative'], countPerCategory:2, detailed:true
          };
          const genResp = await fetch(`${apiBase()}/tools/testcases/generate`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeader()}, body: JSON.stringify(genBody) });
          const genData = await genResp.json().catch(()=>({}));
          if (!genResp.ok) throw new Error(genData.error || `Generator error (${genResp.status})`);
          const cases = genData.cases || [];
          const lines = [`Test Cases for ${genBody.feature}`];
          cases.forEach((c,i)=>{
            lines.push(`\n${i+1}. ${c.title} [${c.category}]`);
            if (Array.isArray(c.steps) && c.steps.length && typeof c.steps[0]==='object') {
              c.steps.forEach((s,si)=>{
                const act = s.action||''; const exp = s.expected?` => ${s.expected}`:'';
                lines.push(`  ${si+1}) ${act}${exp}`);
              });
            } else if (Array.isArray(c.steps)) {
              c.steps.forEach((s,si)=> lines.push(`  ${si+1}) ${s}`));
            }
            if (c.expected) lines.push(`  Expected: ${c.expected}`);
          });
          if (genData.summary) {
            const cats = Object.entries(genData.summary.categories||{}).map(([k,v])=>`${k}:${v}`).join(', ');
            lines.push(`\nSummary: ${genData.summary.total} cases (${cats})`);
          }
          manualBlock = lines.join('\n');
          setLastManualTests(manualBlock);
          // Also show manual block before code for transparency
          setMessages(m=>[...m,{ role:'assistant', content: manualBlock }]);
        }
        // Deterministic local conversion from manualBlock first
        function buildDeterministicCode(block){
          // Parse manual block lines into scenario objects
          const lines = block.split(/\r?\n/);
          const scenarios = [];
          let current = null;
          const titleRe = /^\s*(\d+)\.\s+(.+?)\s*\[(\w+)\]/;
          const stepRe = /^\s+\d+\)\s+(.*?)(?:\s*=>\s*(.*))?$/;
          for (const ln of lines){
            const t = titleRe.exec(ln);
            if (t){
              if (current) scenarios.push(current);
              current = { title: t[2].trim(), category: t[3], steps: [], expected: '' };
              continue;
            }
            if (current){
              const s = stepRe.exec(ln);
              if (s){ current.steps.push({ action: s[1].trim(), expected: (s[2]||'').trim() }); continue; }
              if (/^\s*Expected:/i.test(ln)){ current.expected = ln.split(/Expected:/i).pop().trim(); continue; }
            }
          }
          if (current) scenarios.push(current);
          if (!scenarios.length) return '';
          // Helper to sanitize method names
          const used = new Set();
          function methodName(title){
            let base = title.replace(/[^A-Za-z0-9 ]+/g,' ').trim().replace(/\s+/g,' ');
            if (!base) base = 'Scenario';
            base = base.split(' ').slice(0,8).map((w,i)=> i===0 ? capitalize(w) : capitalize(w)).join('');
            if (!/^[A-Za-z_]/.test(base)) base = 'T'+base;
            let name = base; let i=2;
            while (used.has(name)) { name = base + i++; }
            used.add(name); return name;
          }
          function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
          function actionToCode(a){
            const lower = a.toLowerCase();
            if (/navigate/.test(lower)) return 'await page.GotoAsync(LOGIN_URL);';
            if (/enter valid username/.test(lower)) return 'await page.FillAsync("#username", VALID_USER);';
            if (/enter valid password/.test(lower)) return 'await page.FillAsync("#password", VALID_PASS);';
            if (/enter incorrect password/.test(lower)) return 'await page.FillAsync("#password", "wrong-pass");';
            if (/enter maximum length username/.test(lower)) return 'await page.FillAsync("#username", new string(\'a\', MAX_USERNAME_LEN));';
            if (/enter username with special characters/.test(lower)) return 'await page.FillAsync("#username", "user+test@example.com");';
            if (/leave username and password fields empty/.test(lower)) return '// Intentionally leave fields empty';
            if (/click the login button/.test(lower)) return 'await page.ClickAsync("#loginButton");';
            if (/check the 'remember me' option|remember me/i.test(lower)) return 'await page.CheckAsync("#rememberMe");';
            if (/log out/.test(lower)) return 'await page.ClickAsync("#logoutLink");';
            if (/refresh the page/.test(lower)) return 'await page.ReloadAsync();';
            return '// TODO: '+a.replace(/"/g,'\"');
          }
          function expectedToAssert(e){
            if (!e) return [];
            const lower = e.toLowerCase();
            if (/successfully logs in|access(es)? the dashboard|redirected to the dashboard/.test(lower)) return ['await Expect(page).ToHaveURLAsync(DASHBOARD_URL);'];
            if (/error message is displayed|not allowed to log in/.test(lower)) return ['await Expect(page.Locator(".error")) .ToBeVisibleAsync();'];
            if (/username field is pre-filled/.test(lower)) return ['await Expect(page.Locator("#username")).ToHaveValueAsync(VALID_USER);'];
            if (/handles maximum length username/.test(lower)) return ['// TODO: assert max length handling (success or validation message)'];
            if (/processes special characters/.test(lower)) return ['// TODO: assert special character handling outcome'];
            if (/prompts user to fill in required fields/.test(lower)) return ['await Expect(page.Locator(".error")) .ToBeVisibleAsync();'];
            return ['// TODO: assert '+e.replace(/"/g,'\"')];
          }
          const header = `using System;\nusing System.Threading.Tasks;\nusing Microsoft.Playwright;\nusing Xunit;\n\npublic class PlaywrightTests : IAsyncLifetime {\n    private IPlaywright _playwright;\n    private IBrowser _browser;\n    private const string LOGIN_URL = "https://app.example.com/login";\n    private const string DASHBOARD_URL = "https://app.example.com/dashboard";\n    private const string VALID_USER = "test.user@example.com";\n    private const string VALID_PASS = "P@ssw0rd!";\n    private const int MAX_USERNAME_LEN = 64;\n\n    public async Task InitializeAsync(){\n        _playwright = await Microsoft.Playwright.Playwright.CreateAsync();\n        _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions{ Headless = true });\n    }\n    public async Task DisposeAsync(){\n        await _browser?.CloseAsync();\n        _playwright?.Dispose();\n    }\n\n    private async Task<IPage> NewPageAsync(){\n        var ctx = await _browser.NewContextAsync();\n        var page = await ctx.NewPageAsync();\n        return page;\n    }\n`;
          const methods = scenarios.map(sc => {
            const name = methodName(sc.title);
            const steps = sc.steps.map(s => '        '+actionToCode(s.action)).join('\n');
            const asserts = expectedToAssert(sc.expected).map(a=>'        '+a).join('\n');
            return `    [Fact]\n    public async Task ${name}(){\n        var page = await NewPageAsync();\n        // Scenario: ${sc.title}\n${steps}\n${asserts}\n    }\n`; }).join('\n');
          const footer = `}\n`;
          return header + methods + footer;
        }
        let deterministic = buildDeterministicCode(manualBlock);
        if (deterministic) {
          setMessages(m=>[...m,{ role:'assistant', content:'```csharp\n'+deterministic.trim()+'\n```' }]);
          setPhase('idle');
          return;
        }
        // If deterministic failed (unexpected format), fallback to LLM conversion path
        async function attemptConversion(strict = false) {
          const system = (strict ? 'STRICT MODE: ' : '') +
            'You convert manual QA test cases into a single Playwright C# test file. ' +
            'Output ONLY a fenced code block containing PURE C# code (no prose). ' +
            'Group scenarios into separate [Fact] methods (xUnit). No narrative outside code.';
          const user = `Convert these manual test cases to Playwright C#:\n${manualBlock}\nRequirements:\n- Public class PlaywrightTests.\n- Each scenario -> its own [Fact] async Task method.\n- Initialize Playwright/browser/context/page inside each test (simple pattern).\n- Derive steps into actions/assertions.\n- Use using Microsoft.Playwright;.\n- Use Expect assertions.\n- Minimal TODO comments only where unknown.\n- No explanations outside code.`;
          const resp = await fetch(`${apiBase()}/llm/chat_sync`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeader()}, body: JSON.stringify({ messages:[{role:'system', content:system},{role:'user', content:user}] }) });
          const data = await resp.json().catch(()=>({}));
          if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
          return data.text || '';
        }
        function extractCode(t){ const m = t.match(/```(?:csharp|cs|C#)?\n([\s\S]*?)```/i); return m?m[1].trim():t.trim(); }
        function looksLikeCSharp(code){ return /using\s+Microsoft\.Playwright\s*;/.test(code) || /class\s+PlaywrightTests/.test(code); }
        let attempt = await attemptConversion(false);
        let code = extractCode(attempt);
        if (!looksLikeCSharp(code)) { attempt = await attemptConversion(true); code = extractCode(attempt); }
        if (!code) throw new Error('Empty conversion output');
        if (!looksLikeCSharp(code)) code = '// WARNING: Uncertain Playwright output\n'+code;
        setMessages(m=>[...m,{ role:'assistant', content:'```csharp\n'+code+'\n```' }]);
        setPhase('idle');
        return;
      } catch(err) {
        setMessages(m=>[...m,{ role:'assistant', content:`(playwright generation failed: ${err.message})` }]);
        setPhase('error');
        return;
      }
    }
    // Detect explicit test case generation intent and short-circuit to dedicated generator
    if (/\btest cases?\b/i.test(text)) {
      try {
        setPhase("connecting");
        // Extract feature after 'for' if present
        let feature = text;
        const m = text.match(/for\s+([^?.!]{3,100})/i);
        if (m) feature = m[1];
        feature = feature.replace(/\b(functionality|feature|module)\b/ig, '').trim();
        if (feature.length < 3) feature = 'Feature';
        const body = {
          feature: feature.charAt(0).toUpperCase() + feature.slice(1),
          criteria: '',
          risk: 'medium',
          categories: ['functional','edge','negative'],
          countPerCategory: 2,
          detailed: true
        };
        const resp = await fetch(`${apiBase()}/tools/testcases/generate`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json', ...authHeader() },
          body: JSON.stringify(body)
        });
        const data = await resp.json().catch(()=>({}));
        if (!resp.ok) {
          throw new Error(data.error || `Generator error (${resp.status})`);
        }
        // Format cases into human-readable block
        const cases = data.cases || [];
        const lines = [];
        lines.push(`Test Cases for ${body.feature}`);
        cases.forEach((c,i)=>{
          lines.push(`\n${i+1}. ${c.title} [${c.category}]`);
          if (Array.isArray(c.steps) && c.steps.length && typeof c.steps[0] === 'object') {
            c.steps.forEach((s,si)=>{
              const act = s.action || '';
              const exp = s.expected ? ` => ${s.expected}` : '';
              lines.push(`  ${si+1}) ${act}${exp}`);
            });
          } else if (Array.isArray(c.steps)) {
            c.steps.forEach((s,si)=> lines.push(`  ${si+1}) ${s}`));
          }
          if (c.expected) lines.push(`  Expected: ${c.expected}`);
        });
        if (data.summary) {
          const cats = Object.entries(data.summary.categories||{}).map(([k,v])=>`${k}:${v}`).join(', ');
          lines.push(`\nSummary: ${data.summary.total} cases (${cats})`);
        }
        const block = lines.join('\n');
        setLastManualTests(block);
        setMessages(m=>[...m, { role:'assistant', content: block }]);
        setPhase('idle');
        return;
      } catch (err) {
        setMessages(m=>[...m, { role:'assistant', content:`(test case generation failed: ${err.message})` }]);
        setPhase('error');
        return;
      }
    }
    // Detect Playwright C# conversion intent
    if (/playwright/i.test(text) && /(c#|csharp|c sharp)/i.test(text) && /convert|generate|turn/i.test(text)) {
      try {
        setPhase('connecting');
        // Source manual tests from cache first, else from last assistant message pattern
        let manualBlock = lastManualTests;
        if (!manualBlock) {
          const lastTestsMsg = [...messages].reverse().find(m => m.role==='assistant' && /Test Cases for/i.test(m.content));
          if (lastTestsMsg) manualBlock = lastTestsMsg.content;
        }
        if (!manualBlock) {
          setMessages(m=>[...m,{role:'assistant', content:'I need manual test cases first. Ask: generate test cases for <feature> then request conversion.'}]);
          setPhase('idle');
          return;
        }

        // Helper to perform a conversion attempt
        async function attemptConversion(strict = false) {
          const system = (strict ? 'STRICT MODE: ' : '') +
            'You convert manual QA test cases into a single Playwright C# test file. ' +
            'Output ONLY a fenced code block containing PURE C# code (no prose). ' +
            'Group scenarios into separate [Fact] methods (xUnit). No narrative outside code.';
          const user = `Convert these manual test cases to Playwright C#:
${manualBlock}
Requirements:
- Public class PlaywrightTests.
- Each scenario -> its own [Fact] async Task method.
- Initialize Playwright/browser/context/page inside each test (simple pattern) or a lightweight helper.
- Derive steps into actions/assertions in order.
- Use using Microsoft.Playwright; and await Expect(page).ToHave* or similar for assertions.
- Add TODO comments only where selectors/data unknown.
- DO NOT output explanations outside code.`;
          const resp = await fetch(`${apiBase()}/llm/chat_sync`, {
            method:'POST', headers:{'Content-Type':'application/json', ...authHeader()},
            body: JSON.stringify({ messages: [ { role:'system', content: system }, { role:'user', content: user } ] })
          });
            let raw; let data; try { data = await resp.json(); raw = data; } catch { data = {}; }
            if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
            const text = (data && data.text) ? String(data.text) : '';
            return { text, raw };
        }

        function extractCode(t) {
          if (!t) return '';
          const m = t.match(/```(?:csharp|cs|C#)?\n([\s\S]*?)```/i);
          return m ? m[1].trim() : t.trim();
        }
        function looksLikeCSharp(code) {
          return /using\s+Microsoft\.Playwright\s*;/.test(code) || /IPlaywright|BrowserType\.LaunchAsync|new\s+Playwright/.test(code);
        }

        // 1st attempt
        let attempt = await attemptConversion(false);
        let codeBlock = extractCode(attempt.text);
        let valid = looksLikeCSharp(codeBlock) && /class\s+PlaywrightTests/.test(codeBlock);

        if (!valid) {
          // Retry stricter
            attempt = await attemptConversion(true);
            codeBlock = extractCode(attempt.text);
            valid = looksLikeCSharp(codeBlock) && /class\s+PlaywrightTests/.test(codeBlock);
        }

        if (!codeBlock) throw new Error('Empty conversion output');

        // If still not valid, append a diagnostic comment header so user can see raw
        if (!valid) {
          codeBlock = '// WARNING: Model did not produce recognizable Playwright structure. Raw response preserved below.\n' + codeBlock;
        }
        let finalOut = '```csharp\n' + codeBlock.trim() + '\n```';
        // Keep a record for possible further conversions
        setMessages(m=>[...m,{ role:'assistant', content: finalOut }]);
        setPhase('idle');
        return;
      } catch (err) {
        setMessages(m=>[...m,{ role:'assistant', content:`(conversion failed: ${err.message})` }]);
        setPhase('error');
        return;
      }
    }
    const history = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .concat({ role: "user", content: text });
    await askLLMWithFallback(history);
  }

  // Animated dots component
  const DotPulse = () => {
    const base = {
      width: 6, height: 6, borderRadius: 4, background: '#bbb', display: 'inline-block', margin: '0 3px',
      animation: 'qaDot 1s infinite ease-in-out'
    };
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center'}}>
        <span style={{ ...base, animationDelay: '0s'}} />
        <span style={{ ...base, animationDelay: '0.15s'}} />
        <span style={{ ...base, animationDelay: '0.30s'}} />
      </span>
    );
  };

  // Inject keyframes once
  useEffect(() => {
    const id = 'qa-dot-anim';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = `@keyframes qaDot {0%,80%,100% {transform: scale(.4); opacity:.4;} 40% {transform: scale(1); opacity:1;}}`;
      document.head.appendChild(el);
    }
  }, []);

  function statusLabel(){
    if (phase === 'connecting') return <DotPulse/>;
    if (phase === 'streaming') return <span style={{opacity:.7}}>…</span>;
    if (phase === 'error') return <span style={{color:'#ff8080'}}>error</span>;
    return null;
  }

  // Wrapper style differs between full-panel (fill) and compact card modes
  const wrapStyle = fill ? {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: "100%",
    margin: 0,
  } : {
    maxWidth: 800,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  };

  const listStyle = fill ? {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: 16,
    borderRadius: 16,
    background: "#2b2f34", // darker background for readability
  } : {
    height: boxHeight,
    overflowY: "auto",
    padding: 16,
    borderRadius: 16,
    background: "#2b2f34", // darker background for readability
    flexShrink: 0,
  };

  return (
    <div style={wrapStyle}>
      {!fill && <h2 style={{textAlign:"center"}}>🤖 QA Bot Chat</h2>}
      <div ref={boxRef} style={listStyle}>
        {messages.map((m,i)=> m.role==="assistant" ? <BotBubble key={i} text={m.content}/> : <UserBubble key={i} text={m.content}/>)}
        {statusLabel() && <div style={{opacity:.8, marginTop:6}}>{statusLabel()}</div>}
        {error && <div style={{color:"#ff8080", marginTop:4, fontSize:12}}>{error}</div>}
      </div>
      <form onSubmit={handleSubmit} style={{display:"flex", gap:8, marginTop:10, alignItems:"center"}}>
        <input
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          placeholder="Ask anything… (/help)"
          style={{flex:1, padding:"12px 14px", borderRadius:24, border:"none", background:"rgba(255,255,255,0.9)", color:"#333"}}
        />
        <button type="submit" disabled={phase === "connecting" || phase === "streaming"}>Send</button>
        {phase === "connecting" || phase === "streaming" ? (
          <button type="button" onClick={()=>abortRef.current?.abort()} style={{background:"#444", color:"#fff"}}>Stop</button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            setMessages([{ role: "assistant", content: "Hi! I’m QA Bot. Type /help for commands." }]);
            setError(null);
            setPhase("idle");
          }}
          title="Clear chat"
          aria-label="Clear chat"
          style={{ background: "#333", color: "#fff", borderRadius: 24, padding: "10px 14px", border: "none" }}
        >
          ✕
        </button>
      </form>
    </div>
  );
}
