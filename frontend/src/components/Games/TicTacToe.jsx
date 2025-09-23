import React, { useEffect, useRef, useState } from "react";
import { api } from "../../services/api.js";
import ModeToggle from "../UI/ModeToggle.jsx";

const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function winner(cells){
  for (const [a,b,c] of LINES){
    if (cells[a] && cells[a]===cells[b] && cells[a]===cells[c]) return cells[a];
  }
  return null;
}

function aiMove(cells){
  // Simple AI: win > block > center > corner > random
  const empty = cells.map((v,i)=>v?null:i).filter(i=>i!==null);
  // try to win
  for (const i of empty){
    const test = cells.slice(); test[i]='O';
    if (winner(test)==='O') return i;
  }
  // block
  for (const i of empty){
    const test = cells.slice(); test[i]='X';
    if (winner(test)==='X') return i;
  }
  if (empty.includes(4)) return 4;
  const corners=[0,2,6,8].filter(i=>empty.includes(i));
  if (corners.length) return corners[Math.floor(Math.random()*corners.length)];
  return empty[Math.floor(Math.random()*empty.length)];
}

const RAW = import.meta.env.VITE_API_BASE || "";
const BASE = RAW.replace(/\/+$/, "");

export default function TicTacToe(){
  const [cells, setCells] = useState(Array(9).fill(null));
  const [xTurn, setXTurn] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [resultMsg, setResultMsg] = useState("");
  const [mode, setMode] = useState('bot'); // 'bot' | 'online'
  const [roomInput, setRoomInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [tttState, setTttState] = useState(null);
  const socketRef = useRef(null);
  const [peerLeft, setPeerLeft] = useState(null);
  const W = winner(cells);
  const full = cells.every(Boolean);

  useEffect(() => {
    if (mode !== 'bot') return;
    if (!xTurn && !W && !full){
      const i = aiMove(cells);
      setTimeout(() => {
        setCells(prev => {
          if (prev[i]) return prev;
          const next = prev.slice(); next[i] = 'O'; return next;
        });
        setXTurn(true);
      }, 300);
    }
  }, [mode, xTurn, W, full, cells]);

  useEffect(() => {
    if (mode !== 'bot') return;
    if (W || full){
      let score = 0, msg = "It's a draw.";
      if (W === 'X'){ score = 120; msg = "You win! 🎉"; }
      else if (W === 'O'){ score = 20; msg = "You lose. 😅"; }
      (async () => { try { await api.submitScore("tictactoe", score); } catch {} })();
      setResultMsg(msg);
      setShowResult(true);
    }
  }, [mode, W, full]);

  // Auto-join when invited
  useEffect(() => {
    function onJoin(e){
      const { game, code } = e.detail || {};
      if (game !== 'typeRacer' && game !== 'tictactoe'){} // no-op to satisfy linter
      if (game !== 'tictactoe' || !code) return;
      setMode('online');
      setRoomInput(code);
      setTimeout(()=> joinRoom(), 10);
    }
    window.addEventListener('qa:invite:join', onJoin);
    return () => window.removeEventListener('qa:invite:join', onJoin);
  }, []);

  function clickCell(i){
    if (mode === 'online'){
      if (!tttState || tttState.status !== 'playing') return;
      if (tttState.board?.[i]) return;
      // client turn guard is server-side by symbol, we just emit
      socketRef.current?.emit('ttt:move', { index: i });
      return;
    }
    if (cells[i] || W) return;
    if (!xTurn) return; // wait for AI
    setCells(prev => { const next = prev.slice(); next[i]='X'; return next; });
    setXTurn(false);
  }

  function reset(){
    setCells(Array(9).fill(null));
    setXTurn(true);
    setShowResult(false);
    setResultMsg("");
  }

  // Online wiring
  useEffect(() => {
    if (mode !== 'online'){
      if (socketRef.current){ try{ socketRef.current.disconnect(); } catch{} }
      setTttState(null); setRoomCode("");
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    (async () => {
      const { io } = await import("https://cdn.socket.io/4.7.5/socket.io.esm.min.js");
      const url = BASE || `${location.protocol}//${location.hostname}:4000`;
      const s = io(url, { transports:["websocket"], auth:{ token } });
      socketRef.current = s;
      s.on('ttt:state', (st) => {
        setTttState(st);
        if (Array.isArray(st.board)) setCells(st.board.slice());
        if (st?.code) setRoomCode(st.code);
      });
      s.on('ttt:error', (e) => { console.warn('ttt error', e); });
      s.on('ttt:peer_left', (info) => { setPeerLeft(`${info?.name||'Opponent'} left the game`); setTimeout(()=>setPeerLeft(null), 2500); });
    })();
    return () => { if (socketRef.current){ try{ socketRef.current.disconnect(); } catch{} socketRef.current=null; } };
  }, [mode]);

  function createRoom(){ socketRef.current?.emit('ttt:create'); }
  function joinRoom(){ if (roomInput.trim()) socketRef.current?.emit('ttt:join', { code: roomInput.trim().toUpperCase() }); }
  function leaveRoom(){ socketRef.current?.emit('ttt:leave'); setTttState(null); setRoomCode(""); }
  function rematch(){ socketRef.current?.emit('ttt:rematch'); }

  return (
    <div id="tictactoe" className="game-container active" style={{textAlign:"center"}}>
  <h2>❌ Tic Tac Toe {mode==='online' && <small style={{fontSize:'.6em', marginLeft:8, padding:'4px 8px', borderRadius:999, background:'rgba(0,217,255,0.25)'}}>Online</small>}</h2>
      <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:8}}>
        <ModeToggle value={mode} onChange={setMode} labels={{ bot:'Bot', online:'Online' }} />
        {mode==='bot' && (<button onClick={reset}>🔄 New Game</button>)}
      </div>
      {mode==='online' && (
        <div style={{display:'flex', gap:8, justifyContent:'center', alignItems:'center', flexWrap:'wrap', marginBottom:8}}>
          {peerLeft && <div style={{width:'100%', textAlign:'center', color:'#ffd54f'}}>{peerLeft}</div>}
          {!tttState && (
            <>
              <button onClick={createRoom}>Create Room</button>
              <input value={roomInput} onChange={e=>setRoomInput(e.target.value.toUpperCase())} placeholder="Room code" style={{padding:'6px 8px', borderRadius:8}}/>
              <button onClick={joinRoom}>Join</button>
            </>
          )}
          {tttState && (
            <>
              <span style={{opacity:.8}}>Code: {roomCode}</span>
              {tttState.status==='finished' && <button onClick={rematch}>Rematch</button>}
              <button onClick={leaveRoom}>Leave</button>
            </>
          )}
        </div>
      )}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(3,80px)", gap:"10px",
        justifyContent:"center", margin:"20px 0"
      }}>
        {cells.map((v,i)=>(
          <div key={i}
            onClick={()=>clickCell(i)}
            role="button" tabIndex={0}
            onKeyDown={(e)=>e.key==="Enter"&&clickCell(i)}
            style={{
              width:80,height:80, display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(255,255,255,0.9)", color:"#333",
              borderRadius:12, fontSize:"2rem", fontWeight:700, userSelect:"none"
            }}>
            {v || ""}
          </div>
        ))}
      </div>
      {mode==='bot' && (
        <div>
          <button onClick={reset}>🔄 New Game</button>
        </div>
      )}
      {mode==='bot' && showResult && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>setShowResult(false)}>
          <div className="modal-card" style={{position:'relative', textAlign:'left', maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={()=>setShowResult(false)}>✕</button>
            <h3 style={{marginTop:0}}>{resultMsg.includes('win') ? '🏆 Victory' : resultMsg.includes('lose') ? '🧠 Challenge' : '🤝 Draw'}</h3>
            <p style={{opacity:.85, lineHeight:1.4}}>{resultMsg}</p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,50px)', gap:'6px', margin:'14px 0'}}>
              {cells.map((c,i)=>(
                <div key={i} style={{
                  width:50,height:50, borderRadius:10,
                  background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'1.4rem', fontWeight:600
                }}>{c || ''}</div>
              ))}
            </div>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
              <button onClick={reset}>🔁 Play Again</button>
              <button onClick={()=>setShowResult(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {mode==='online' && tttState && (
        <div style={{marginTop:10, color:'#ddd'}}>
          <div>Players: {tttState.players?.map(p=>p.name).join(' vs ')}</div>
          <div>Status: {tttState.status}{tttState.status==='playing' ? (", your turn is "+ (tttState.turn ? (tttState.players?.find(p=>p.id===tttState.turn)?.name || '…') : '…')) : ''}</div>
          {tttState.status==='finished' && (
            <div style={{marginTop:6, color: tttState.draw? '#ffd54f' : '#b2ff59'}}>
              {tttState.draw ? 'Draw!' : (tttState.winnerName ? `Winner: ${tttState.winnerName}` : 'Finished')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
