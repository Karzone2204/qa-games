import React, { useState } from "react";
import { toast } from "../../services/toast.js";

export default function ResetPasswordModal({ open, email, token, onClose, onSuccess }){
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;

  async function submit(){
    if (pw1.length < 6){ toast("Password must be at least 6 characters"); return; }
    if (pw1 !== pw2){ toast("Passwords do not match"); return; }
    try{
      setSubmitting(true);
      const RAW = import.meta.env.VITE_API_BASE || "";
      const BASE = (RAW||"").replace(/\/+$/,'');
      const r = await fetch(`${BASE}/auth/reset`, {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, token, newPassword: pw1 })
      });
      const data = await r.json().catch(()=>({}));
      if (r.ok && data.ok){ onSuccess?.(); }
      else { toast(data.error || 'Reset failed'); }
    } catch { toast('Reset failed'); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div className="game-container active" style={{ width: 420, background: "rgba(255,255,255,0.12)" }} onClick={e=>e.stopPropagation()}>
        <h2 style={{ textAlign: 'center' }}>🔁 Set New Password</h2>
        <div style={{ padding: 16 }}>
          <div style={{ color:'#ddd', fontSize:12, marginBottom:8 }}>for {email}</div>
          <input type="password" placeholder="New password" style={input}
            value={pw1} onChange={e=>setPw1(e.target.value)} />
          <input type="password" placeholder="Confirm new password" style={input}
            value={pw2} onChange={e=>setPw2(e.target.value)} />
          <div style={{ textAlign:'center', marginTop:8 }}>
            <button disabled={submitting} onClick={submit}>{submitting? 'Saving...' : 'Save password'}</button>
            <button style={{ marginLeft:8 }} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const backdrop = { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 };
const input = { padding: '12px 16px', borderRadius:24, border:'none', background:'rgba(255,255,255,0.9)', color:'#333', width:'100%', margin:'8px 0' };
