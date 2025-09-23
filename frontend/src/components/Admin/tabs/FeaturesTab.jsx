import React, { useEffect, useState } from "react";
import { api } from "../../../services/api.js";
import { toast } from "../../../services/toast.js";

export default function FeaturesTab({ onDirtyChange }){
  const [initial, setInitial] = useState(null);
  const [flags, setFlags] = useState({ enableQATools:false, enableChatbot:false });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const f = await api.adminGetFeatures();
    setInitial(f);
    setFlags(f);
    onDirtyChange?.(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!initial) return;
    const dirty = (initial.enableQATools !== flags.enableQATools) || (initial.enableChatbot !== flags.enableChatbot);
    onDirtyChange?.(dirty);
  }, [flags, initial]);

  const save = async () => {
    setBusy(true);
    const r = await api.adminSetFeatures(flags);
    setBusy(false);
    if (r?.error){ toast(r.error, 3000); return; }
    toast("Feature flags saved", 2000);
    await load();
  };

  return (
    <div style={{display:'grid', gap:12}}>
      <label style={{display:'flex', alignItems:'center', gap:8}}>
        <input type="checkbox" checked={!!flags.enableQATools} onChange={e=>setFlags(f=>({...f, enableQATools:e.target.checked}))} />
        Enable QA Tools section
      </label>
      <label style={{display:'flex', alignItems:'center', gap:8}}>
        <input type="checkbox" checked={!!flags.enableChatbot} onChange={e=>setFlags(f=>({...f, enableChatbot:e.target.checked}))} />
        Enable Chatbot features
      </label>
      <div style={{display:'flex', gap:8}}>
        <button disabled={busy} className="btn-primary" onClick={save}>Save</button>
        <button disabled={busy} className="btn-secondary" onClick={load}>Reset</button>
      </div>
    </div>
  );
}
