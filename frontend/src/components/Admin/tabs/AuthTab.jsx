import React, { useEffect, useState } from "react";
import { api } from "../../../services/api.js";
import { toast } from "../../../services/toast.js";

export default function AuthTab(){
  const [settings, setSettings] = useState({ emailVerifyOnSignup: false });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const s = await api.adminGetAuthSettings();
    if (!s?.error) setSettings(s);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setBusy(true);
    const r = await api.adminSetAuthSettings(settings);
    setBusy(false);
    if (r?.error){ toast(r.error, 3000); return; }
    toast("Auth settings saved", 2000);
  };

  return (
    <div style={{display:'grid', gap:12}}>
      <label style={{display:'flex', alignItems:'center', gap:8}}>
        <input type="checkbox" checked={!!settings.emailVerifyOnSignup} onChange={e=>setSettings(s=>({...s, emailVerifyOnSignup:e.target.checked}))} />
        Require email verification before login
      </label>
      <div style={{display:'flex', gap:8}}>
        <button disabled={busy} className="btn-primary" onClick={save}>Save</button>
        <button disabled={busy} className="btn-secondary" onClick={load}>Reset</button>
      </div>
    </div>
  );
}
