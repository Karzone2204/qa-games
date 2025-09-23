import React, { useEffect, useState } from "react";
import Chatbot from "./Chatbot";
import { useAuth } from "../../contexts/AuthContext.jsx";
import botWave from "../../assets/bot-wave.gif"; // placeholder gif

const HINT_KEY = "qaChatHintDismissedAt";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [max, setMax] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showJump, setShowJump] = useState(false); // new animated bubble state
  const [showIntro, setShowIntro] = useState(false); // new gif intro
  const [imgError, setImgError] = useState(false);

  // Close widget & clear hint timers if user logs out
  useEffect(() => {
    if (!user) {
      setOpen(false);
      setMax(false);
      setShowHint(false);
      setShowJump(false);
    }
  }, [user]);

  // Show the hint bubble once per day when widget is closed
  useEffect(() => {
    if (open) { // auto hide intro & aux bubbles when chat opens
      setShowIntro(false);
      setShowHint(false);
      setShowJump(false);
      return; // skip rest
    }
    if (showIntro) { setShowHint(false); setShowJump(false); return; }
    const ts = Number(localStorage.getItem(HINT_KEY) || 0);
    const expired = Date.now() - ts > ONE_DAY_MS;
    if (!open && expired) {
      const t = setTimeout(() => setShowHint(true), 800);
      const autoHide = setTimeout(() => setShowHint(false), 6000);
      const jumpDelay = setTimeout(() => setShowJump(true), 1400);
      const jumpHide = setTimeout(() => setShowJump(false), 8000);
      return () => { clearTimeout(t); clearTimeout(autoHide); clearTimeout(jumpDelay); clearTimeout(jumpHide); };
    } else { setShowHint(false); setShowJump(false); }
  }, [open, showIntro]);

  // Intro gif each login
  useEffect(()=>{
    if(!user) return;
    setShowIntro(true);
    const t = setTimeout(()=> setShowIntro(false), 5600);
    return ()=> clearTimeout(t);
  },[user]);

  // Manual debug helper
  useEffect(()=>{ window.__showBotIntro = ()=>{ setShowIntro(true); setTimeout(()=>setShowIntro(false),5600); }; return ()=>{ delete window.__showBotIntro; }; },[]);

  

  const dismissHint = () => {
    setShowHint(false);
    setShowJump(false);
    localStorage.setItem(HINT_KEY, String(Date.now()));
  };

  const z = 9999;

  const fabStyle = {
    position: "fixed", right: 20, bottom: 20, zIndex: z,
    background: "linear-gradient(135deg, #00c6ff 0%, #007a7a 100%)",
    color: "#fff", border: "none", borderRadius: 9999,
    padding: "10px 14px", boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    display: open ? "none" : "flex", alignItems: "center", gap: 8, cursor: "pointer",
    transition: "transform 0.25s ease",
  };

  const hintWrap = {
    position: "fixed", right: 20, bottom: 78, zIndex: z,
    display: open || !showHint ? "none" : "block"
  };

  const hintBubble = {
    background: "rgba(0,0,0,0.75)",
    color: "white",
    padding: "8px 12px",
    borderRadius: 12,
    fontSize: 13,
    boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
    maxWidth: 220,
    lineHeight: 1.35,
  };

  const hintTail = {
    width: 0, height: 0, borderLeft: "8px solid transparent",
    borderRight: "8px solid transparent", borderTop: "8px solid rgba(0,0,0,0.75)",
    margin: "4px auto 0", transform: "translateX(78px)" // aim tail at FAB
  };

  // New jumping bubble positioned slightly above and left of FAB
  const jumpBubbleWrap = {
    position: "fixed",
    right: 95, // offset horizontally
    bottom: 95, // offset vertically
    zIndex: z,
    pointerEvents: open ? "none" : "auto",
    display: open || !showJump ? "none" : "flex",
    alignItems: "center",
    gap: 6,
    animation: "qaJump 1.4s ease-in-out infinite",
    filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.35))",
    cursor: "pointer",
  };

  const jumpBubble = {
    background: "linear-gradient(135deg,#667eea,#764ba2)",
    color: "white",
    padding: "10px 14px",
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  // Inject keyframes dynamically (lightweight approach since no global CSS here)
  useEffect(() => {
    const id = "qa-chat-jump-anim";
    if (!document.getElementById(id)) {
      const styleEl = document.createElement("style");
      styleEl.id = id;
      styleEl.textContent = `@keyframes qaJump {0%,100% { transform: translateY(0);} 50% { transform: translateY(-10px);} }`;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Panel base (glass) — full viewport when max, compact card otherwise
  const panelBase = {
    position: "fixed", zIndex: z, background: "rgba(255,255,255,0.10)",
    backdropFilter: "blur(10px)", color: "white",
    display: open ? "flex" : "none", flexDirection: "column",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    overflow: "hidden"
  };

  const panelStyle = max
    ? { ...panelBase, top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }
    : { ...panelBase, right: 20, bottom: 20, width: 460, height: 600, borderRadius: 16 };

  const headerStyle = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 12px", background: "rgba(0,0,0,0.28)",
    borderBottom: "1px solid rgba(255,255,255,0.15)"
  };

  const titleStyle = { display: "flex", alignItems: "center", gap: 8, fontWeight: 600 };
  const dotStyle = { width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 8px #4CAF50" };

  const iconBtn = {
    background: "transparent", border: "none", color: "white", cursor: "pointer",
    padding: 6, borderRadius: 8, fontSize: 18, lineHeight: 1
  };

  // Body is a flex column; Chatbot will fill it when max=true
  const bodyStyle = {
    flex: 1, display: "flex", flexDirection: "column",
    minHeight: 0, // critical so children with flex:1 can shrink properly
    padding: max ? 12 : 12, // keep a bit of breathing room
    overflow: "hidden"
  };

  // Guard: no render if not authenticated
  if (!user) return null;

  return (
    <>
      {/* Intro animated bot panel */}
      {showIntro && (
        <div style={{position:"fixed", bottom: max? 84: 100, right:100, zIndex:z+1, cursor:"pointer"}} onClick={()=>{ setOpen(true); setShowIntro(false); }}>
          <div style={{position:'relative', display:'flex', alignItems:'center', gap:12, background:"linear-gradient(135deg,#1f313d,#15252d)", padding:"12px 16px 12px 12px", borderRadius:14, boxShadow:"0 12px 30px -6px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.07) inset", animation:"botIntroPop .55s cubic-bezier(.22,1.4,.36,1) forwards, botIntroPulse 5s ease-in-out infinite .55s", maxWidth:250, transformOrigin:'bottom right'}}>
            <div style={{flexShrink:0, filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.4))"}}>
              {imgError ? (
                <div style={{width:42,height:42,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>🤖</div>
              ) : (
                <img src={botWave} alt="Bot waving" style={{width:42,height:42,objectFit:'contain',display:'block'}} onError={()=>setImgError(true)} />
              )}
            </div>
            <div style={{fontSize:12.5,lineHeight:1.25,color:'#e7f6ef'}}>
              <strong style={{fontSize:13.5,color:'#4cf3a2'}}>Hello!!</strong><br/>
              <span>How can I help you?</span>
            </div>
            {/* Tail pointing toward FAB */}
            <div style={{position:'absolute', right:-10, bottom:6, width:22, height:22, overflow:'visible', pointerEvents:'none'}}>
              <div style={{position:'absolute', width:16, height:16, background:"linear-gradient(135deg,#1f313d,#15252d)", transform:'rotate(45deg)', right:3, bottom:3, boxShadow:'0 0 0 1px rgba(255,255,255,0.07) inset'}} />
            </div>
          </div>
        </div>
      )}

      {/* The small popup now matches the intro styling (logo + theme) */}
      {!showIntro && (
        <div
          style={{
            ...jumpBubbleWrap,
            right: 20,
            bottom: 92,
            animation: "botIntroPulse 5s ease-in-out infinite",
          }}
          onClick={() => {
            dismissHint();
            setShowIntro(false);
            setShowHint(false);
            setShowJump(false);
            setOpen(true);
          }}
          title="How can I help you?"
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: "linear-gradient(135deg,#1f313d,#15252d)",
              padding: "10px 14px 10px 10px",
              borderRadius: 14,
              boxShadow: "0 12px 30px -6px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.07) inset",
              maxWidth: 240,
            }}
          >
            <div style={{ flexShrink: 0, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>
              {imgError ? (
                <div style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🤖</div>
              ) : (
                <img
                  src={botWave}
                  alt="Bot waving"
                  style={{ width: 38, height: 38, objectFit: 'contain', display: 'block' }}
                  onError={() => setImgError(true)}
                />
              )}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.25, color: '#e7f6ef' }}>
              <strong style={{ fontSize: 13.5, color: '#4cf3a2' }}>Hello!!</strong><br />
              <span>How can I help you?</span>
            </div>
            {/* Tail */}
            <div style={{ position: 'absolute', right: -8, bottom: 6, width: 20, height: 20, overflow: 'visible', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', width: 14, height: 14, background: "linear-gradient(135deg,#1f313d,#15252d)", transform: 'rotate(45deg)', right: 2, bottom: 2, boxShadow: '0 0 0 1px rgba(255,255,255,0.07) inset' }} />
            </div>
          </div>
        </div>
      )}

      {/* FAB launcher */}
      <button
        style={fabStyle}
        onClick={() => { dismissHint(); setShowIntro(false); setShowHint(false); setShowJump(false); setOpen(true); }}
        title="Open QA Chat"
      >
        <span role="img" aria-label="robot">🤖</span>
        <span style={{ fontWeight: 600 }}>Chat</span>
      </button>

      {/* Chat panel */}
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>
            <span role="img" aria-label="robot" style={{ fontSize: 18 }}>🤖</span>
            <span>QA Bot</span>
            <span style={{ ...dotStyle, marginLeft: 6 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Maximize / Restore */}
            <button
              style={iconBtn}
              onClick={() => setMax(x => !x)}
              title={max ? "Restore" : "Maximize"}
              aria-label={max ? "Restore chat" : "Maximize chat"}
            >
              {max ? "🗗" : "⛶"}
            </button>
            {/* Minimize */}
            <button
              style={iconBtn}
              onClick={() => setOpen(false)}
              title="Minimize"
              aria-label="Minimize chat"
            >
              ─
            </button>
          </div>
        </div>

        <div style={bodyStyle}>
          {/* In max mode, Chatbot fills the entire body (true full-height). */}
          <Chatbot fill={max} boxHeight={max ? undefined : 380} />
        </div>
      </div>
  {/* Intro animations keyframes */}
  <style>{`@keyframes botIntroPop {0%{opacity:0; transform:translateY(12px) scale(.6) rotate(-4deg);}50%{opacity:1; transform:translateY(-4px) scale(1.05) rotate(1deg);}70%{transform:translateY(2px) scale(.97) rotate(-1deg);}100%{opacity:1; transform:translateY(0) scale(1) rotate(0);} } @keyframes botIntroPulse {0%,100%{box-shadow:0 8px 28px -6px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.08) inset;}50%{box-shadow:0 8px 34px -4px rgba(0,0,0,0.55),0 0 0 1px rgba(76,243,162,0.25) inset;} }`}</style>
    </>
  );
}
