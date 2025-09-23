import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api.js';

function DnaIcon({ size=28, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="DNA" style={style}>
      <defs>
        <linearGradient id="dnaGradA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60e6ff" />
          <stop offset="50%" stopColor="#7f74ff" />
          <stop offset="100%" stopColor="#ff5ee2" />
        </linearGradient>
        <linearGradient id="dnaGradB" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe960" />
          <stop offset="50%" stopColor="#63ffb1" />
          <stop offset="100%" stopColor="#60b0ff" />
        </linearGradient>
      </defs>
      <path d="M20 8c10 10 14 10 24 0" stroke="url(#dnaGradA)" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <path d="M20 56c10-10 14-10 24 0" stroke="url(#dnaGradA)" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <path d="M20 24c10 10 14 10 24 0" stroke="url(#dnaGradB)" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <path d="M20 40c10-10 14-10 24 0" stroke="url(#dnaGradB)" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <circle cx="24" cy="16" r="3" fill="#ffffff"/>
      <circle cx="40" cy="16" r="3" fill="#ffffff"/>
      <circle cx="24" cy="48" r="3" fill="#ffffff"/>
      <circle cx="40" cy="48" r="3" fill="#ffffff"/>
    </svg>
  );
}

/* TrainTheBrain (Visual Memory)
   Mechanics:
   - Level starts: show a grid (starting 3x3) and highlight N tiles for memorization.
   - After a short reveal (e.g., 1200ms), tiles hide.
   - User clicks tiles to reproduce pattern.
   - If all correct without mistake => advance level.
   - A wrong click ends run (game over modal) but allows restart.
   - Each level: grid size increases every few levels: 3x3 up to 5x5 maybe.
   - Pattern size grows with level.
   - Score formula: sum(level * 50) per success; bonus for streak.
*/

export default function TrainTheBrain(){
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [gridSize, setGridSize] = useState(3); // dynamic
  const [pattern, setPattern] = useState([]);  // indices
  const [revealing, setRevealing] = useState(false);
  const [inputActive, setInputActive] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [mistake, setMistake] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [score, setScore] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [bestLevel, setBestLevel] = useState(1);

  const revealTimer = useRef(null);

  function computeGridSize(lvl){
    if (lvl < 4) return 3; // 1-3
    if (lvl < 7) return 4; // 4-6
    return 5;              // 7+
  }

  function patternLength(lvl){
    if (lvl < 4) return 3 + lvl;      // 1->4..6
    if (lvl < 7) return 5 + (lvl-3);  // grows
    return 8 + (lvl-6);               // cap maybe later
  }

  function startLevel(nextLevel){
    const g = computeGridSize(nextLevel);
    const pLen = Math.min(g*g - 1, patternLength(nextLevel));
    // pick unique cells
    const all = Array.from({length: g*g}, (_,i)=>i);
    const picked = [];
    while (picked.length < pLen && all.length){
      const idx = Math.floor(Math.random()*all.length);
      picked.push(all[idx]);
      all.splice(idx,1);
    }
    setGridSize(g);
    setPattern(picked);
    setSelected(new Set());
    setMistake(false);
    setRevealing(true);
    setInputActive(false);
    setLevel(nextLevel);

    clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(()=>{
      setRevealing(false);
      setInputActive(true);
    }, 1200 + Math.min(800, picked.length * 80));
  }

  useEffect(()=>{
    return ()=> clearTimeout(revealTimer.current);
  },[]);

  function handleStart(){
    setStarted(true);
    startLevel(1);
  }

  function handleSelect(i){
    if (!inputActive || revealing || finished) return;
    if (selected.has(i)) return; // ignore duplicates

    if (!pattern.includes(i)){
      // wrong - game over
      setMistake(true);
      setFinished(true);
      setFinalScore(score);
      setShowModal(true);
      (async ()=>{ try { await api.submitScore('trainBrain', score); } catch {} })();
      return;
    }
    const next = new Set(selected);
    next.add(i);
    setSelected(next);

    // check completion
    if (next.size === pattern.length){
      // success level complete
      const levelScore = level * 50 + pattern.length * 5; // simple formula
      const newScore = score + levelScore;
      setScore(newScore);
      const nextLevel = level + 1;
      setBestLevel(b => Math.max(b, nextLevel));
      // short pause then next
      setInputActive(false);
      setTimeout(()=> startLevel(nextLevel), 600);
    }
  }

  function resetGame(){
    setFinished(false);
    setScore(0);
    setBestLevel(1);
    setStarted(true);
    startLevel(1);
    setShowModal(false);
  }

  const totalCells = gridSize * gridSize;

  return (
    <div id="trainBrain" className="game-container active">
      <h2 style={{textAlign:'center', display:'flex', gap:10, alignItems:'center', justifyContent:'center'}}>
        <DnaIcon size={30} /> <span>Train The Brain (Visual Memory)</span>
      </h2>
      {!started && (
        <div style={{display:'flex', justifyContent:'center', marginTop:8}}>
          <button onClick={handleStart} style={{padding:'10px 18px', borderRadius:999, background:'#4a90e2', color:'#fff', border:'none', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>▶ Play</button>
        </div>
      )}
      <div className="score-display">
        <div className="score-item">Level: <span>{level}</span></div>
        <div className="score-item">Grid: <span>{gridSize}x{gridSize}</span></div>
        <div className="score-item">Pattern: <span>{pattern.length}</span></div>
        <div className="score-item">Score: <span>{score}</span></div>
      </div>

      <div style={{marginTop:16, textAlign:'center', fontSize:'.9em', opacity:.85}}>
        {!started && <span>Click Play to begin.</span>}
        {started && revealing && <span>Memorize the highlighted tiles…</span>}
        {started && !revealing && !finished && inputActive && <span>Select the pattern.</span>}
        {mistake && <span style={{color:'#ffb3b3'}}>Wrong tile! Game over.</span>}
      </div>

      <div
        className="ttb-grid"
        style={{display:'grid', gridTemplateColumns:`repeat(${gridSize}, 1fr)`, gap:8, margin:'22px auto', maxWidth:520}}
      >
        {Array.from({length: totalCells}, (_,i)=>{
          const isPattern = pattern.includes(i);
          const isPicked = selected.has(i);
          const show = revealing && isPattern;
          const correctReveal = !revealing && isPicked && isPattern;
          const incorrect = !revealing && isPicked && !isPattern;
          return (
            <div key={i}
                 onClick={()=>handleSelect(i)}
                 className="ttb-cell"
                 style={{
                   cursor: started && inputActive ? 'pointer':'default',
                   height:64, borderRadius:10,
                   display:'flex', alignItems:'center', justifyContent:'center',
                   fontWeight:600,
                   background: show ? 'linear-gradient(135deg,#7ddc92,#4baf5a)'
                              : correctReveal ? 'rgba(76,175,80,0.65)'
                              : incorrect ? 'rgba(255,99,99,0.7)'
                              : 'rgba(255,255,255,0.12)',
                   boxShadow: show ? '0 0 0 2px rgba(255,255,255,0.5) inset' : 'none',
                   transition:'background .25s, transform .15s',
                   transform: isPicked ? 'scale(.94)' : 'scale(1)'
                 }}
            >{revealing && isPattern ? '' : (isPicked? (incorrect? '✖':'✓') : '')}</div>
          );
        })}
      </div>

      {/* How to play */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        marginTop: 20,
        padding: 20,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ margin: 0, fontSize: 18, color: '#333' }}>How to play</h3>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 10px)', gap: 4 }}>
              {[0,1,2,3,4,5,6,7,8].map(i => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: [0,2,4].includes(i) ? 'linear-gradient(135deg,#7ddc92,#4baf5a)' : '#e5e7eb'
                }} />
              ))}
            </div>
            <span style={{ fontSize: 14, color: '#666' }}>
              Memorize the highlighted tiles
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 10px)', gap: 4 }}>
              {[0,1,2,3,4,5,6,7,8].map(i => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: [0,2,4].includes(i) ? 'rgba(76,175,80,0.65)' : 'rgba(0,0,0,0.06)'
                }} />
              ))}
            </div>
            <span style={{ fontSize: 14, color: '#666' }}>
              Repeat the pattern by clicking the same tiles
            </span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#999', textAlign: 'center', maxWidth: 480 }}>
          Tiles flash briefly at the start. Then it’s your turn to select them in any order. A wrong tile ends the run; complete a pattern to advance and score points.
        </div>
      </div>

      {showModal && finished && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=> setShowModal(false)}>
          <div className="modal-card" style={{position:'relative', textAlign:'left'}} onClick={e=>e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={()=> setShowModal(false)}>✕</button>
            <h3 style={{marginTop:0, display:'flex', alignItems:'center', gap:8}}><DnaIcon size={22}/> <span>Run Complete</span></h3>
            <p style={{opacity:.85}}>Final Score: <strong>{finalScore}</strong></p>
            <p style={{opacity:.85}}>Highest Level Reached: <strong>{level}</strong></p>
            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              <button onClick={resetGame}>🔁 Play Again</button>
              <button onClick={()=> setShowModal(false)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
