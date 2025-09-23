import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { apiBase } from "../../services/apiBase.js";

const ALLOWED =
  (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || "innovation.group").toLowerCase();

export default function AuthModal({ open, onClose, defaultTab = "login" }) {
  const { login, signup, remember, setRemember } = useAuth();

  const [tab, setTab] = useState(defaultTab);
  const [mode, setMode] = useState('auth'); // 'auth' | 'reset'
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  // prefill email from lastEmail when modal opens
  useEffect(()=>{
    if (open) {
      try {
        const last = localStorage.getItem('lastEmail');
        if (last) setEmail(prev=> prev? prev : last);
      } catch {}
    }
  },[open]);

  if (!open) return null;

  function validateDomainEmail(emailInput) {
    const emailNorm = emailInput.trim().toLowerCase();
    const at = emailNorm.lastIndexOf("@");
    const domain = at > -1 ? emailNorm.slice(at + 1) : "";
    return domain === ALLOWED || domain.endsWith(`.${ALLOWED}`);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    try {
      if (mode === 'reset') {
        const resp = await fetch(`${apiBase()}/auth/forgot`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: email.trim() }) });
        if (!resp.ok) {
          const j = await resp.json().catch(()=>({}));
          throw new Error(j.error || `Request failed (${resp.status})`);
        }
        setInfo(`If an account exists for ${email.trim()}, a reset link has been sent.`);
        return;
      }
      if (tab === "signup") {
        if (!validateDomainEmail(email)) {
          throw new Error(`Use your ${ALLOWED} email`);
        }
        const r = await signup(email.trim(), name.trim(), password, inviteCode || undefined);
        if (r?.error) throw new Error(r.error);
        if (r?.pendingVerification){
          setInfo(`We sent a verification link to ${email.trim()}. Please verify your email to finish signup.`);
          return;
        }
      } else {
        const r = await login(email.trim(), password);
        if (r?.error) throw new Error(r.error);
      }
      onClose?.();
    } catch (e) {
      setErr(e.message || "Authentication failed");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        className="game-container active"
        style={{ width: 460, background: "rgba(255,255,255,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ textAlign: "center" }}>
          {mode === 'reset' ? '🔁 Reset Password' : (tab === "login" ? "🔐 Login" : "📝 Sign Up")}
        </h2>

        {mode === 'auth' && (
          <div className="nav-tabs" style={{ marginTop: 10 }}>
            <div
              className={`nav-tab ${tab === "login" ? "active" : ""}`}
              onClick={() => setTab("login")}
            >
              Login
            </div>
            <div
              className={`nav-tab ${tab === "signup" ? "active" : ""}`}
              onClick={() => setTab("signup")}
            >
              Sign Up
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} style={{ padding: 16 }}>
          {mode==='auth' && tab === "signup" && (
            <input
              className="auth-input"
              style={inputStyle}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <input
            className="auth-input"
            style={inputStyle}
            placeholder={mode==='reset'? `Email` : `Email (${ALLOWED})`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {mode==='auth' && (
            <input
            className="auth-input"
            style={inputStyle}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            />
          )}

          {mode==='auth' && tab === "signup" && (
            <input
              className="auth-input"
              style={inputStyle}
              placeholder="Admin invite code (optional)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          )}

          {err && (
            <div style={{ color: "#ffd1d1", margin: "8px 0", whiteSpace: "pre-wrap" }}>{err}</div>
          )}
          {info && (
            <div style={{ color: "#c4ffd4", margin: "8px 0", whiteSpace: "pre-wrap" }}>{info}</div>
          )}

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button type="submit">
              {mode==='reset' ? 'Send reset link' : (tab === "login" ? "Login" : "Create account")}
            </button>
            <button type="button" style={{ marginLeft: 8 }} onClick={onClose}>Cancel</button>
          </div>
          {mode==='auth' && tab==='login' && (
            <div style={{marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12}}>
              <label style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
                <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> Remember me
              </label>
              <button type="button" style={linkBtn} onClick={()=>{setMode('reset'); setErr(''); setInfo('');}}>Forgot password?</button>
            </div>
          )}
          {mode==='reset' && (
            <div style={{marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12}}>
              <button type="button" style={linkBtn} onClick={()=>{setMode('auth'); setInfo('');}}>Back to login</button>
            </div>
          )}

          {mode==='auth' && (
            <div style={{ marginTop: 10, textAlign: "center", opacity: 0.8 }}>
              Use your <b>{ALLOWED}</b> email
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "12px 16px",
  borderRadius: 24,
  border: "none",
  background: "rgba(255,255,255,0.9)",
  color: "#333",
  width: "100%",
  margin: "8px 0",
};
const linkBtn = { background:'none', border:'none', color:'#7db7ff', cursor:'pointer', textDecoration:'underline', padding:0 };
