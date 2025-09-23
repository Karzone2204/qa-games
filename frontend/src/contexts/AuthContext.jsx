import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";

const Ctx = createContext(null);

function parseJwt(t) {
  try { return JSON.parse(atob(t.split(".")[1])); } catch { return null; }
}

export function AuthProvider({ children }){
  const [user, setUser] = useState(null);
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const [remember, setRemember] = useState(true);

  // restore session on load
  useEffect(() => {
    // prefer localStorage; fallback to sessionStorage if no persistent token
    const t = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!t) return;
    const p = parseJwt(t);
    if (p && p.email) setUser({ id: p.id, email: p.email, name: p.name, role: p.role });
  }, []);

  const value = useMemo(()=>({
  user,
  justLoggedOut,
  clearJustLoggedOut(){ setJustLoggedOut(false); },
    remember,
    setRemember,
    async signup(email,name,password, inviteCode){
      const d = await api.signup(email,name,password, inviteCode);
      if (d.pendingVerification){
        // do not login; caller (AuthModal) can show an info message
        return d;
      }
      if (d.token && d.user){
        if (remember) localStorage.setItem('token', d.token); else sessionStorage.setItem('token', d.token);
        try { localStorage.setItem('lastEmail', email); } catch {}
        setUser(d.user);
      }
      return d;
    },
    async login(email,password){
      const d = await api.login(email,password);
      if (d.token && d.user){
        if (remember) localStorage.setItem('token', d.token); else sessionStorage.setItem('token', d.token);
        try { localStorage.setItem('lastEmail', email); } catch {}
        setUser(d.user);
      }
      return d;
    },
    logout(){
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      setUser(null);
      setJustLoggedOut(true);
      // deliberately do NOT remove lastEmail so we can prefill next time
    }
  }),[user, remember]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = ()=> useContext(Ctx);
