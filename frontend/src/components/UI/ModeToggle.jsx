import React from "react";

export default function ModeToggle({ value, onChange, labels = { bot: 'Bot', online: 'Online' } }){
  const isOnline = value === 'online';
  return (
    <div style={{display:'inline-flex', background:'rgba(255,255,255,0.18)', borderRadius:999, padding:4}} role="group" aria-label="Mode toggle">
      <button
        onClick={() => onChange('bot')}
        aria-pressed={value==='bot'}
        style={{
          padding:'8px 14px', borderRadius:999, border:'none', margin:0,
          background: value==='bot' ? 'linear-gradient(135deg,#00f5a0,#00d9ff)' : 'transparent',
          color: 'white', cursor:'pointer'
        }}
      >{labels.bot}</button>
      <button
        onClick={() => onChange('online')}
        aria-pressed={value==='online'}
        style={{
          padding:'8px 14px', borderRadius:999, border:'none', margin:0,
          background: value==='online' ? 'linear-gradient(135deg,#5468ff,#00d9ff)' : 'transparent',
          color: 'white', cursor:'pointer'
        }}
      >{labels.online}</button>
    </div>
  );
}
