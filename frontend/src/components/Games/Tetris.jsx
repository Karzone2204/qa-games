import React, { useEffect, useMemo, useRef, useState } from "react";

const COLS = 4;
const ROWS = 20;
const SPEEDS = { start: 800, fast: 70 }; // ms per tick

// Tetromino shapes with rotation states
const SHAPES = {
  I: [
    [[1,1,1,1]],
    [[1],[1],[1],[1]],
  ],
  O: [
    [[1,1],[1,1]],
  ],
  T: [
    [[1,1,1],[0,1,0]],
    [[1,0],[1,1],[1,0]],
    [[0,1,0],[1,1,1]],
    [[0,1],[1,1],[0,1]],
  ],
  S: [
    [[0,1,1],[1,1,0]],
    [[1,0],[1,1],[0,1]],
  ],
  Z: [
    [[1,1,0],[0,1,1]],
    [[0,1],[1,1],[1,0]],
  ],
  J: [
    [[1,0,0],[1,1,1]],
    [[1,1],[1,0],[1,0]],
    [[1,1,1],[0,0,1]],
    [[0,1],[0,1],[1,1]],
  ],
  L: [
    [[0,0,1],[1,1,1]],
    [[1,0],[1,0],[1,1]],
    [[1,1,1],[1,0,0]],
    [[1,1],[0,1],[0,1]],
  ],
};

const COLORS = {
  I: "#00FFFF",
  O: "#FFD700",
  T: "#800080",
  S: "#00FF7F",
  Z: "#FF4500",
  J: "#4169E1",
  L: "#FFA500",
};

function emptyBoard(){ return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }

function getRandomPiece(){
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random()*types.length)];
  return { type, rot: 0, x: Math.floor((COLS - SHAPES[type][0][0].length)/2), y: -2 };
}

function collides(board, piece){
  const shape = SHAPES[piece.type][piece.rot];
  for (let r=0; r<shape.length; r++){
    for (let c=0; c<shape[r].length; c++){
      if (!shape[r][c]) continue;
      const x = piece.x + c;
      const y = piece.y + r;
      if (y >= ROWS || x < 0 || x >= COLS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

function merge(board, piece){
  const out = board.map(row => row.slice());
  const shape = SHAPES[piece.type][piece.rot];
  for (let r=0; r<shape.length; r++){
    for (let c=0; c<shape[r].length; c++){
      if (shape[r][c]){
        const y = piece.y + r; const x = piece.x + c;
        if (y >= 0) out[y][x] = piece.type;
      }
    }
  }
  return out;
}

function clearLines(board){
  const keep = board.filter(row => row.some(cell => !cell) );
  const cleared = ROWS - keep.length;
  while (keep.length < ROWS) keep.unshift(Array(COLS).fill(null));
  return { board: keep, cleared };
}

export default function Tetris(){
  const [board, setBoard] = useState(()=>emptyBoard());
  const [active, setActive] = useState(()=>getRandomPiece());
  const [next, setNext] = useState(()=>getRandomPiece());
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [softDrop, setSoftDrop] = useState(false);

  const tickRef = useRef(null);

  function reset(){
    setBoard(emptyBoard());
    setActive(getRandomPiece());
    setNext(getRandomPiece());
    setScore(0);
    setLevel(1);
    setGameOver(false);
    setRunning(true);
  }

  function spawn(){
    const p = { ...next };
    p.rot = 0; p.x = Math.floor((COLS - SHAPES[p.type][0][0].length)/2); p.y = -2;
    if (collides(board, p)){
      setGameOver(true); setRunning(false);
      return;
    }
    setActive(p);
    setNext(getRandomPiece());
  }

  function rotate(dir){
    if (!running || gameOver) return;
    const p = { ...active, rot: (active.rot + dir + SHAPES[active.type].length) % SHAPES[active.type].length };
    if (!collides(board, p)) setActive(p);
  }

  function move(dx){
    if (!running || gameOver) return;
    const p = { ...active, x: active.x + dx };
    if (!collides(board, p)) setActive(p);
  }

  function hardDrop(){
    if (!running || gameOver) return;
    let p = { ...active };
    while (!collides(board, { ...p, y: p.y + 1 })) p.y++;
    lock(p);
  }

  function step(){
    if (!running || gameOver) return;
    const p = { ...active, y: active.y + 1 };
    if (collides(board, p)){
      lock(active);
    } else {
      setActive(p);
    }
  }

  function lock(p){
    const merged = merge(board, p);
    const { board: cleared, cleared: lines } = clearLines(merged);
    if (lines > 0){
      const add = [0,40,100,300,1200][lines] * level;
      setScore(prev => {
        const nextScore = prev + add;
        if (nextScore / 1000 >= level) setLevel(l => l + 1);
        return nextScore;
      });
    }
    setBoard(cleared);
    spawn();
  }

  useEffect(() => {
    function onKey(e){
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowUp') rotate(1);
      else if (e.key === 'z' || e.key === 'Z') rotate(-1);
      else if (e.key === ' ') hardDrop();
      else if (e.key === 'Shift' || e.key === 'ArrowDown') setSoftDrop(true);
    }
    function onKeyUp(e){ if (e.key === 'Shift' || e.key === 'ArrowDown') setSoftDrop(false); }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [active, board, running, gameOver, level, score]);

  useEffect(() => {
    if (!running || gameOver) return;
    const interval = softDrop ? SPEEDS.fast : Math.max(80, SPEEDS.start - (level-1)*60);
    clearInterval(tickRef.current);
    tickRef.current = setInterval(step, interval);
    return () => clearInterval(tickRef.current);
  }, [running, gameOver, level, softDrop, active, board]);

  const preview = useMemo(() => SHAPES[next.type][0], [next.type]);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'minmax(160px, 1fr) 180px', gap:16 }}>
      <div style={{ background:'#0b0b0b', padding:10, border:'1px solid #333', borderRadius:8 }}>
        <div style={{ display:'grid', gridTemplateRows:`repeat(${ROWS}, 1fr)`, gridTemplateColumns:`repeat(${COLS}, 1fr)`, gap:2 }}>
          {board.map((row, r) => row.map((cell, c) => {
            let draw = cell;
            // overlay active piece
            const shape = SHAPES[active.type][active.rot];
            const ar = r - active.y; const ac = c - active.x;
            if (ar >= 0 && ac >= 0 && shape[ar] && shape[ar][ac]) draw = active.type;
            return <div key={`${r}-${c}`} style={{ width:22, height:22, background: draw ? COLORS[draw] : '#161616', borderRadius:4, boxShadow: draw ? 'inset 0 0 4px rgba(0,0,0,0.5)' : 'none' }} />;
          }))}
        </div>
      </div>
      <div style={{ background:'#0b0b0b', padding:10, border:'1px solid #333', borderRadius:8 }}>
        <div style={{ marginBottom:10 }}><strong>Score:</strong> {score}</div>
        <div style={{ marginBottom:10 }}><strong>Level:</strong> {level}</div>
        <div style={{ marginBottom:10 }}>
          <strong>Next:</strong>
          <div style={{ display:'inline-grid', gridTemplateRows:`repeat(${preview.length}, 1fr)`, gridTemplateColumns:`repeat(${preview[0].length}, 1fr)`, gap:2, marginLeft:8, verticalAlign:'middle' }}>
            {preview.map((row, r) => row.map((v, c) => (
              <div key={`n-${r}-${c}`} style={{ width:18, height:18, background: v ? COLORS[next.type] : '#161616', borderRadius:4 }} />
            )))}
          </div>
        </div>
        {!running && !gameOver && <button onClick={()=>setRunning(true)}>Start</button>}
        {running && <button onClick={()=>setRunning(false)} style={{ marginRight:8 }}>Pause</button>}
        <button onClick={reset}>{gameOver ? 'Restart' : 'Reset'}</button>
        <div style={{ marginTop:12, fontSize:12, opacity:0.75 }}>
          Controls: Left/Right to move, Up/Z to rotate, Shift for soft drop, Space for hard drop.
        </div>
      </div>
    </div>
  );
}
