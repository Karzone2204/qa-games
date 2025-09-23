import React, { useEffect, useState } from "react";
import { api } from "../../../services/api.js";
import { toast } from "../../../services/toast.js";

export default function SeasonTab(){
  const [cfg, setCfg] = useState(null);
  const [override, setOverride] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSeasonInput, setResetSeasonInput] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [allResetArmed, setAllResetArmed] = useState(false);
  const [allResetCode, setAllResetCode] = useState("");
  const [allResetInput, setAllResetInput] = useState("");

  const load = async () => {
    const c = await api.adminGetSeason();
    setCfg(c);
    setOverride(c.override || "");
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (allResetArmed) setAllResetCode(String(Math.floor(Math.random()*9000)+1000)); }, [allResetArmed]);
  if (!cfg) return null;

  const doSetAuto = async (on) => { setBusy(true); await api.adminSetAuto(on); await load(); setBusy(false); };
  const doNewSeason = async () => { setBusy(true); await api.adminNewSeason(override || undefined); await load(); setBusy(false); };
  const doNextMonth = async () => { setBusy(true); await api.adminNewSeason(undefined); await load(); setBusy(false); };
  const doReset = async () => {
    if ((resetConfirmText || "").toUpperCase() !== "RESET"){
      toast("Type RESET to enable the season reset", 2500);
      return;
    }
    setBusy(true);
    const season = resetSeasonInput || undefined;
    await api.adminResetSeason(season);
    setBusy(false);
    setResetSeasonInput(""); setResetConfirmText("");
    toast("Season scores cleared", 2500);
  };
  const doResetAll = async () => {
    if (!allResetArmed){ toast("Arm the ALL reset first", 2500); return; }
    if (allResetInput !== allResetCode){ toast("Code mismatch", 2500); return; }
    setBusy(true);
    await api.adminResetSeason("__ALL__");
    setBusy(false);
    setAllResetArmed(false); setAllResetInput("");
    toast("All-time scores purged", 3000);
  };

  return (
    <div style={{display:"grid", gap:12}}>
      <div><b>Effective Season:</b> {cfg.currentSeason}</div>
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <label style={{display:"flex", alignItems:"center", gap:8}}>
          <input type="checkbox" checked={!!cfg.autoSeason} onChange={e=>doSetAuto(e.target.checked)} disabled={busy} />
          Auto Season (calendar month)
        </label>
      </div>
      <div style={{display:"flex", gap:8, alignItems:"center"}}>
        <span>Override:</span>
        <input value={override} onChange={e=>setOverride(e.target.value)} placeholder="YYYY-MM or empty to clear" style={{padding:"6px 10px", borderRadius:8}} />
        <button onClick={doNewSeason} disabled={busy} className="btn-primary">Apply Override</button>
        <button onClick={doNextMonth} disabled={busy} className="btn-secondary">Next Month</button>
      </div>
      <div style={{display:"grid", gap:10, marginTop:6}}>
        <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
          <input value={resetSeasonInput} onChange={e=>setResetSeasonInput(e.target.value)} placeholder={`Season to reset (blank = ${cfg.currentSeason})`} style={{padding:"6px 10px", borderRadius:8}} />
          <input value={resetConfirmText} onChange={e=>setResetConfirmText(e.target.value)} placeholder="Type RESET" style={{padding:"6px 10px", borderRadius:8}} />
          <button onClick={doReset} disabled={busy || (resetConfirmText||"").toUpperCase()!=="RESET"} style={{background:"#b3261e", color:"#fff", padding:"10px 14px", borderRadius:10}}>Reset Season Scores</button>
        </div>
        <div style={{padding:10, borderRadius:12, background:"rgba(255,0,0,0.08)"}}>
          <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            <label style={{display:"flex", alignItems:"center", gap:6}}>
              <input type="checkbox" checked={allResetArmed} onChange={e=>setAllResetArmed(e.target.checked)} /> Arm ALL reset
            </label>
            {allResetArmed && (
              <>
                <span>Code:</span>
                <code style={{padding:"2px 6px", borderRadius:6, background:"rgba(255,255,255,0.1)"}}>{allResetCode}</code>
                <input value={allResetInput} onChange={e=>setAllResetInput(e.target.value)} placeholder="Enter code" style={{padding:"6px 10px", borderRadius:8}} />
                <button onClick={doResetAll} disabled={busy} style={{background:"#7f1d1d", color:"#fff", padding:"10px 14px", borderRadius:10}}>Reset ALL Scores</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
