import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../services/api.js";
import ModeToggle from "../UI/ModeToggle.jsx";

const QUOTES = [
  "Quality is not an act it is a habit.",
  "Bugs are just misunderstood features.",
  "Test early test often test automatically.",
  "If it is not tested it is broken.",
  "Move fast but do not break production.",
];

const RAW = import.meta.env.VITE_API_BASE || "";
const BASE = RAW.replace(/\/+$/, "");

export default function TypeRacer(){
  // Track a seed so we can regenerate a fresh quote when starting a new race
  const [seed, setSeed] = useState(0);
  const text = useMemo(() => QUOTES[Math.floor(Math.random()*QUOTES.length)], [seed]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [input, setInput] = useState("");
  const [startTs, setStartTs] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [botFinished, setBotFinished] = useState(false);
  const [mode, setMode] = useState('bot'); // 'bot' | 'online'
  // online state
  const socketRef = useRef(null);
  const [roomInput, setRoomInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [onlineState, setOnlineState] = useState(null); // { code, text, status, players, winner, winnerName }
  const [peerLeft, setPeerLeft] = useState(null);

  // Snapshot of final results (prevents reset wiping stats)
  const [finalStats, setFinalStats] = useState(null); // { wpm, time, accuracyPct, userFinished, botFinished, success }

  // Bot
  const [botOn, setBotOn] = useState(true);
  const [botChars, setBotChars] = useState(0);
  const botTimer = useRef(null);
  const uiTimer = useRef(null);

  function start(){
    setStarted(true);
    setFinished(false);
    setFinalStats(null);
    setStartTs(Date.now());
    // independent timer uses closure over start time directly
    const base = Date.now();
    uiTimer.current = setInterval(() => {
      setElapsed(Math.floor((Date.now()-base)/1000));
    }, 200);
    if (mode==='bot' && botOn){
      // pick a fair bot speed (30–70 WPM)
      const botWpm = 30 + Math.floor(Math.random()*41);
      const cps = (botWpm * 5) / 60; // chars per sec
      botTimer.current = setInterval(() => {
        setBotChars((c) => Math.min(c + Math.max(1, Math.round(cps)), text.length));
      }, 1000);
    }
  }

  useEffect(() => () => {
    clearInterval(botTimer.current);
    clearInterval(uiTimer.current);
  }, []);

  useEffect(() => {
    if (!started || finished) return;
    const correctChars = [...input].filter((ch, i) => ch === text[i]).length;
    const minutes = Math.max(0.01, (Date.now() - startTs)/60000);
    setWpm(Math.floor((correctChars / 5) / minutes));
    if (input === text){
      finish();
    }
  }, [input, started, text, startTs, finished]);

  function finish(){
    if (finished) return;
    setFinished(true);
    clearInterval(botTimer.current);
    clearInterval(uiTimer.current);

    // compute final snapshot
    const correctChars = [...input].filter((ch,i)=> ch === text[i]).length;
    const totalChars = text.length;
    const accuracy = totalChars ? correctChars / totalChars : 0;
    const endTimeSec = Math.max(0, Math.floor((Date.now() - startTs)/1000));
    const minutes = Math.max(0.01, endTimeSec/60);
    const finalWpm = Math.floor((correctChars/5)/minutes);
    const userFinished = input === text;
    const botDone = botChars >= text.length;
    setBotFinished(botDone);

    const success = userFinished && (!botOn || !botDone); // success if you finish before the bot (or bot off)

    setFinalStats({
      wpm: finalWpm,
      time: endTimeSec,
      accuracyPct: Math.round(accuracy * 100),
      userFinished,
      botFinished: botDone,
      success
    });

    const score = Math.max(10, finalWpm);
    (async () => { try { await api.submitScore("typeRacer", score); } catch {} })();
    setShowModal(true);
  }

  function newRace(){
    setInput('');
    setStarted(false);
    setFinished(false);
    setElapsed(0);
    setWpm(0);
    setBotChars(0);
    setBotFinished(false);
    setFinalStats(null);
    setSeed(s => s + 1); // new quote
  }

  const correctLen = [...input].filter((ch, i) => ch === text[i]).length;
  const incorrectLen = input.length - correctLen;

  const displayWpm = finalStats ? finalStats.wpm : wpm;
  const displayElapsed = finalStats ? finalStats.time : elapsed;
  const accuracyPctCurrent = text.length? Math.round((correctLen / text.length)*100) : 0;
  const displayAccuracy = finalStats ? finalStats.accuracyPct : accuracyPctCurrent;

  // Online wiring
  useEffect(() => {
    if (mode !== 'online'){
      if (socketRef.current){ try{ socketRef.current.disconnect(); } catch{} }
      setOnlineState(null); setRoomCode("");
      return;
    }
    const token = localStorage.getItem('token'); if (!token) return;
    (async () => {
      const { io } = await import("https://cdn.socket.io/4.7.5/socket.io.esm.min.js");
      const url = BASE || `${location.protocol}//${location.hostname}:4000`;
      const s = io(url, { transports:["websocket"], auth:{ token } });
      socketRef.current = s;
      s.on('type:state', (st) => { setOnlineState(st); if (st?.code) setRoomCode(st.code); });
      s.on('type:error', (e) => { console.warn('type error', e); });
      s.on('type:peer_left', (info) => { setPeerLeft(`${info?.name||'Opponent'} left the game`); setTimeout(()=>setPeerLeft(null), 2500); });
    })();
    return () => { if (socketRef.current){ try{ socketRef.current.disconnect(); } catch{} socketRef.current=null; } };
  }, [mode]);

  // Auto-join when invited
  useEffect(() => {
    function onJoin(e){
      const { game, code } = e.detail || {};
      if (game !== 'typeRacer' || !code) return;
      setMode('online');
      setRoomInput(code);
      setTimeout(()=> joinRoom(), 10);
    }
    window.addEventListener('qa:invite:join', onJoin);
    return () => window.removeEventListener('qa:invite:join', onJoin);
  }, []);

  function createRoom(){ socketRef.current?.emit('type:create'); }
  function joinRoom(){ if (roomInput.trim()) socketRef.current?.emit('type:join', { code: roomInput.trim().toUpperCase() }); }
  function startOnline(){ socketRef.current?.emit('type:start'); }
  function leaveRoom(){ socketRef.current?.emit('type:leave'); setOnlineState(null); setRoomCode(""); }
  function rematchOnline(){ socketRef.current?.emit('type:rematch'); }

  // propagate progress automatically when mode is online and playing
  useEffect(() => {
    if (mode!=='online') return;
    if (!onlineState || onlineState.status!=='playing') return;
    const id = setInterval(() => {
      socketRef.current?.emit('type:progress', { progress: input.length });
    }, 200);
    return () => clearInterval(id);
  }, [mode, onlineState, input]);

  // Auto-start when room becomes ready with two players
  useEffect(() => {
    if (mode !== 'online') return;
    if (!onlineState) return;
    const count = Array.isArray(onlineState.players) ? onlineState.players.length : 0;
    if (onlineState.status === 'ready' && count >= 2){
      startOnline();
    }
  }, [mode, onlineState]);

  function finishOnline(){ socketRef.current?.emit('type:finish'); }

  return (
    <div id="typeRacer" className="game-container active">
  <h2 style={{textAlign:"center"}}>⌨️ TypeRacer {mode==='online' && <small style={{fontSize:'.6em', marginLeft:8, padding:'4px 8px', borderRadius:999, background:'rgba(0,217,255,0.25)'}}>Online</small>}</h2>
      <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:8}}>
        <ModeToggle value={mode} onChange={setMode} />
      </div>
      <div className="score-display">
        <div className="score-item">Time: <span>{displayElapsed}</span>s</div>
        <div className="score-item">WPM: <span>{displayWpm}</span></div>
        <div className="score-item">Bot: <span>{botOn ? "enabled" : "off"}</span></div>
      </div>

      {mode==='bot' && (
      <div style={{maxWidth:800, margin:"0 auto", background:"rgba(255,255,255,0.1)", padding:16, borderRadius:12}}>
        <p style={{lineHeight:1.6}}>
          <span style={{background:"rgba(76,175,80,0.35)", borderRadius:4, padding:"2px 0"}}>
            {text.slice(0, correctLen)}
          </span>
          <span style={{background: incorrectLen>0 ? "rgba(255,107,107,0.35)" : "transparent", borderRadius:4, padding:"2px 0"}}>
            {text.slice(correctLen, correctLen + incorrectLen)}
          </span>
            <span>{text.slice(correctLen + incorrectLen)}</span>
        </p>
        {botOn && (
          <div style={{marginTop:8, opacity:0.85}}>
            🤖 Bot progress:
            <span style={{background:"rgba(255,215,0,0.4)", borderRadius:4, padding:"0 4px", marginLeft:6}}>
              {text.slice(0, botChars)}
            </span>
          </div>
        )}
      </div>
      )}

      {mode==='online' && (
        <div style={{maxWidth:800, margin:"0 auto", background:"rgba(255,255,255,0.1)", padding:16, borderRadius:12}}>
          {peerLeft && <div style={{marginBottom:6, color:'#ffd54f'}}>{peerLeft}</div>}
          {!onlineState && (
            <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap'}}>
              <button onClick={createRoom}>Create Room</button>
              <input value={roomInput} onChange={e=>setRoomInput(e.target.value.toUpperCase())} placeholder="Room code" style={{padding:'6px 8px', borderRadius:8}}/>
              <button onClick={joinRoom}>Join</button>
            </div>
          )}
          {onlineState && (
            <>
              <div style={{marginBottom:8}}>Room: <strong>{roomCode}</strong> • Status: {onlineState.status}</div>
              <div style={{marginBottom:8}}><strong>Quote:</strong> {onlineState.text}</div>
              <div style={{display:'flex', gap:16, justifyContent:'center'}}>
                {onlineState.players?.map(p => (
                  <div key={p.id} style={{background:'rgba(255,255,255,0.08)', padding:8, borderRadius:8}}>
                    <div style={{fontWeight:600}}>{p.name}</div>
                    <div>Progress: {p.progress}/{onlineState.text.length}</div>
                    <div>{p.finished ? 'Finished' : 'Racing…'}</div>
                  </div>
                ))}
              </div>
              {onlineState.status==='ready' && <div style={{textAlign:'center', marginTop:8}}><button onClick={startOnline}>Start Race</button></div>}
              {onlineState.status==='playing' && (
                <div style={{marginTop:10}}>
                  <input
                    autoFocus value={input} onChange={e=>setInput(e.target.value)}
                    onKeyDown={(e)=>{ if (e.key==='Enter') { e.preventDefault(); finishOnline(); } }}
                    placeholder="Start typing here…"
                    style={{width:"100%", maxWidth:800, margin:"0 auto", display:"block", padding:"12px 14px", borderRadius:12, border:"none", background:"rgba(255,255,255,0.9)", color:"#333"}}
                  />
                  <div style={{textAlign:'center', marginTop:8}}>
                    <button onClick={finishOnline}>Finish</button>
                  </div>
                </div>
              )}
              {onlineState.status==='finished' && (
                <div style={{textAlign:'center', marginTop:8}}>
                  <div>Winner: {onlineState.winnerName || onlineState.winner}</div>
                  <button onClick={rematchOnline} style={{marginTop:6, marginRight:8}}>Rematch</button>
                  <button onClick={leaveRoom}>Leave</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode==='bot' && (
      <div style={{textAlign:"center", marginTop:10}}>
        {!started ? (
          <>
            <button onClick={start}>🚦 {finished ? 'Start Next Race' : 'Start Race'}</button>
            <button onClick={() => setBotOn((b)=>!b)} style={{marginLeft:8}}>
              {botOn ? "Disable Bot" : "Enable Bot"}
            </button>
          </>
        ) : (
          <>
            <input
              autoFocus
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); finish(); } }}
              placeholder="Start typing here…"
              style={{width:"100%", maxWidth:800, margin:"0 auto", display:"block",
                      padding:"12px 14px", borderRadius:12, border:"none",
                      background:"rgba(255,255,255,0.9)", color:"#333"}}
              disabled={finished}
            />
            <div style={{textAlign:"center", marginTop:8}}>
              <button onClick={finish} disabled={finished}>Finish</button>
            </div>
          </>
        )}
      </div>
      )}
      {mode==='bot' && showModal && finalStats && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>{ setShowModal(false); newRace(); }}>
          <div className="modal-card" style={{position:'relative', textAlign:'left', maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={()=>{ setShowModal(false); newRace(); }}>✕</button>
            <h3 style={{marginTop:0}}>⌨️ Race Complete</h3>
            <ResultBanner stats={finalStats} />
            <p style={{opacity:.85, lineHeight:1.4}}>Review your performance:</p>
            <div style={{display:'flex', gap:'16px', flexWrap:'wrap', margin:'14px 0'}}>
              <Stat label="WPM" value={finalStats.wpm} />
              <Stat label="Time (s)" value={finalStats.time} />
              <Stat label="Accuracy" value={finalStats.accuracyPct + '%'} />
              <Stat label="Finished" value={finalStats.userFinished? 'Yes':'No'} />
              <Stat label="Bot" value={finalStats.botFinished? 'Done':'Pending'} />
            </div>
            <div style={{background:'rgba(255,255,255,0.07)', padding:'10px 12px', borderRadius:10, fontSize:'.85em', lineHeight:1.4}}>
              <strong>Quote:</strong><br/>{text}
            </div>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap', marginTop:14}}>
              <button onClick={()=>{ setShowModal(false); newRace(); }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{
      background:'rgba(255,255,255,0.12)',
      padding:'12px 18px',
      borderRadius:'12px',
      minWidth:'90px',
      textAlign:'center',
      fontSize:'0.85em'
    }}>
      {label}<br/><strong>{value}</strong>
    </div>
  );
}

function ResultBanner({ stats }) {
  let msg, color;
  if (stats.success) { msg = '✅ You beat the bot! Great job.'; color = '#b4f8c8'; }
  else if (stats.userFinished) { msg = '🤖 Bot won this time. Try again!'; color = '#ffe9a8'; }
  else { msg = '⏹ You ended early. Complete the whole quote for a win.'; color = '#ffd1d1'; }
  return (
    <div style={{background:'rgba(255,255,255,0.12)', padding:'10px 14px', borderRadius:12, margin:'8px 0'}}>
      <span style={{color}}>{msg}</span>
    </div>
  );
}
