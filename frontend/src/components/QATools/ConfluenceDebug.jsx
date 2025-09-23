import React, { useState } from "react";

export default function ConfluenceDebug(){
  const [q, setQ] = useState("");
  const [k, setK] = useState(4);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState([]);
  const [error, setError] = useState(null);

  async function search(){
    setLoading(true); setError(null); setHits([]);
    try{
      const RAW = import.meta.env.VITE_API_BASE || "";
      const BASE = (RAW||"").replace(/\/+$/,'');
      const url = `${BASE}${BASE?"":""}/tools/confluence/search?query=${encodeURIComponent(q)}&k=${k}`;
      const tok = localStorage.getItem('token') || sessionStorage.getItem('token');
      const r = await fetch(url, { headers: { Authorization: tok ? `Bearer ${tok}` : undefined } });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setHits(Array.isArray(data?.hits) ? data.hits : []);
    }catch(e){
      setError(e?.response?.data?.error || e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 style={{marginTop:0}}>Confluence Debug Search</h3>
      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12}}>
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Search query (e.g., Gateway Testing Strategy)"
          style={{flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #444', color:'#eee', background:'#111'}}
        />
        <input
          type="number"
          min={1}
          max={8}
          value={k}
          onChange={e=>setK(Math.max(1, Math.min(8, parseInt(e.target.value)||4)))}
          style={{width:70, padding:'8px 10px', borderRadius:8, border:'1px solid #444', color:'#eee', background:'#111'}}
          title="Top K"
        />
        <button onClick={search} disabled={loading || q.trim().length<3} style={{padding:'8px 14px'}}>Search</button>
      </div>
      {error && <div style={{color:'#f66', marginBottom:8}}>Error: {error}</div>}
      {loading && <div style={{opacity:0.8}}>Searching…</div>}
      {!loading && hits && hits.length>0 && (
        <div style={{display:'grid', gap:10}}>
          {hits.map((h, idx) => (
            <div key={idx} style={{border:'1px solid #333', borderRadius:8, padding:10, background:'#0b0b0b'}}>
              <div style={{fontWeight:600, marginBottom:6}}>{h.title || '(Untitled)'}</div>
              {h.url && <div style={{marginBottom:6}}><a href={h.url} target="_blank" rel="noreferrer">{h.url}</a></div>}
              <div style={{whiteSpace:'pre-wrap', color:'#ccc'}}>{h.snippet}</div>
            </div>
          ))}
        </div>
      )}
      {!loading && hits && hits.length===0 && q.trim().length>=3 && !error && (
        <div style={{opacity:0.7}}>No hits.</div>
      )}
    </div>
  );
}
