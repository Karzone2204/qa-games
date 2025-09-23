import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ConfettiOverlay from "../UI/ConfettiOverlay.jsx";
import { api } from "../../services/api.js";

// 4x4 Mini Sudoku
// Rules: Fill grid with digits 1-4 so each row, column, and 2x2 box has 1-4 without repeats.

const PUZZLES = [
  {
    // Solution S1
    grid: [
      [0,2,0,4],
      [3,0,0,0],
      [0,1,4,0],
      [4,0,2,0],
    ],
    solution: [
      [1,2,3,4],
      [3,4,1,2],
      [2,1,4,3],
      [4,3,2,1],
    ]
  },
  {
    // Different givens, same valid solution S1
    grid: [
      [1,0,0,0],
      [0,4,0,2],
      [0,0,4,0],
      [0,3,0,1],
    ],
    solution: [
      [1,2,3,4],
      [3,4,1,2],
      [2,1,4,3],
      [4,3,2,1],
    ]
  }
];

function cloneGrid(g){ return g.map(r => r.slice()); }

export default function MiniSudoku(){
  const CELL = 54;
  const [puzzle, setPuzzle] = useState(()=> PUZZLES[Math.floor(Math.random()*PUZZLES.length)]);
  const [grid, setGrid] = useState(()=> cloneGrid(puzzle.grid));
  const isFixed = useMemo(()=> puzzle.grid.map(row => row.map(v => v !== 0)), [puzzle]);

  const [selected, setSelected] = useState({r:null,c:null});
  const [time, setTime] = useState(0);
  const [errors, setErrors] = useState(0);
  const [running, setRunning] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const [showResult, setShowResult] = useState(false);
  const [completionStats, setCompletionStats] = useState(null);
  const [winKey, setWinKey] = useState(0);

  useEffect(()=> () => clearInterval(timerRef.current), []);
  useEffect(() => {
    clearInterval(timerRef.current);
    if(running && !paused){
      timerRef.current = setInterval(()=> setTime(t=>t+1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [running, paused]);

  function restart(){
    const pick = PUZZLES[Math.floor(Math.random()*PUZZLES.length)];
    setPuzzle(pick);
    setGrid(cloneGrid(pick.grid));
    setSelected({r:null,c:null});
    setTime(0); setErrors(0); setRunning(true); setPaused(false);
    setShowResult(false); setCompletionStats(null);
  }

  function handleChange(r,c,val){
    if(!running || paused) return;
    if(isFixed[r][c]) return;
    if(val === ""){ // clear
      setGrid(prev => { const next = cloneGrid(prev); next[r][c]=0; return next; });
      return;
    }
    const n = Number(val);
    if(!Number.isInteger(n) || n<1 || n>4) return;
    setGrid(prev => {
      const next = cloneGrid(prev);
      next[r][c] = n;
      if(puzzle.solution[r][c] !== n){
        setErrors(e=>e+1);
      } else {
        // correct placement — check completion
        const solved = next.every((row, ri) => row.every((v, ci) => v === (isFixed[ri][ci] ? puzzle.grid[ri][ci] : next[ri][ci]) && (v !== 0 ? v === puzzle.solution[ri][ci] : true)));
        const fullySolved = next.every((row, ri) => row.every((v, ci) => v === puzzle.solution[ri][ci]));
        if(fullySolved){
          setRunning(false); setPaused(false); clearInterval(timerRef.current);
          const score = Math.max(600 - time*4 - errors*40, 50);
          (async () => { try { await api.submitScore("miniSudoku", score); } catch {} })();
          setCompletionStats({ time, errors, score });
          setWinKey(k=>k+1);
          setShowResult(true);
        }
      }
      return next;
    });
  }

  function cellStyle(r,c, fixed, value){
    const thinColor  = "rgba(0,0,0,0.18)";
    const thickColor = "rgba(0,0,0,0.45)";
    const thin  = `1px solid ${thinColor}`;
    const thick = `2px solid ${thickColor}`;
    const correct = value!==0 && value === puzzle.solution[r][c] && !fixed;
    const wrong   = value!==0 && value !== puzzle.solution[r][c] && !fixed;
    const baseBg  = fixed ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.9)";
    const bg = wrong ? "#ffdddd" : (correct ? "#c9f7d5" : baseBg);
    const color = wrong ? "#b00000" : "#333";
    return {
      width: `${CELL}px`, height: `${CELL}px`,
      textAlign: "center", fontSize: "18px", borderRadius: "8px",
      background: bg, color, fontWeight: fixed ? 700 : 600,
      borderTop:    r === 0 ? thick : (r % 2 === 0 ? thick : thin),
      borderLeft:   c === 0 ? thick : (c % 2 === 0 ? thick : thin),
      borderRight:  c === 3 ? thick : ((c + 1) % 2 === 0 ? thick : thin),
      borderBottom: r === 3 ? thick : ((r + 1) % 2 === 0 ? thick : thin),
    };
  }

  function togglePause(){ if(!running) return; setPaused(p=>!p); }

  return (
    <div className="game-container active" style={{display:'flex', flexDirection:'column', alignItems:'center', gap:12}}>
      {showResult && completionStats && <ConfettiOverlay runKey={winKey} durationMs={2000} />}
      <h2>🔢 Mini Sudoku (4x4)</h2>
      <div className="score-display">
        <div className="score-item">Time: <span>{time}</span>s</div>
        <div className="score-item">Errors: <span>{errors}</span></div>
        <div className="score-item">Status: <span>{!running ? 'idle' : (paused ? 'paused' : 'running')}</span></div>
      </div>

      <div
        style={{
          display:'grid', gridTemplateColumns:`repeat(4, ${CELL}px)`, gap:'0px', margin:'0 auto', width:'max-content',
          background:'rgba(255,255,255,0.1)', padding:'10px', borderRadius:'12px'
        }}
      >
        {grid.map((row,r)=> row.map((value,c)=>{
          const fixed = isFixed[r][c];
          return (
            <input key={`${r}-${c}`}
                   value={value||''}
                   disabled={fixed}
                   onChange={(e)=>handleChange(r,c,e.target.value)}
                   maxLength={1} inputMode="numeric" pattern="[1-4]"
                   style={cellStyle(r,c,fixed,value)} />
          );
        }))}
      </div>

      <div style={{textAlign:'center', marginTop:12}}>
        <button onClick={restart} disabled={running && !paused}>🔁 New Puzzle</button>
        <button onClick={togglePause} disabled={!running} style={{marginLeft:8}}>
          {paused ? '▶️ Resume' : '⏸️ Pause'}
        </button>
      </div>

      {showResult && completionStats && (
        <ResultModal
          stats={completionStats}
          onReplay={()=>{ setShowResult(false); restart(); }}
          onClose={()=> setShowResult(false)}
        />
      )}
    </div>
  );
}

function ResultModal({ stats, onClose, onReplay }){
  const { time, errors, score } = stats;
  const keyHandler = useCallback((e)=>{
    if(e.key==='Escape') onClose();
    if(e.key==='Enter'){ onClose(); onReplay(); }
  }, [onClose,onReplay]);
  useEffect(()=>{ window.addEventListener('keydown', keyHandler); return ()=> window.removeEventListener('keydown', keyHandler); }, [keyHandler]);
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" style={{position:'relative', textAlign:'left', maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        <h3 style={{marginTop:0}}>🔢 Mini Sudoku Complete</h3>
        <p style={{opacity:.85, lineHeight:1.4}}>Nice solve! Your stats:</p>
        <div style={{display:'flex', gap:'14px', flexWrap:'wrap', margin:'14px 0'}}>
          <Stat label="Score" value={score} />
          <Stat label="Time" value={`${time}s`} />
          <Stat label="Errors" value={errors} />
          <Stat label="Efficiency" value={`${Math.max(0, 100 - Math.floor(errors * 10))}%`} />
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

function Stat({ label, value }){
  return (
    <div style={{
      background:'rgba(255,255,255,0.12)', padding:'10px 16px', borderRadius:'12px', minWidth:'90px', textAlign:'center', fontSize:'0.8em'
    }}>
      {label}<br/><strong>{value}</strong>
    </div>
  );
}
