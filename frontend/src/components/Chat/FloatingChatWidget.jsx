import React, { useEffect, useState } from "react";
import Chatbot from "../Games/Chatbot.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import botWave from "../../assets/bot-wave.gif"; // placeholder gif

export default function FloatingChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [unread, setUnread] = useState(0);

  // Always show intro after each login (whenever user becomes available)
  useEffect(() => {
    if (!user) return; // wait for login
    const params = new URLSearchParams(window.location.search);
    const forceParam = params.get('showBotIntro');
    const forceLocal = localStorage.getItem('forceBotIntro');
    const shouldForce = forceParam === '1' || forceLocal === '1';

    setShowIntro(true);
    const t = setTimeout(()=> setShowIntro(false), 5600);
    // optionally also show small bubble after intro fades (unless forced open)
    const t2 = setTimeout(()=> { if(!shouldForce) { setShowBubble(true); setUnread(u=>u+1); } }, 6000);
    const t3 = setTimeout(()=> setShowBubble(false), 10200);
    return () => { clearTimeout(t); clearTimeout(t2); clearTimeout(t3); };
  }, [user]);

  // expose manual trigger for debugging
  useEffect(()=>{
    window.__showBotIntro = () => { setShowIntro(true); setTimeout(()=>setShowIntro(false), 5600); };
    return () => { if(window.__showBotIntro) delete window.__showBotIntro; };
  },[]);

  // Keyboard shortcut: Alt+/ toggles chat
  useEffect(()=>{
    const onKey = (e) => {
      if ((e.altKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setOpen(o => !o);
        if (!open) setUnread(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Clear unread when opening
  useEffect(()=>{ if (open) setUnread(0); }, [open]);

  return (
    <>
      {/* Intro animated bot panel (first login only) */}
      {showIntro && (
        <div className="bot-intro-panel" onClick={() => setOpen(true)}>
          <div className="bot-intro-media">
            <img src={botWave} alt="Bot waving" style={{width:48,height:48,objectFit:'contain'}} />
          </div>
          <div className="bot-intro-text">
            <strong>Hello!!</strong><br/>
            <span>How can I help you?</span>
          </div>
          <button className="bot-intro-close" aria-label="Close" onClick={(e)=>{e.stopPropagation(); setShowIntro(false);}}>✕</button>
        </div>
      )}
      {/* Fallback small bubble (subsequent same-session openings) */}
      {showBubble && !showIntro && (
        <div className="fab-bubble" onClick={() => setOpen(true)}>💬 Ask QA Bot</div>
      )}

      {/* Floating Action Button */}
      <button
        className={`fab${unread>0 ? ' fab-unread' : ''}`}
        aria-label="Open QA Bot Chat"
        onClick={() => setOpen(true)}
        title={"Chat with QA Bot (Alt+/)"}
      >
        <span aria-hidden>🤖</span>
        {unread>0 && <span className="fab-badge" aria-label={`${unread} unread`}>{unread>9?'9+':unread}</span>}
      </button>

      {/* Modal */}
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)} aria-label="Close">✖</button>
            <Chatbot />
          </div>
        </div>
      )}
      <IntroStyles />
    </>
  );
}

function IntroStyles(){
  return (
    <style>{`
      .bot-intro-panel {position:fixed; bottom:108px; right:22px; display:flex; align-items:center; gap:12px; background:linear-gradient(135deg,#1c2933,#122027); padding:14px 18px 14px 14px; border-radius:18px; box-shadow:0 8px 28px -6px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.08) inset; animation:botIntroSlide .7s ease, botIntroPulse 5s ease-in-out infinite; cursor:pointer; z-index:1000; max-width:260px;}
      .bot-intro-media {flex-shrink:0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));}
      .bot-intro-text {font-size:13px; line-height:1.25; color:#e7f6ef;}
      .bot-intro-text strong {font-size:14px; color:#4cf3a2;}
      .bot-intro-close {position:absolute; top:4px; right:6px; border:none; background:transparent; color:#88b8cc; cursor:pointer; font-size:14px; padding:2px 4px;}
      .bot-intro-close:hover {color:#fff;}
      @keyframes botIntroSlide {0%{opacity:0; transform:translateY(18px) scale(.92);}60%{opacity:1; transform:translateY(-2px) scale(1.02);}100%{opacity:1; transform:translateY(0) scale(1);} }
      @keyframes botIntroPulse {0%,100%{box-shadow:0 8px 28px -6px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.08) inset;}50%{box-shadow:0 8px 34px -4px rgba(0,0,0,0.55),0 0 0 1px rgba(76,243,162,0.25) inset;} }
      @media (max-width:640px){ .bot-intro-panel {right:10px; left:10px; bottom:120px;} }
    `}</style>
  );
}
