import React, { useState, useEffect } from "react";

const RAW_BASE = import.meta.env.VITE_API_BASE || "";
const BASE = RAW_BASE.replace(/\/+$/, "");

export default function DataGen(){
  const [meta, setMeta] = useState(null);
  const [availability, setAvailability] = useState({});
  const [env, setEnv] = useState("");
  const [feed, setFeed] = useState("");
  const [requestType, setRequestType] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { template, ctx }
  const [payloadText, setPayloadText] = useState("");
  const [response, setResponse] = useState(null); // submit response
  const [copied, setCopied] = useState(false);
  const [usePwshToken, setUsePwshToken] = useState(true);
  const [usePwshSubmit, setUsePwshSubmit] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ state: 'idle', message: '' });
  const [steps, setSteps] = useState({ post: 'idle', poll: 'idle', postMsg: '', pollMsg: '', order: null, attempt: 0, max: 10, nextIn: 0 });
  const [savedSourceFile, setSavedSourceFile] = useState("");

  useEffect(()=>{ fetchMeta(); }, []);

  // When feed changes, ensure requestType is aligned to the first option
  useEffect(()=>{
    if(!meta) return;
    const currentFeed = meta.feeds?.find(f=>f.key===feed);
    if(currentFeed && Array.isArray(currentFeed.requestTypes) && currentFeed.requestTypes.length){
      if(!currentFeed.requestTypes.includes(requestType)){
        setRequestType(currentFeed.requestTypes[0]);
      }
    }
  }, [feed, meta]);

  async function fetchMeta(){
    try{
      setLoadingMeta(true);
      setError("");
      const res = await fetch(`${BASE}/datagen/meta`);
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { throw new Error(`Meta endpoint returned non-JSON (status ${res.status})`); }
      if(!res.ok || data.error) throw new Error(data.error || `Meta load failed ${res.status}`);
  setMeta(data);
  setAvailability(data.availability || {});
      if(data.environments?.length) setEnv(data.environments[0].key);
      if(data.feeds?.length) setFeed(data.feeds[0].key);
      if(data.feeds?.[0]?.requestTypes?.length) setRequestType(data.feeds[0].requestTypes[0]);
    }catch(e){ setError(e.message); }
    finally { setLoadingMeta(false); }
  }

  async function doGenerate(){
    if(!env || !feed || !requestType) return;
    const isAvailable = !!availability?.[feed]?.[requestType];
    if(!isAvailable){
      // Show a friendly message instead of attempting to generate
      setSubmitStatus({ state:'error', message:`Coming soon: ${meta?.feeds?.find(f=>f.key===feed)?.name || feed} • ${requestType}` });
      return;
    }
    try{
      setGenerating(true);
      setError("");
      setResult(null);
      setResponse(null);
      // Clear any previous progress/order details immediately upon Generate
      setSubmitStatus({ state:'idle', message:'' });
      setSteps({ post: 'idle', poll: 'idle', postMsg: '', pollMsg: '', order: null, attempt: 0, max: 10, nextIn: 0 });
      setSavedSourceFile("");
      const body = { environment: env, feed, requestType };
      const resp = await fetch(`${BASE}/datagen/generate`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const text = await resp.text();
      let data; try { data = JSON.parse(text);} catch { throw new Error(`Generate returned non-JSON (status ${resp.status})`); }
      if(!resp.ok || data.error) throw new Error(data.error || `Generate failed ${resp.status}`);
      setResult(data);
      setPayloadText(JSON.stringify(data.template, null, 2));
      if(data.savedSourceFile) setSavedSourceFile(data.savedSourceFile);
    }catch(e){ setError(e.message); }
    finally { setGenerating(false); }
  }

  async function doSubmit(){
    if(!payloadText.trim()) return;
    try{
      setSubmitting(true); setError(""); setResponse(null);
  setSteps({ post:'pending', poll:'idle', postMsg:`Posting to ${env}${usePwshSubmit ? ' via PowerShell' : ''}…`, pollMsg:'', order:null, attempt:0, max:10, nextIn:0 });
      setSubmitStatus({ state:'pending', message:`Submitting to ${env}${usePwshSubmit ? ' via PowerShell' : ''}…` });
      let parsed; try { parsed = JSON.parse(payloadText); } catch { throw new Error("Payload JSON invalid"); }
  const body = { environment: env, feed, payload: parsed };
      if(usePwshToken) body.usePwshToken = true;
      if(usePwshSubmit) body.usePwshSubmit = true;
      const resp = await fetch(`${BASE}/datagen/submit`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const text = await resp.text();
      let data; try { data = JSON.parse(text);} catch { throw new Error(`Submit returned non-JSON (status ${resp.status})`); }
      if(!resp.ok || data.error) throw new Error(data.error || `Submit failed ${resp.status}`);
      setResponse(data);
      setSteps(s=>({ ...s, post:'success', postMsg:`Multitype posted • HTTP ${data.status}` }));
      setSubmitStatus({ state:'success', message:`Multitype posted • HTTP ${data.status}` });
      const kw = deriveLastNameFromPayloadText(payloadText);
      if(kw){ doPoll(kw); } else { setSteps(s=>({ ...s, poll:'error', pollMsg:'Could not derive LastName keyword from payload' })); }
    }catch(e){ setError(e.message); setSubmitStatus({ state:'error', message:`Submit failed: ${e.message}` }); setSteps(s=>({ ...s, post:'error', postMsg:`Submit failed: ${e.message}` })); }
    finally { setSubmitting(false); }
  }

  function deriveLastNameFromPayloadText(text){
    try{
      const obj = JSON.parse(text || '{}');
      const arr = obj.Payloads || obj.payloads || [];
      for(const m of arr){
        const mt = m.MessageType ?? m.messageType;
        const p = m.Payload ?? m.payload;
        if(mt === 11 && p){
          const ln = p.LastName ?? p.lastName;
          if(typeof ln === 'string' && ln.trim()) return ln.trim();
        }
      }
    }catch{
      // ignore
    }
    return null;
  }

  async function doPoll(keyword){
    try{
      setSteps(s=>({ ...s, poll:'pending', pollMsg:`Trying to poll the order with keyword '${keyword}'…`, attempt: 0, max: 10 }));
      const resp = await fetch(`${BASE}/datagen/poll-order`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ environment: env, keyword, maxAttempts:10 }) });
      const text = await resp.text();
      let data; try { data = JSON.parse(text);} catch { throw new Error(`Poll returned non-JSON (status ${resp.status})`); }
      if(!resp.ok || data.error) throw new Error(data.error || `Poll failed ${resp.status}`);
      if(data.found){
        setSteps(s=>({ ...s, poll:'success', pollMsg:`Order found in ${data.attempts} attempt(s)`, order: { id: data.id, orderReference: data.orderReference, raw: data.result }, attempt: data.attempts }));
      } else {
        setSteps(s=>({ ...s, poll:'error', pollMsg:`Order not created within attempt window (${data.attempts})`, attempt: data.attempts }));
      }
    }catch(e){
      setSteps(s=>({ ...s, poll:'error', pollMsg:`Poll failed: ${e.message}` }));
    }
  }

  function copyPayload(){
    if(!payloadText) return;
    navigator.clipboard.writeText(payloadText).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false), 1200);
    });
  }

  function downloadPayload(){
    if(!payloadText) return;
    const blob = new Blob([payloadText], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payload_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const currentFeed = meta?.feeds?.find(f=>f.key===feed);
  const requestTypes = currentFeed?.requestTypes || [];
  const isAvailable = !!availability?.[feed]?.[requestType];

  return (
    <div className="game-container active" style={{display:'flex', flexDirection:'column', gap:16}}>
      <h2 style={{textAlign:'center'}}>🧪 Integration Data Generator</h2>
      {loadingMeta && <p>Loading meta...</p>}
      {meta && (
        <div style={{display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', alignItems:'center'}}>
          <select style={sel} value={env} onChange={e=>setEnv(e.target.value)}>
            {meta.environments.map(e=> <option key={e.key} value={e.key}>{e.name}</option>)}
          </select>
          <select style={sel} value={feed} onChange={e=>{setFeed(e.target.value);}}>
            {meta.feeds.map(f=> <option key={f.key} value={f.key}>{f.name}</option>)}
          </select>
          <select style={sel} value={requestType} onChange={e=>setRequestType(e.target.value)}>
            {requestTypes.map(rt => {
              const avail = !!availability?.[feed]?.[rt];
              return (
                <option key={rt} value={rt} disabled={!avail}>
                  {rt}{avail ? '' : ' (coming soon)'}
                </option>
              );
            })}
          </select>
          <button disabled={generating || !env || !feed || !requestType} onClick={doGenerate} title="Generate payload" style={btnGen}>
            <IconSparkles size={22} /> {generating? 'Generating…' : 'Generate'}
          </button>
          <button disabled={submitting || !payloadText} onClick={doSubmit} title="Submit payload" style={btnSubmit}>
            <IconSend /> {submitting? 'Submitting…' : 'Submit'}
          </button>
          {/* Poll button removed; auto-poll runs after submit */}
          <button onClick={()=>setShowAdvanced(s=>!s)} title="Advanced settings" aria-label="Advanced settings" style={{...iconBtn, marginLeft:8}}>
            ⚙️
          </button>
        </div>
      )}

      {showAdvanced && (
        <div className="stat-card" style={{marginTop:8, padding:'10px 12px'}}>
          <div style={{display:'flex', gap:16, flexWrap:'wrap', alignItems:'center', justifyContent:'center'}}>
            <label style={{display:'inline-flex', alignItems:'center', gap:8, fontSize:13}}>
              <input type="checkbox" checked={usePwshToken} onChange={e=>setUsePwshToken(e.target.checked)} />
              Use PowerShell for token
            </label>
            <label style={{display:'inline-flex', alignItems:'center', gap:8, fontSize:13}}>
              <input type="checkbox" checked={usePwshSubmit} onChange={e=>setUsePwshSubmit(e.target.checked)} />
              Submit via PowerShell
            </label>
            <div style={{fontSize:12, opacity:.7}}>
              Backend must allow PowerShell path (DATA_GEN_ALLOW_PWSH=1).
            </div>
          </div>
          {/* Source inputs removed per requirement to store source in solution */}
          {savedSourceFile && (
            <div style={{marginTop:8, fontSize:12, opacity:.85}}>
              Saved source file: <code style={{opacity:0.9}}>{savedSourceFile}</code>
            </div>
          )}
        </div>
      )}
      {/* Manual token override removed per user request */}
      {result && (
        <div style={{display:'flex', gap:16, flexWrap:'wrap'}}>
          <div style={{flex:'1 1 560px', minWidth:420}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <h4 style={{margin:'6px 0'}}>Payload (editable)</h4>
              <div style={{display:'flex', gap:8, alignItems:'center'}}>
                <button disabled={!payloadText} onClick={copyPayload} title="Copy payload" aria-label="Copy payload" style={iconBtn}>📋</button>
                <button disabled={!payloadText} onClick={downloadPayload} title="Download payload" aria-label="Download payload" style={iconBtn}>💾</button>
              </div>
            </div>
            {submitStatus.state !== 'idle' && (
              <div style={statusBarStyle(submitStatus.state)}>
                {submitStatus.state === 'pending' ? '⏳ ' : (submitStatus.state === 'success' ? '✅ ' : '❌ ')}
                <span>{submitStatus.message}</span>
              </div>
            )}
            {(steps.post !== 'idle' || steps.poll !== 'idle') && (
              <div className="stat-card" style={{margin:'8px 0', padding:'8px 10px'}}>
                <div style={{fontSize:13, lineHeight:1.6}}>
                  <div>
                    {steps.post==='pending' && '⏳'}
                    {steps.post==='success' && '✅'}
                    {steps.post==='error' && '❌'}
                    <span style={{marginLeft:6}}>{steps.postMsg}</span>
                  </div>
                  {steps.post!=='idle' && (
                    <div>
                      {steps.poll==='idle' && <span style={{opacity:.7}}>Step 2 will begin after submit…</span>}
                      {steps.poll==='pending' && (
                        <>
                          <span className="spinner" style={{display:'inline-block', width:14, height:14, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 1s linear infinite'}} />
                          <span style={{marginLeft:8}}>
                            {steps.pollMsg || 'Trying to poll the order…'}
                            {steps.attempt > 0 && <span style={{marginLeft:8, opacity:.8}}>(attempt {steps.attempt}/{steps.max})</span>}
                          </span>
                        </>
                      )}
                      {steps.poll==='success' && <>✅ <span style={{marginLeft:6}}>{steps.pollMsg}</span></>}
                      {steps.poll==='error' && <>❌ <span style={{marginLeft:6}}>{steps.pollMsg}</span></>}
                    </div>
                  )}
                </div>
                {steps.order && (
                  <div style={{marginTop:8, fontSize:13}}>
                    <div><b>Order ID:</b> <code>{steps.order.id}</code></div>
                    <div>
                      <b>Order Reference:</b>{' '}
                      <a
                        href={`https://ig-weu-tst-gateway-ui.azurewebsites.net/order/${steps.order.id}/manage/dashboard`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color:'#9ecbff', textDecoration:'underline' }}
                      >
                        {steps.order.orderReference}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
            <textarea value={payloadText} onChange={e=>setPayloadText(e.target.value)} style={{width:'100%', minHeight:420, fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize:13, lineHeight:1.4, padding:12, borderRadius:10, background:'rgba(0,0,0,0.25)', color:'#eee'}} />
          </div>
          <div style={{flex:'1 1 420px', minWidth:360}}>
            <h4 style={{margin:'6px 0'}}>Context</h4>
            <pre style={{...pre, maxHeight:500, fontSize:13}}>{JSON.stringify(result.ctx, null, 2)}</pre>
          </div>
        </div>
      )}
      {response && (
        <div style={{marginTop:8}}>
          <h4 style={{margin:'4px 0'}}>Submission Result (status {response.status})</h4>
          <pre style={pre}>{JSON.stringify(response.data, null, 2)}</pre>
          {response.debug && (
            <div style={{marginTop:8}}>
              <h4 style={{margin:'4px 0'}}>Outbound Debug (temp)</h4>
              <pre style={pre}>{JSON.stringify(response.debug, null, 2)}</pre>
              <p style={{fontSize:11, opacity:0.7}}>Remove by unsetting DATA_GEN_DEBUG_OUTBOUND or after fix.</p>
            </div>
          )}
        </div>
      )}
      {!result && !loadingMeta && !error && (
        <p style={{textAlign:'center', opacity:.7}}>Select environment, feed & request type then Generate.</p>
      )}
    </div>
  );
}

const sel = { padding:"10px 12px", borderRadius:12, border:"none", background:"rgba(255,255,255,0.9)", color:"#333" };
const pre = { margin:0, background:'rgba(0,0,0,0.25)', padding:12, borderRadius:10, fontSize:13, maxHeight:380, overflow:'auto' };
const btnGen = { padding:"10px 14px", border:"none", borderRadius:12, background:"#1e88e5", color:"#fff", cursor:"pointer", display:'inline-flex', alignItems:'center', gap:8 };
const btnSubmit = { padding:"10px 14px", border:"none", borderRadius:12, background:"#43a047", color:"#fff", cursor:"pointer", display:'inline-flex', alignItems:'center', gap:8 };
const iconBtn = { background:"transparent", border:"none", color:"#fff", padding:"6px 8px", borderRadius:8, cursor:"pointer" };

function statusBarStyle(state){
  const base = { margin:'4px 0 8px', padding:'8px 10px', borderRadius:8, fontSize:12 };
  if(state === 'pending') return { ...base, background:'rgba(255,255,255,0.14)', color:'#fff' };
  if(state === 'success') return { ...base, background:'rgba(67,160,71,0.25)', color:'#e6ffe9' };
  if(state === 'error') return { ...base, background:'rgba(229,57,53,0.25)', color:'#ffe6e6' };
  return base;
}

function IconSparkles({ size, small=false }){
  const s = size ?? (small ? 14 : 22);
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      {/* large sparkle */}
      <path d="M12 5l1.2 3.2L16.4 9.4 13.2 10.6 12 13.8 10.8 10.6 7.6 9.4l3.2-1.2L12 5z" fill="currentColor"/>
      {/* small sparkle top-right */}
      <path d="M18.5 4.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3z" fill="currentColor" opacity="0.9"/>
      {/* small sparkle bottom-left */}
      <path d="M6 15l.5 1.3 1.3.5-1.3.5L6 18.6l-.5-1.3-1.3-.5 1.3-.5L6 15z" fill="currentColor" opacity="0.8"/>
    </svg>
  );
}

function IconSend(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22l-4-9-9-4L22 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
