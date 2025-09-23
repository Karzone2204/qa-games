import React, { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

export default function AppLinks(){
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name:"", env:"dev", url:"", tags:"" });
  const [envFilter, setEnvFilter] = useState("dev");

  async function load(currentEnv){
    const r = await api.getLinks(currentEnv);
    if (!r.error) setItems(r.items||[]);
  }
  useEffect(()=>{ load(envFilter); }, [envFilter]);

  async function save(){
    if (!isAdmin) return;
    const body = { ...form, tags: form.tags.split(",").map(s=>s.trim()).filter(Boolean) };
    const r = await api.createLink(body);
    if (!r.error){ setForm({ name:"", env:"dev", url:"", tags:"" }); load(); }
    else alert(r.error);
  }
  async function remove(id){ if (!isAdmin) return; if (!confirm("Delete link?")) return; const r = await api.deleteLink(id); if (!r.error) load(); }

  return (
    <div className="game-container active">
      <h2 style={{textAlign:"center"}}>🔗 App Links</h2>
      <div style={{display:"flex", justifyContent:"center", marginBottom:12}}>
        <div style={{position:"relative"}}>
          <select value={envFilter} onChange={e=>setEnvFilter(e.target.value)}
                  style={{...fancySel}} aria-label="Environment filter">
            {['dev','test','stage','prod'].map(e=> <option key={e} value={e}>{labelForEnv(e)}</option>)}
          </select>
        </div>
      </div>

      {isAdmin && (
        <div className="stat-card" style={{marginBottom:16}}>
          <h4>Add Link</h4>
          <div style={{display:"grid", gridTemplateColumns:"1fr 120px 1.5fr 1fr auto", gap:8}}>
            <input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} style={inp}/>
            <select value={form.env} onChange={e=>setForm({...form, env:e.target.value})} style={inp}>
              {["dev","test","stage","prod"].map(e=><option key={e}>{e}</option>)}
            </select>
            <input placeholder="URL (https://…)" value={form.url} onChange={e=>setForm({...form, url:e.target.value})} style={inp}/>
            <input placeholder="tags (comma)" value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} style={inp}/>
            <button onClick={save}>Add</button>
          </div>
        </div>
      )}

      <div className="season-stats" style={{gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))"}}>
        {items.map(link=>(
          <div key={link._id} className="stat-card" style={{textAlign:"left"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <h4 style={{marginBottom:6}}>{link.name} <small>({link.env})</small></h4>
              {isAdmin && <button onClick={()=>remove(link._id)}>Delete</button>}
            </div>
            <a href={link.url} target="_blank" rel="noreferrer" style={{color:"#fff", textDecoration:"underline"}}>{link.url}</a>
            {link.tags?.length>0 && (
              <div style={{marginTop:8, opacity:.9}}>#{link.tags.join(" #")}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
const inp = { padding:"10px 12px", borderRadius:10, border:"none", background:"rgba(255,255,255,0.9)", color:"#333" };
const fancySel = { padding:"10px 12px", borderRadius:12, border:"none", background:"rgba(255,255,255,0.9)", color:"#333", boxShadow:"0 1px 8px rgba(0,0,0,0.15)" };
function labelForEnv(e){
  const map = { dev:"Development", test:"Test", stage:"Staging", prod:"Production" };
  return map[e] || e;
}
