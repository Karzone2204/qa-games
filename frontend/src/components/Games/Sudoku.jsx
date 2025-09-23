// frontend/src/components/Games/Sudoku.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ConfettiOverlay from "../UI/ConfettiOverlay.jsx";
import { api } from "../../services/api.js";

const PUZZLE = [
  [0,0,0,2,6,0,7,0,1],
  [6,8,0,0,7,0,0,9,0],
  [1,9,0,0,0,4,5,0,0],
  [8,2,0,1,0,0,0,4,0],
  [0,0,4,6,0,2,9,0,0],
  [0,5,0,0,0,3,0,2,8],
  [0,0,9,3,0,0,0,7,4],
  [0,4,0,0,5,0,0,3,6],
  [7,0,3,0,1,8,0,0,0],
];

const SOLUTION = [
  [4,3,5,2,6,9,7,8,1],
  [6,8,2,5,7,1,4,9,3],
  [1,9,7,8,3,4,5,6,2],
  [8,2,6,1,9,5,3,4,7],
  [3,7,4,6,8,2,9,1,5],
  [9,5,1,7,4,3,6,2,8],
  [5,1,9,3,2,6,8,7,4],
  [2,4,8,9,5,7,1,3,6],
  [7,6,3,4,1,8,2,5,9],
];

export default function Sudoku(){
  const CELL = 48; // <— bigger cells
  const [grid, setGrid] = useState(PUZZLE.map(r=>r.slice()));
  const [time, setTime] = useState(0);
  const [errors, setErrors] = useState(0);
  // Start running immediately so user can type without pressing New Puzzle
  const [running, setRunning] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const [showResult, setShowResult] = useState(false);
  const [completionStats, setCompletionStats] = useState(null); // { time, errors, score }
  const [winKey, setWinKey] = useState(0);

  const isFixed = useMemo(() => PUZZLE.map(row => row.map(v => v !== 0)), []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  function start() {
    setGrid(PUZZLE.map(r=>r.slice()));
    setTime(0);
    setErrors(0);
    setRunning(true);
    setPaused(false);
  }

  function togglePause(){
    if (!running) return;
    setPaused(p => !p);
  }

  // timer only runs when running && !paused
  useEffect(() => {
    clearInterval(timerRef.current);
    if (running && !paused) {
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [running, paused]);

  function handleChange(r, c, val) {
    if (!running || paused) return;
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > 9) {
      // allow clearing with backspace
      if (val === "") {
        setGrid(prev => {
          const next = prev.map(row => row.slice());
            if (!isFixed[r][c]) next[r][c] = 0;
            return next;
        });
      }
      return;
    }
    setGrid(prev => {
      const next = prev.map(row => row.slice());
      if (!isFixed[r][c]) {
        next[r][c] = n; // always show user entry
        if (SOLUTION[r][c] !== n) {
          setErrors(e => e + 1);
        } else {
          // check solved only when correct number placed
          const solved = next.every((row, ri) => row.every((v, ci) => v === SOLUTION[ri][ci]));
          if (solved) {
            setRunning(false);
            setPaused(false);
            clearInterval(timerRef.current);
            const score = Math.max(1200 - time*6 - errors*60, 100);
            (async () => { try { await api.submitScore("sudoku", score); } catch {} })();
            setCompletionStats({ time, errors, score });
            setWinKey(k=>k+1);
            setShowResult(true);
          }
        }
      }
      return next;
    });
  }

  // borders (thin per cell + thick 3×3)
  function cellStyle(r, c, fixed){
    const thinColor  = "rgba(0,0,0,0.18)";
    const thickColor = "rgba(0,0,0,0.45)";
    const thin  = `1px solid ${thinColor}`;
    const thick = `2px solid ${thickColor}`;

    return {
      width: `${CELL}px`,
      height:`${CELL}px`,
      textAlign:"center",
      fontSize:"18px",
      borderRadius:"8px",
      background: fixed ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.9)",
      color:"#333",
      fontWeight: fixed ? 700 : 600,

      borderTop:    r === 0 ? thick : (r % 3 === 0 ? thick : thin),
      borderLeft:   c === 0 ? thick : (c % 3 === 0 ? thick : thin),
      borderRight:  c === 8 ? thick : ((c + 1) % 3 === 0 ? thick : thin),
      borderBottom: r === 8 ? thick : ((r + 1) % 3 === 0 ? thick : thin),
    };
  }

  return (
    <div id="sudoku" className="game-container active">
      {showResult && completionStats && <ConfettiOverlay runKey={winKey} durationMs={2000} />}
      <h2 style={{textAlign:"center"}}>🔢 Sudoku Master</h2>
      <div className="score-display">
        <div className="score-item">Time: <span>{time}</span>s</div>
        <div className="score-item">Errors: <span>{errors}</span></div>
        <div className="score-item">
          Status: <span>{!running ? "idle" : (paused ? "paused" : "running")}</span>
        </div>
      </div>

      <div
        style={{
          display:"grid",
          gridTemplateColumns:`repeat(9, ${CELL}px)`,
          gap:"0px",
          margin:"0 auto",
          width:"max-content",
          background:"rgba(255,255,255,0.1)",
          padding:"12px",
          borderRadius:"12px"
        }}
      >
        {grid.map((row, r) =>
          row.map((v, c) => {
            const fixed = isFixed[r][c];
            const wrong = !fixed && v !== 0 && v !== SOLUTION[r][c];
            return (
              <input
                key={`${r}-${c}`}
                value={v || ""}
                disabled={fixed}
                onChange={(e)=>handleChange(r,c,e.target.value)}
                maxLength={1}
                inputMode="numeric"
                pattern="[1-9]"
                style={{
                  ...cellStyle(r, c, fixed),
                  background: fixed ? cellStyle(r,c,fixed).background : (wrong ? "#ffdddd" : cellStyle(r,c,fixed).background),
                  color: wrong ? "#b00000" : cellStyle(r,c,fixed).color,
                  fontWeight: wrong ? 600 : cellStyle(r,c,fixed).fontWeight,
                }}
              />
            );
          })
        )}
      </div>

      <div style={{textAlign:"center", marginTop:12}}>
        <button onClick={start} disabled={running && !paused}>🧩 Reset Puzzle</button>
        <button onClick={togglePause} disabled={!running} style={{marginLeft:8}}>
          {paused ? "▶️ Resume" : "⏸️ Pause"}
        </button>
      </div>
      {showResult && completionStats && (
        <ResultModal
          stats={completionStats}
          onReplay={() => { setShowResult(false); start(); }}
          onClose={() => setShowResult(false)}
        />
      )}
    </div>
  );
}

function ResultModal({ stats, onClose, onReplay }) {
  const { time, errors, score } = stats;
  const keyHandler = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter') { onClose(); onReplay(); }
  }, [onClose, onReplay]);
  useEffect(() => {
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [keyHandler]);
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" style={{position:'relative', textAlign:'left', maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        <h3 style={{marginTop:0}}>🔢 Puzzle Complete</h3>
        <p style={{opacity:.85, lineHeight:1.4}}>Great solve! Here are your stats.</p>
        <div style={{display:'flex', gap:'14px', flexWrap:'wrap', margin:'14px 0'}}>
          <Stat label="Score" value={score} />
          <Stat label="Time" value={`${time}s`} />
          <Stat label="Errors" value={errors} />
          <Stat label="Efficiency" value={`${Math.max(0, 100 - Math.floor(errors * 5))}%`} />
        </div>
        <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
          <button onClick={onReplay}>🔁 Play Again</button>
          <button onClick={onClose}>Close</button>
        </div>
        <div style={{marginTop:10, fontSize:'.7em', opacity:.6}}>ESC to close • Enter to play again.</div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{
      background:'rgba(255,255,255,0.12)',
      padding:'10px 16px',
      borderRadius:'12px',
      minWidth:'90px',
      textAlign:'center',
      fontSize:'0.8em'
    }}>
      {label}<br/><strong>{value}</strong>
    </div>
  );
}
