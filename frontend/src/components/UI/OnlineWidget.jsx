import React, { useEffect, useMemo, useRef, useState } from "react";

const RAW = import.meta.env.VITE_API_BASE || "";
const BASE = RAW.replace(/\/+$/, "");

export default function OnlineWidget({ currentGame }){
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const socketRef = useRef(null);
  const [incoming, setIncoming] = useState(null); // { from:{id,name}, game, code }
  const [expandedId, setExpandedId] = useState(null);
  const [notice, setNotice] = useState(null); // { text }

  const selfId = useMemo(() => {
    try{
      const t = localStorage.getItem('token'); if (!t) return null;
      const p = t.split('.')[1]; if (!p) return null;
      const obj = JSON.parse(atob(p)); return obj.id || null;
    } catch { return null; }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { io } = await import("https://cdn.socket.io/4.7.5/socket.io.esm.min.js");
      // Token from localStorage set by login
      const token = localStorage.getItem("token");
      if (!token) return;
      const url = BASE || `${location.protocol}//${location.hostname}:4000`;
      const s = io(url, { transports:["websocket"], auth: { token } });
      socketRef.current = s;
      s.on("connect", () => {
        // announce current game
        s.emit("presence:game", currentGame || null);
      });
  s.on("presence:update", (list) => { if (mounted) setPeople(list || []); });
  s.on('invite:receive', (payload) => { setIncoming(payload); });
  s.on('invite:sent', () => {});
      s.on('invite:accepted', (payload) => {
        // If I'm the inviter, route me to the game automatically
        setNotice({ text: 'Invite accepted. Launching game…' });
        setTimeout(()=> setNotice(null), 1800);
        try { window.dispatchEvent(new CustomEvent('qa:invite:peer-accepted', { detail: payload })); } catch {}
      });
      s.on('invite:declined', () => {
        setNotice({ text: 'Invite declined.' });
        setTimeout(()=> setNotice(null), 1600);
      });
      s.on("disconnect", () => { if (mounted) setPeople([]); });
    })();
    return () => {
      mounted = false;
      if (socketRef.current){ socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, []);

  useEffect(() => {
    const s = socketRef.current;
    if (s && s.connected){ s.emit("presence:game", currentGame || null); }
  }, [currentGame]);

  return (
    <div style={{position:"fixed", left:12, bottom:12, zIndex:10}}>
      <style>{`
        @keyframes ow_pulse { 0%,100%{ opacity:.35 } 50%{ opacity:1 } }
        @keyframes ow_blink1 { 0%{opacity:.2} 33%{opacity:1} 100%{opacity:.2} }
        @keyframes ow_blink2 { 0%{opacity:.2} 33%{opacity:.2} 66%{opacity:1} 100%{opacity:.2} }
        @keyframes ow_blink3 { 0%{opacity:.2} 66%{opacity:.2} 100%{opacity:1} }
      `}</style>
      <button onClick={()=>setOpen(o=>!o)} title={`Online (${people.length})`} style={smallBtn} aria-label="Online">
        <div style={{position:'relative', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <UsersIcon />
          {!!people.length && (
            <span style={badge}>{people.length}</span>
          )}
        </div>
        <Caret open={open} />
      </button>
      {open && (
        <div style={panel}>
          {people.length === 0 && <div style={{opacity:.7}}>No one online</div>}
          {people.map(p => (
            <div key={p.id} style={row}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#4caf50', animation:'ow_pulse 1.6s infinite'}} />
                <span style={{fontWeight:600}}>{p.name}</span>
              </div>
              <div style={{opacity:.85, fontSize:12, display:'flex', alignItems:'center', gap:4}}>
                {p.game ? (
                  <>
                    <span>{prettyGame(p.game)}</span>
                    <span className="ow_dots" style={{display:'inline-flex', gap:2, marginLeft:2}}>
                      <span style={{animation:'ow_blink1 1.2s infinite'}}>•</span>
                      <span style={{animation:'ow_blink2 1.2s infinite'}}>•</span>
                      <span style={{animation:'ow_blink3 1.2s infinite'}}>•</span>
                    </span>
                  </>
                ) : (p.area ? <span style={{opacity:.9}}>{p.area}</span> : null)}
              </div>
              {selfId && p.id !== selfId && (
                <button
                  onClick={()=> setExpandedId(e => e===p.id ? null : p.id)}
                  style={chevBtn}
                  aria-label="Invite options"
                  title="Invite options"
                >{expandedId===p.id ? '▾' : '▸'}</button>
              )}
            </div>
          ))}
          {expandedId && people.some(u=>u.id===expandedId) && (
            <div style={expandRow}>
              <span style={{opacity:.9, marginRight:8}}>Invite to:</span>
              <button title="Invite to RPS" onClick={()=>{ sendInvite(socketRef, expandedId,'rps'); setExpandedId(null); }} style={miniBtn}>RPS</button>
              <button title="Invite to TicTacToe" onClick={()=>{ sendInvite(socketRef, expandedId,'tictactoe'); setExpandedId(null); }} style={miniBtn}>TTT</button>
              <button title="Invite to TypeRacer" onClick={()=>{ sendInvite(socketRef, expandedId,'typeracer'); setExpandedId(null); }} style={miniBtn}>Type</button>
            </div>
          )}
        </div>
      )}
      {incoming && (
        <div style={inviteToast}>
          <div style={{fontWeight:600, marginBottom:4}}>{incoming.from?.name} invited you to play {prettyGameFromKey(incoming.game)}</div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button onClick={()=>acceptInvite(socketRef, incoming, setIncoming)} style={miniBtn}>Accept</button>
            <button onClick={()=>declineInvite(socketRef, incoming, setIncoming)} style={miniBtn}>Decline</button>
          </div>
        </div>
      )}
      {notice && (
        <div style={{...inviteToast, bottom: (incoming? 112 : 66)}}>
          {notice.text}
        </div>
      )}
    </div>
  );
}

function prettyGame(k){
  const map = {
    bugSmasher:"Bug Smasher", memory:"Memory", sudoku:"Sudoku", miniSudoku:"Mini Sudoku",
    tictactoe:"Tic-Tac-Toe", typeRacer:"Type Racer", mathSprint:"Math Sprint",
    wordScram:"Word Scramble", trainBrain:"Train the Brain"
  };
  return map[k] || k;
}

function UsersIcon(){
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 20a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function Caret({ open }){
  const style = { marginLeft:6, transition:'transform .18s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' };
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={style} aria-hidden="true">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const smallBtn = { display:'inline-flex', alignItems:'center', border:'none', padding:'6px 8px', borderRadius:999, background:'rgba(255,255,255,0.92)', color:'#333', boxShadow:'0 2px 10px rgba(0,0,0,0.2)', cursor:'pointer' };
const badge = { position:'absolute', right:-2, top:-2, background:'#f44336', color:'#fff', borderRadius:999, padding:'0 5px', fontSize:10, lineHeight:'14px', minWidth:14, textAlign:'center' };
const panel = { marginTop:8, width:280, maxHeight:260, overflowY:"auto", padding:10, borderRadius:12, background:"rgba(0,0,0,0.6)", color:"#fff", boxShadow:"0 6px 24px rgba(0,0,0,0.4)" };
const row = { display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, padding:"6px 8px", borderRadius:8, background:"rgba(255,255,255,0.06)", marginBottom:6 };
const miniBtn = { ...smallBtn, padding:'4px 6px', fontSize:12 };
const inviteToast = { position:'fixed', left:12, bottom:66, background:'rgba(0,0,0,0.8)', color:'#fff', padding:'10px 12px', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,0.35)', zIndex:11, maxWidth:280 };
const chevBtn = { ...smallBtn, padding:'2px 6px', fontSize:12 };
const expandRow = { display:'flex', alignItems:'center', justifyContent:'flex-start', gap:6, padding:'6px 8px', borderRadius:8, background:'rgba(255,255,255,0.08)', marginBottom:6 };

function prettyGameFromKey(k){
  const map = { rps:'Rock • Paper • Scissors', tictactoe:'Tic-Tac-Toe', typeracer:'Type Racer' };
  return map[k] || k;
}

function sendInvite(socketRef, toUserId, game){
  const s = socketRef.current; if (!s || !s.connected) return;
  s.emit('invite:send', { toUserId, game });
}

function acceptInvite(socketRef, incoming, setIncoming){
  const s = socketRef.current; if (!s || !s.connected || !incoming) return;
  s.emit('invite:accept', { fromUserId: incoming.from?.id, game: incoming.game, code: incoming.code });
  window.dispatchEvent(new CustomEvent('qa:invite:accept', { detail: incoming }));
  setIncoming(null);
}

function declineInvite(socketRef, incoming, setIncoming){
  const s = socketRef.current; if (s && s.connected && incoming){ s.emit('invite:decline', { fromUserId: incoming.from?.id, game: incoming.game, code: incoming.code }); }
  setIncoming(null);
}
