import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

// Minimal landing that only shows auth options until user logs in.
export default function AuthLanding({ justLoggedOutMessage, openAuth }) {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(true);
  if (user) return null;

  return (
    <div style={wrapStyle}>
      <div style={blob('#0ea5e9', 420, 420, '-18%','-12%')} aria-hidden="true" />
      <div style={blob('#10b981', 380, 380, '70%','65%')} aria-hidden="true" />
      <div style={cardStyle} className="game-container active">
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10, margin:'4px 0 18px'}}>
          <div style={{position:'relative', width:80, height:80}}>
            <div style={{position:'absolute', inset:0, filter:'blur(18px)', background:'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.55), rgba(16,185,129,0) 70%)'}} aria-hidden="true"></div>
            <div style={{position:'relative', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width="74" height="74" viewBox="0 0 64 64" role="img" aria-label="QA Tick" style={{filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.45))'}}>
                <circle cx="32" cy="32" r="26" fill="url(#lg)" />
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <path d="M20 34l8 8 16-18" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <h1 style={{textAlign:'center', fontSize: '2.55rem', letterSpacing: '.5px', margin:0, background:'linear-gradient(90deg,#ffffff,#d1fae5)', WebkitBackgroundClip:'text', color:'transparent'}}>
            QA Break Room
          </h1>
        </div>
        {justLoggedOutMessage && (
          <div style={logoutMsgStyle}>{justLoggedOutMessage}</div>
        )}
        <div style={{textAlign:'center', margin:'0 0 18px'}}>
          <div style={{...highlightWrap, flexDirection:'row', gap:8, padding:'10px 26px'}}>
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
              <span style={iconChip}>▶</span>
              <span style={pulseWord('#fff')}>Play</span>
            </span>
            <span style={{opacity:.35}}>│</span>
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
              <span style={iconChip}>🧪</span>
              <span style={pulseWord('#fff', .18)}>Test</span>
            </span>
            <span style={{opacity:.35}}>│</span>
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
              <span style={iconChip}>📈</span>
              <span style={pulseWord('#fff', .33)}>Improve</span>
            </span>
          </div>
          <div style={{marginTop:12}}>
            <div style={tmLineAlt}>All in one space<span style={tmBadge}>™</span></div>
          </div>
        </div>
  <div style={{display:'flex', justifyContent:'center', marginBottom:20}}>
          <button className={showLogin? 'active': ''} onClick={()=>{setShowLogin(true); openAuth?.('login');}} style={tabBtn(showLogin)}>Login</button>
          <button className={!showLogin? 'active': ''} onClick={()=>{setShowLogin(false); openAuth?.('signup');}} style={tabBtn(!showLogin)}>Sign Up</button>
        </div>
  <div style={{marginTop:6, fontSize:12, textAlign:'center', opacity:.55}}>Use your innovation.group email</div>
      </div>
    </div>
  );
}

const wrapStyle = { position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'#0b1322', backgroundImage:'radial-gradient(circle at 50% 40%, rgba(32,78,112,0.55), rgba(11,19,34,0.9) 62%)', overflow:'hidden' };
const cardStyle = { width:480, background:'rgba(255,255,255,0.08)', backdropFilter:'blur(6px)', borderRadius:24, padding:'26px 34px', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' };
const logoutMsgStyle = { background:'rgba(255,255,255,0.12)', padding:'10px 14px', borderRadius:12, marginBottom:14, color:'#ffe8e8', textAlign:'center', fontSize:14 };
const tabBtn = (active)=>({ margin:'0 6px', padding:'8px 18px', borderRadius:20, border:'none', cursor:'pointer', background: active? 'linear-gradient(90deg,#2563eb,#3b82f6)': 'rgba(255,255,255,0.15)', color:'#fff', boxShadow: active? '0 2px 10px rgba(0,0,0,.4)': 'none'});
const pulseWord = (color='#fff', delay=0)=>({
  display:'inline-block',
  color,
  animation:'pulseWord 3s ease-in-out infinite',
  animationDelay: `${delay}s`
});
const highlightWrap = {
  display:'inline-flex',
  alignItems:'center',
  padding:'8px 26px',
  borderRadius:40,
  fontSize:'1.2rem',
  fontWeight:600,
  letterSpacing:'.6px',
  background:'linear-gradient(90deg, rgba(16,185,129,.18), rgba(5,150,105,.35))',
  boxShadow:'0 0 0 1px rgba(255,255,255,0.18), 0 4px 14px rgba(0,0,0,0.45)',
  position:'relative',
  overflow:'hidden'
};
const tmLine = { marginTop:10, fontSize:'.9rem', letterSpacing:'.4px', opacity:.8, display:'inline-flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.06)', padding:'4px 14px 4px 14px', borderRadius:18, boxShadow:'0 2px 6px rgba(0,0,0,0.4)'};
const tmBadge = { fontSize:'0.55rem', marginLeft:4, padding:'2px 4px', background:'linear-gradient(135deg,#10b981,#059669)', color:'#fff', borderRadius:6, letterSpacing:0, boxShadow:'0 1px 4px rgba(0,0,0,0.35)' };
const tmLineAlt = { fontSize:'.78rem', letterSpacing:'.35px', opacity:.85, display:'inline-flex', alignItems:'center', gap:4, background:'rgba(0,0,0,0.25)', padding:'4px 12px 3px 12px', borderRadius:14, boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.5)' };
const iconChip = { background:'rgba(255,255,255,0.18)', width:28, height:28, display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', fontSize:'0.9rem', boxShadow:'0 2px 6px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.25)' };
const blob = (color, w, h, left, top)=>({ position:'absolute', left, top, width:w, height:h, background:color, opacity:.18, filter:'blur(120px)', borderRadius:'50%', pointerEvents:'none' });

// Inject keyframes once (idempotent)
if (typeof document !== 'undefined' && !document.getElementById('pulseWord-anim')) {
  const style = document.createElement('style');
  style.id = 'pulseWord-anim';
  style.textContent = `@keyframes pulseWord {0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(-4px);opacity:.9}}`;
  document.head.appendChild(style);
}
