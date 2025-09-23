import React, { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export default function Header() {
  const [season, setSeason] = useState(null);
  useEffect(() => { (async () => {
    try {
      // Best-effort; if not authed or admin route blocks, just ignore
      const s = await api.adminGetSeason().catch(()=>null);
      if (s?.currentSeason) setSeason(s.currentSeason);
    } catch {}
  })(); }, []);
  return (
    <div className="main-header">
      <h1 className="app-title">
        <span className="title-icon" aria-hidden>🎮</span>
        <span className="title-text rainbow-title">QA Break Room Ultimate</span>
        <span className="title-icon" aria-hidden>🎮</span>
      </h1>
      {season && (
        <div style={{marginTop:6, display:"flex", justifyContent:"center"}}>
          <span style={{
            background:"linear-gradient(90deg,#1e3a8a,#2563eb)",
            color:"#fff", padding:"4px 10px", borderRadius:999,
            fontSize:12, letterSpacing:0.4
          }}>
            Season {season}
          </span>
        </div>
      )}
    </div>
  );
}
