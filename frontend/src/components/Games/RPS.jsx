import React, { useEffect, useRef, useState } from "react";
import ConfettiOverlay from "../UI/ConfettiOverlay.jsx";
import { api } from "../../services/api.js";
import ModeToggle from "../UI/ModeToggle.jsx";

const RAW = import.meta.env.VITE_API_BASE || "";
const BASE = RAW.replace(/\/+$/, "");

const choices = [
  { key:'rock', label:'✊ Rock' },
  { key:'paper', label:'✋ Paper' },
  { key:'scissors', label:'✌️ Scissors' },
];

function decide(a,b){
  if (a===b) return 0;
  if ((a==='rock'&&b==='scissors')||(a==='paper'&&b==='rock')||(a==='scissors'&&b==='paper')) return 1;
  return 2;
}

export default function RPS(){
  const [mode, setMode] = useState('bot'); // 'bot' | 'online'
  const [botScore, setBotScore] = useState(0);
  const [meScore, setMeScore] = useState(0);
  const [meChoice, setMeChoice] = useState(null);
  const [botChoice, setBotChoice] = useState(null);
  const [round, setRound] = useState(1);
  const [reveal, setReveal] = useState(null);
  const MAX_ROUNDS = 10;
  const [botFinished, setBotFinished] = useState(false);
  const [winKey, setWinKey] = useState(0);

  // Online
  const socketRef = useRef(null);
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [state, setState] = useState(null);
  const [err, setErr] = useState("");
  const [pickedThisRound, setPickedThisRound] = useState(false);
  const [fireworks, setFireworks] = useState(false);
  const [peerLeft, setPeerLeft] = useState(null);

  useEffect(() => {
    if (mode !== 'online') return;
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      const { io } = await import("https://cdn.socket.io/4.7.5/socket.io.esm.min.js");
      const url = BASE || `${location.protocol}//${location.hostname}:4000`;
      const s = io(url, { transports:["websocket"], auth:{ token } });
      socketRef.current = s;
      s.on('rps:state', (st) => {
        setState(st); setRoomCode(st.code||""); setPickedThisRound(false);
        if (st?.status === 'finished' && st?.reveal && !st.reveal.draw){
          setFireworks(true);
          setTimeout(()=>setFireworks(false), 1800);
        }
      });
      s.on('rps:error', (e) => setErr(e?.error||'error'));
      s.on('rps:peer_left', (info) => { setPeerLeft(`${info?.name||'Opponent'} left the game`); setTimeout(()=>setPeerLeft(null), 2500); });
    })();
    return () => { if (socketRef.current){ socketRef.current.disconnect(); socketRef.current = null; } };
  }, [mode]);

  // Reset bot series state when switching to bot mode
  useEffect(() => {
    if (mode === 'bot'){
      setBotFinished(false);
      setRound(1);
      setMeScore(0);
      setBotScore(0);
      setReveal(null);
      setMeChoice(null);
      setBotChoice(null);
    }
  }, [mode]);

  // Auto-join when invited
  useEffect(() => {
    function onJoin(e){
      const { game, code } = e.detail || {};
      if (game !== 'rps' || !code) return;
      setMode('online');
      setInputCode(code);
      setTimeout(()=> joinRoom(), 10);
    }
    window.addEventListener('qa:invite:join', onJoin);
    return () => window.removeEventListener('qa:invite:join', onJoin);
  }, []);

  function pickBot(){
    const idx = Math.floor(Math.random()*choices.length);
    return choices[idx].key;
  }

  async function endBotSeries(){
    try {
      const score = Math.max(0, meScore * 20 - botScore * 5);
      await api.submitScore('rps', score);
    } catch {}
    if (meScore > botScore) setWinKey(k=>k+1);
    setBotFinished(true);
  }

  function playBot(choice){
    const b = pickBot();
    const r = decide(choice, b);
    setMeChoice(choice); setBotChoice(b);
    setReveal({ draw: r===0, winner: r===1 ? 'me' : (r===2 ? 'bot' : null), round });
    if (r===1) setMeScore(s=>s+1);
    if (r===2) setBotScore(s=>s+1);
    setTimeout(()=>{
      setMeChoice(null); setBotChoice(null); setReveal(null);
      setRound(x=>{
        const next = x + 1;
        if (next > MAX_ROUNDS) {
          endBotSeries();
          return x; // hold
        }
        return next;
      });
    }, 900);
  }

  function createRoom(){ setErr(""); socketRef.current?.emit('rps:create', { bestOf: 5 }); }
  function joinRoom(){ setErr(""); socketRef.current?.emit('rps:join', { code: inputCode }); }
  function leaveRoom(){ setErr(""); socketRef.current?.emit('rps:leave'); setState(null); setRoomCode(""); }
  function chooseOnline(c){ setPickedThisRound(true); socketRef.current?.emit('rps:choose', { choice: c }); }
  function rematch(){ socketRef.current?.emit('rps:rematch'); }

  function myId(){
    const t = localStorage.getItem('token'); if (!t) return null;
    const p = t.split('.')[1]; if (!p) return null;
    try{ const obj = JSON.parse(atob(p)); return obj.id || null; } catch { return null; }
  }
  const selfPicked = (() => {
    if (!state) return pickedThisRound;
    const id = myId(); if (!id) return pickedThisRound;
    const me = state.players?.find(p=>p.id===id);
    return pickedThisRound || !!me?.picked;
  })();

  return (
    <div className="game-container active">
  {botFinished && meScore > botScore && <ConfettiOverlay runKey={winKey} durationMs={1600} />}
  <h2 style={{textAlign:'center'}}>✊ Rock • Paper • Scissors {mode==='online' && <small style={{fontSize:'.6em', marginLeft:8, padding:'4px 8px', borderRadius:999, background:'rgba(0,217,255,0.25)'}}>Online</small>}</h2>

      <div style={{display:'flex', gap:12, justifyContent:'center', marginBottom:10}}>
        <ModeToggle value={mode} onChange={setMode} labels={{ bot:'Bot', online:'Online' }} />
      </div>

      {mode==='bot' && (
        <div className="stat-card" style={{textAlign:'center'}}>
          <div style={{display:'flex', justifyContent:'space-evenly', marginBottom:10}}>
            <div><strong>You</strong> {meScore}</div>
            <div>Round {round}</div>
            <div><strong>Bot</strong> {botScore}</div>
          </div>

          <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:6}}>
            {choices.map(c => (
              <button key={c.key} onClick={()=>playBot(c.key)} disabled={!!reveal || botFinished}>{c.label}</button>
            ))}
          </div>

          {reveal && (
            <div style={{marginTop:8}}>
              {reveal.draw ? (
                <div>Draw! You: {meChoice} • Bot: {botChoice}</div>
              ) : (
                <div>{reveal.winner==='me' ? 'You win!' : 'Bot wins!'} You: {meChoice} • Bot: {botChoice}</div>
              )}
            </div>
          )}

          {botFinished && (
            <div style={{marginTop:10}}>
              <div style={{marginBottom:8, opacity:.9}}>Series complete! Score submitted.</div>
              <button onClick={() => { setMeScore(0); setBotScore(0); setRound(1); setBotFinished(false); }}>New Series</button>
            </div>
          )}
        </div>
      )}

      {mode==='online' && (
        <div className="stat-card" style={{textAlign:'center'}}>
          {peerLeft && <div style={{marginBottom:6, color:'#ffd54f'}}>{peerLeft}</div>}
          {fireworks && <Fireworks/>}
          {!state && (
            <div style={{display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap'}}>
              <button onClick={createRoom}>Create Room</button>
              <div style={{display:'inline-flex', gap:6, alignItems:'center'}}>
                <input placeholder="Room code" value={inputCode} onChange={e=>setInputCode(e.target.value.toUpperCase())} style={{padding:'8px 10px', borderRadius:8}}/>
                <button onClick={joinRoom}>Join</button>
              </div>
              {err && <div style={{width:'100%', color:'#ffcdd2'}}>Error: {err}</div>}
            </div>
          )}

          {state && (
            <div>
              <div style={{marginBottom:8}}>Room: <strong>{state.code}</strong> • Best of {state.bestOf} • Round {state.round} • {state.status}</div>
              <div style={{display:'flex', gap:20, justifyContent:'center'}}>
                {state.players.map(p => (
                  <div key={p.id} style={{padding:8, borderRadius:8, background:'rgba(255,255,255,0.08)'}}>
                    <div style={{fontWeight:600}}>{p.name}</div>
                    <div>Score: {p.score}</div>
                    <div>{p.picked ? 'Locked in' : 'Choosing…'}</div>
                  </div>
                ))}
              </div>

              {state.status==='waiting' && <div style={{marginTop:8, opacity:.8}}>Waiting for opponent… share the room code.</div>}

              {state.status==='playing' && (
                <div style={{marginTop:10, display:'flex', gap:8, justifyContent:'center'}}>
                  {choices.map(c => (
                    <button key={c.key} onClick={()=>chooseOnline(c.key)} disabled={!!state.reveal || selfPicked}>{c.label}</button>
                  ))}
                </div>
              )}

              {state.reveal && (
                <div style={{marginTop:8}}>
                  {state.reveal.draw ? (
                    <div>Draw!</div>
                  ) : (
                    <div>Winner: {state.reveal.winnerName || state.reveal.winner}</div>
                  )}
                </div>
              )}

              <div style={{marginTop:10}}>
                {state.status==='finished' && <button onClick={rematch} style={{marginRight:8}}>Rematch</button>}
                <button onClick={leaveRoom}>Leave Room</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Fireworks(){
  return (
    <div style={{position:'relative'}}>
      <style>{`
        @keyframes fw-pop { 0%{transform:scale(0); opacity:0} 40%{opacity:1} 100%{transform:scale(1); opacity:0} }
      `}</style>
      <div style={{position:'absolute', left:'10%', top:0, width:6, height:6, borderRadius:'50%', background:'#ffeb3b', boxShadow:'0 0 12px #ffeb3b', animation:'fw-pop 1.2s ease-out forwards'}}></div>
      <div style={{position:'absolute', left:'50%', top:0, width:6, height:6, borderRadius:'50%', background:'#ff5722', boxShadow:'0 0 12px #ff5722', animation:'fw-pop 1.2s ease-out .1s forwards'}}></div>
      <div style={{position:'absolute', right:'12%', top:0, width:6, height:6, borderRadius:'50%', background:'#00e5ff', boxShadow:'0 0 12px #00e5ff', animation:'fw-pop 1.2s ease-out .2s forwards'}}></div>
    </div>
  );
}
