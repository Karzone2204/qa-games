import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../../services/api.js";

function makeProblem(range){
  const ops = ["+", "-", "×", "÷"];
  const op = ops[Math.floor(Math.random()*ops.length)];
  const max = range?.max || 12;
  let a = 1 + Math.floor(Math.random()*max);
  let b = 1 + Math.floor(Math.random()*max);
  if (op === "÷"){ a = a*b; } // ensure divisible
  const expr = `${a} ${op} ${b}`;
  const ans = op==="+"?a+b: op==="-"?a-b: op==="×"?a*b: a/b;
  return { expr, ans: String(ans) };
}

export default function MathSprint(){
  const DURATION = 60;
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState('normal'); // easy | normal | hard | insane
  const DIFFICULTIES = {
    easy:   { label: 'Easy',   max: 9,   mult: 0.9 },
    normal: { label: 'Normal', max: 12,  mult: 1 },
    hard:   { label: 'Hard',   max: 18,  mult: 1.25 },
    insane: { label: 'Insane', max: 24,  mult: 1.5 }
  };
  const [problem, setProblem] = useState(makeProblem(DIFFICULTIES[difficulty]));
  const [answer, setAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wasWrong, setWasWrong] = useState(false); // highlight state
  const [streak, setStreak] = useState(0);
  const [flashCorrect, setFlashCorrect] = useState(false);
  const timerRef = useRef(null);

  function start(){
    setRunning(true);
    setTime(DURATION);
    setScore(0);
    setProblem(makeProblem(DIFFICULTIES[difficulty]));
    setAnswer("");
  setShowResult(false);
  setAttempts(0);
  setCorrect(0);
  setWasWrong(false);
    setStreak(0);
    setFlashCorrect(false);
  }

  useEffect(() => {
    if (!running) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTime(t => {
        if (t <= 1){ clearInterval(timerRef.current); setRunning(false); end(); }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function submit(){
    if (!answer.trim()) return;
    const ok = answer.trim() === problem.ans;
    setAttempts(a => a + 1);
    if (ok) {
      setCorrect(c => c + 1);
      setStreak(prev => {
        const next = prev + 1;
        const base = 10; // base points
        const diffMult = DIFFICULTIES[difficulty]?.mult || 1;
        const bonus = Math.round(Math.pow(next, 1.2)); // non-linear growth
        setScore(s => s + Math.round((base + bonus) * diffMult));
        return next;
      });
      setProblem(makeProblem(DIFFICULTIES[difficulty]));
      setAnswer("");
      setWasWrong(false);
      setFlashCorrect(true);
      setTimeout(()=> setFlashCorrect(false), 220);
    } else {
      setScore(s => s - 2);
      // keep same problem so user can try again, mark wrong highlight
      setWasWrong(true);
      setStreak(0);
    }
  }

  function end(){
    (async () => { try { await api.submitScore("mathSprint", Math.max(0, score)); } catch {} })();
    setShowResult(true);
  }

  // Close / restart shortcuts on modal
  const keyHandler = useCallback((e) => {
    if (!showResult) return;
    if (e.key === 'Escape') setShowResult(false);
    if (e.key === 'Enter') { setShowResult(false); start(); }
  }, [showResult, start]);

  useEffect(() => {
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [keyHandler]);

  return (
    <div id="mathSprint" className="game-container active">
      <h2 style={{textAlign:"center"}}>🧮 Math Sprint (60s)</h2>
      <div className="score-display">
        <div className="score-item">Time: <span>{time}</span>s</div>
        <div className="score-item">Score: <span>{score}</span></div>
      </div>

      {!running ? (
        <div style={{textAlign:"center"}}>
          <div style={{marginBottom:14}}>
            {Object.entries(DIFFICULTIES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={()=> setDifficulty(key)}
                disabled={running}
                style={{
                  margin:'0 6px 6px 0',
                  outline: difficulty===key ? '2px solid #ffd700' : 'none'
                }}
              >{cfg.label}</button>
            ))}
          </div>
          <button onClick={start}>🎬 Start</button>
        </div>
      ) : (
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"2rem", margin:"10px 0"}}>{problem.expr}</div>
          <input
            value={answer}
            onChange={(e)=>{ setAnswer(e.target.value); if (wasWrong) setWasWrong(false); }}
            onKeyDown={(e)=>e.key==="Enter" && submit()}
            autoFocus
            inputMode="numeric"
            style={{padding:"10px 14px", borderRadius:12, border:"2px solid transparent",
                    background: wasWrong ? "rgba(255,80,80,0.9)" : flashCorrect ? "rgba(76,175,80,0.85)" : "rgba(255,255,255,0.9)",
                    color: wasWrong || flashCorrect ? "#fff" : "#333",
                    boxShadow: wasWrong ? "0 0 0 3px rgba(255,80,80,0.4)" : flashCorrect ? "0 0 0 3px rgba(76,175,80,0.4)" : "none",
                    transition: "background .18s, box-shadow .18s"}}
          />
          <div style={{marginTop:10}}>
            <button onClick={submit}>Submit</button>
          </div>
          <div style={{marginTop:8, fontSize:'.85em', opacity:.85}}>
            Streak: <strong>{streak}</strong>
          </div>
        </div>
      )}
      {showResult && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>setShowResult(false)}>
          <div className="modal-card" style={{position:'relative', textAlign:'left', maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={()=>setShowResult(false)}>✕</button>
            <h3 style={{marginTop:0}}>🧮 Sprint Complete</h3>
            <p style={{opacity:.85, lineHeight:1.4}}>Great effort! Here are your stats.</p>
            <div style={{display:'flex', gap:'14px', flexWrap:'wrap', margin:'14px 0'}}>
              <Stat label="Score" value={score} />
              <Stat label="Time" value={`${DURATION}s`} />
              <Stat label="Attempts" value={attempts} />
              <Stat label="Correct" value={correct} />
              <Stat label="Accuracy" value={attempts? Math.round((correct/attempts)*100)+"%" : "-"} />
              <Stat label="Max Streak" value={streak} />
              <Stat label="Difficulty" value={DIFFICULTIES[difficulty]?.label} />
            </div>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
              <button onClick={() => { setShowResult(false); start(); }}>🔁 Play Again</button>
              <button onClick={()=>setShowResult(false)}>Close</button>
            </div>
            <div style={{marginTop:10, fontSize:'.7em', opacity:.6}}>Press ESC to close or Enter to play again.</div>
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
