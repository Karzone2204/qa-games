import React, { useMemo, useState } from "react";
import { toast } from "../../services/toast";

export default function TestCaseGen(){
  const [feature, setFeature] = useState("");
  const [criteria, setCriteria] = useState("");
  const [level, setLevel] = useState("medium");
  const [types, setTypes] = useState({ functional:true, edge:true, negative:true, security:false, i18n:false, perf:false, accessibility:false });
  const [aiMode, setAiMode] = useState(true); // default enabled
  const [detailed, setDetailed] = useState(true); // default enabled
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [format, setFormat] = useState("standard"); // standard | gherkin
  const [aiCases, setAiCases] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiPrereqs, setAiPrereqs] = useState([]);
  const [gherkinText, setGherkinText] = useState("");

  const cases = useMemo(() => {
    if (!feature) return [];
    const out = [];
    const add = (title, steps, expected, tag) => out.push({ title, steps, expected, tag });

    if (types.functional){
      add(`Happy path - ${feature}`,
        ["Open app","Navigate to feature","Provide valid inputs per AC","Submit/Save"],
        "Operation succeeds per AC; UI and DB reflect changes", "functional");
    }
    if (types.edge){
      add("Boundary - min values", ["Enter minimum values at boundaries","Submit"], "Accepted or validated per AC", "edge");
      add("Boundary - max values", ["Enter maximum values at boundaries","Submit"], "Accepted or validated per AC", "edge");
      add("Empty/whitespace handling", ["Leave fields empty/whitespace","Submit"], "Validation messages shown; no crash", "edge");
    }
    if (types.negative){
      add("Invalid format", ["Enter invalid email/phone/ID","Submit"], "Relevant error; no data saved", "negative");
      add("Unauthorized action", ["Use non-privileged user","Attempt restricted action"], "Access denied; no data change", "negative");
    }
    if (types.security){
      add("XSS blocking", ["Paste `<script>alert(1)</script>` into text field","Save"], "Script not executed; stored safely", "security");
      add("Rate limit", ["Rapidly submit requests (>=20/10s)"], "429/limit behavior; app remains stable", "security");
    }
    if (types.i18n){
      add("Long text/RTL", ["Switch to Arabic/long strings","View layout"], "Layout intact; text readable & not clipped", "i18n");
    }
    if (types.perf){
      add("Perf smoke", ["Load feature with 1k records"], "Loads < 2s on baseline; no UI freeze", "perf");
    }

    if (criteria){
      add("AC coverage", ["Cross-check each AC item with steps"], "Each AC mapped to at least one test", "traceability");
    }
    return out;
  }, [feature, criteria, types]);

  async function generateAI(){
    if (!feature.trim()) return toast("Feature required");
    setLoading(true);
    setStatus("Processing request...");
  setAiCases([]); setAiSummary(null); setAiPrereqs([]); setGherkinText("");
    try {
      const categories = Object.entries(types).filter(([k,v])=>v).map(([k])=>k);
      const body = { feature, criteria, risk: level, categories, countPerCategory: 2, detailed, format };
      const base = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
      setStatus(format==='gherkin' ? 'Preparing Gherkin scenarios...' : 'Preparing test scenarios...');
      const r = await fetch(`${base}/tools/testcases/generate`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${localStorage.getItem('token')||''}` },
        body: JSON.stringify(body)
      });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) {
        toast(data.error || `Generation failed (${r.status})`);
        setStatus('');
      } else {
        if (format === 'gherkin'){
          setGherkinText(data.gherkin || '');
          setStatus('Generated Gherkin scenarios.');
        } else {
          setAiPrereqs(Array.isArray(data.prerequisites) ? data.prerequisites : []);
          setAiCases(data.cases || []);
          setAiSummary(data.summary || null);
          setStatus('Generated test scenarios.');
        }
      }
    } catch(e){
      toast('Network error');
      setStatus('');
    } finally { setLoading(false); }
  }

  function escapeMd(str){
    return String(str||'').replace(/\|/g,'\\|').replace(/`/g,'\\`');
  }

  function copyMarkdown(){
    if (format === 'gherkin'){
      if (!gherkinText.trim()) return toast('Nothing to copy');
      navigator.clipboard.writeText(gherkinText).then(()=>toast('Copied Gherkin'));
      return;
    }
    const list = aiMode ? aiCases : cases;
    if (!list.length) return toast('Nothing to copy');
    const body = list.map((c,i)=>{
      const steps = c.steps || [];
      let stepsBlock;
      if (steps.length && typeof steps[0] === 'object' && steps[0] !== null && 'action' in steps[0]){
        const rows = steps.map((s,si)=>`| ${si+1} | ${escapeMd(s.action)} | ${escapeMd(s.expected||'')} |`).join('\n');
        stepsBlock = `**Steps**\n\n| # | Action | Expected |\n|---|--------|----------|\n${rows}`;
      } else {
        stepsBlock = `- Steps:\n` + steps.map(s=>`  - ${escapeMd(s)}`).join('\n');
      }
      return `## ${i+1}. ${c.title} [${c.category||c.tag}]\n${stepsBlock}\n- Expected: ${escapeMd(c.expected)}${c.rationale?`\n- Rationale: ${escapeMd(c.rationale)}`:''}${c.riskAlignment?`\n- Risk: ${escapeMd(c.riskAlignment)}`:''}`;
    }).join('\n\n');
    const summary = aiMode && aiSummary ? `\n\n---\n**Summary:** ${aiSummary.total} cases. ` + Object.entries(aiSummary.categories||{}).map(([k,v])=>`${k}:${v}`).join(', ') : '';
    const md = `# Test Cases for ${feature}\n\n${body}${summary}`;
    navigator.clipboard.writeText(md).then(()=>toast('Copied markdown'));
  }

  function exportCSV(){
    const list = aiMode ? aiCases : cases;
    if (!list.length) return toast('Nothing to export');
    // Determine if detailed (object steps) present
    const detailedMode = list.some(c=>Array.isArray(c.steps) && c.steps[0] && typeof c.steps[0]==='object' && 'action' in c.steps[0]);
    const rows = [];
    const header = detailedMode
      ? ['CaseID','Title','Category','Step #','Action','Expected Step Result','Overall Expected','Rationale','Risk Alignment']
      : ['CaseID','Title','Category','Step #','Step','Overall Expected','Rationale','Risk Alignment'];
    rows.push(header.join(','));
    list.forEach(c=>{
      const steps = Array.isArray(c.steps) ? c.steps : [];
      if (steps.length){
        steps.forEach((s,idx)=>{
          if (detailedMode){
            const action = (s.action||'').replace(/"/g,'""');
            const exp = (s.expected||'').replace(/"/g,'""');
            rows.push([
              c.id||'',`"${(c.title||'').replace(/"/g,'""')}"`,c.category||'',idx+1,`"${action}"`,`"${exp}"`,
              `"${(c.expected||'').replace(/"/g,'""')}"`,`"${(c.rationale||'').replace(/"/g,'""')}"`,`"${(c.riskAlignment||'').replace(/"/g,'""')}"`
            ].join(','));
          } else {
            const stepStr = String(s||'').replace(/"/g,'""');
            rows.push([
              c.id||'',`"${(c.title||'').replace(/"/g,'""')}"`,c.category||'',idx+1,`"${stepStr}"`,
              `"${(c.expected||'').replace(/"/g,'""')}"`,`"${(c.rationale||'').replace(/"/g,'""')}"`,`"${(c.riskAlignment||'').replace(/"/g,'""')}"`
            ].join(','));
          }
        });
      } else {
        // No steps entry
        rows.push([
          c.id||'',`"${(c.title||'').replace(/"/g,'""')}"`,c.category||'','', '',
          `"${(c.expected||'').replace(/"/g,'""')}"`,`"${(c.rationale||'').replace(/"/g,'""')}"`,`"${(c.riskAlignment||'').replace(/"/g,'""')}"`
        ].join(','));
      }
    });
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${feature.replace(/[^a-z0-9_-]+/gi,'_') || 'testcases'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Exported CSV');
  }

  return (
    <div className="game-container active">
      <h2 style={{textAlign:"center"}}>🧩 Test Case Generator</h2>
  <div style={{display:"grid", gap:10, maxWidth:1200, margin:"0 auto"}}>
        <input style={input} placeholder="Feature / Module (e.g., Login, Create Ticket)"
               value={feature} onChange={e=>setFeature(e.target.value)} />
        <textarea style={{...input, minHeight:90}} placeholder="User Story / Acceptance Criteria (optional)"
                  value={criteria} onChange={e=>setCriteria(e.target.value)} />
        <div style={{display:"flex", flexWrap:"wrap", gap:10}}>
          <select style={input} value={level} onChange={e=>setLevel(e.target.value)}>
            <option value="low">Risk: Low</option>
            <option value="medium">Risk: Medium</option>
            <option value="high">Risk: High</option>
          </select>
          <select style={input} value={format} onChange={e=>setFormat(e.target.value)}>
            <option value="standard">Format: Standard</option>
            <option value="gherkin">Format: Gherkin (BDD)</option>
          </select>
          <label style={{display:"flex",alignItems:"center",gap:6, background:"rgba(255,255,255,0.25)", padding:"8px 10px", borderRadius:12}}>
            <input type="checkbox" checked={aiMode} onChange={e=>setAiMode(e.target.checked)} /> AI Mode
          </label>
          {aiMode && (
            <label style={{display:"flex",alignItems:"center",gap:6, background:"rgba(255,255,255,0.25)", padding:"8px 10px", borderRadius:12}}>
              <input type="checkbox" checked={detailed} onChange={e=>setDetailed(e.target.checked)} /> Detailed
            </label>
          )}
          {["functional","edge","negative","security","i18n","perf","accessibility"].map(k=>(
            <label key={k} style={{display:"flex",alignItems:"center",gap:6, background:"rgba(255,255,255,0.15)", padding:"8px 10px", borderRadius:12}}>
              <input type="checkbox" checked={types[k]} onChange={e=>setTypes({...types, [k]:e.target.checked})}/>
              {k}
            </label>
          ))}
        </div>
        {aiMode && (
          <div style={{textAlign:'right'}}>
            <button disabled={loading} onClick={generateAI}>{loading? 'Generating...' : '⚙️ Generate with AI'}</button>
            {status && <div style={{marginTop:6, fontSize:12, opacity:0.85}}>{status}</div>}
          </div>
        )}
      </div>

  <div style={{maxWidth:1200, margin:"14px auto"}}>
        {format==='gherkin' ? (
          gherkinText ? (
            <>
              <div className="stat-card" style={{padding:'10px 12px', textAlign:'left', overflowX:'auto'}}>
                <pre style={{...preBlock, whiteSpace:'pre'}}>{gherkinText}</pre>
              </div>
              <div style={{textAlign:'center', marginTop:10}}>
                <button onClick={copyMarkdown}>📋 Copy</button>
              </div>
            </>
          ) : (
            <p style={{textAlign:"center"}}>Enter a feature then click Generate.</p>
          )
        ) : ((aiMode ? aiCases.length===0 : cases.length===0) ? <p style={{textAlign:"center"}}>Enter a feature{aiMode?' then click Generate':' to generate suggestions'}.</p> : (
          <>
            {!!aiPrereqs.length && (
              <div className="stat-card" style={{marginTop:10, textAlign:'left'}}>
                <h4>Pre-requisites</h4>
                <ul style={{marginTop:6}}>
                  {aiPrereqs.map((p,i)=>(<li key={i}>{p}</li>))}
                </ul>
              </div>
            )}
            {(aiMode ? aiCases : cases).map((c,i)=>(
              <div key={i} className="stat-card" style={{marginTop:10, textAlign:"left"}}>
                <h4>{i+1}. {c.title} <small>({c.category || c.tag})</small></h4>
                {Array.isArray(c.steps) && c.steps.length>0 && typeof c.steps[0] === 'object' && c.steps[0] !== null && 'action' in c.steps[0] ? (
                  <table style={{width:'100%', marginTop:6, borderCollapse:'collapse', fontSize:14}}>
                    <thead>
                      <tr>
                        <th style={th}>Step Action</th>
                        <th style={th}>Expected Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.steps.map((s,si)=>(
                        <tr key={si}>
                          <td style={td}>{s.action}</td>
                          <td style={td}>{s.expected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <ul style={{marginTop:6}}>
                    {(c.steps||[]).map((s,si)=><li key={si}>{s}</li>)}
                  </ul>
                )}
                <p><b>Expected:</b> {c.expected}</p>
                {c.rationale && <p style={{fontSize:14,opacity:0.8}}><b>Rationale:</b> {c.rationale}</p>}
                {c.riskAlignment && <p style={{fontSize:14,opacity:0.8}}><b>Risk:</b> {c.riskAlignment}</p>}
              </div>
            ))}
            {aiMode && aiSummary && (
              <div className="stat-card" style={{marginTop:14}}>
                <b>Summary:</b> {aiSummary.total} cases. {Object.entries(aiSummary.categories||{}).map(([k,v])=>`${k}:${v}`).join(', ')}
              </div>
            )}
            <div style={{textAlign:"center", marginTop:10}}>
              <button onClick={copyMarkdown}>📋 Copy Markdown</button>{' '}
              <button onClick={exportCSV}>� Export CSV</button>
            </div>
          </>
        ))}
      </div>
    </div>
  );
}

const input = {
  padding:"12px 14px", borderRadius:12, border:"none",
  background:"rgba(255,255,255,0.9)", color:"#333", width:"100%"
};

const th = { textAlign:'left', padding:'6px 8px', borderBottom:'1px solid #ccc', background:'rgba(0,0,0,0.05)' };
const td = { padding:'6px 8px', borderBottom:'1px solid #eee', verticalAlign:'top' };
const preBlock = { whiteSpace:'pre-wrap', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize:13 };
