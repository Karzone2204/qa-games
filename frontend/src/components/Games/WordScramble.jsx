import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../../services/api.js";

const WORDS = ["quality","testing","automation","release","sprint","ticket","feature",
  "backend","frontend","browser","adapter","engineer","console","memory","sudoku","typing"];

function shuffle(s){
  const a = s.split("");
  for (let i=a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a.join("");
}

export default function WordScramble(){
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(45);
  const [word, setWord] = useState("");
  const [scrambled, setScrambled] = useState("");
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [wasWrong, setWasWrong] = useState(false);
  const timer = useRef(null);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);

  function next(){
    const w = WORDS[Math.floor(Math.random()*WORDS.length)];
    setWord(w);
    setScrambled(shuffle(w));
    setGuess("");
  }

  function start(){
    setRunning(true);
    setTime(45);
    setScore(0);
    next();
  setAttempts(0);
  setCorrect(0);
  setShowResult(false);
  setWasWrong(false);
  setStreak(0);
  setMaxStreak(0);
  }

  useEffect(() => {
    if (!running) return;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setTime(t => {
        if (t <= 1){ clearInterval(timer.current); setRunning(false); end(); }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer.current);
  }, [running]);

  function submit(){
    if (!running) return;
    if (!guess.trim()) return;
    const ok = guess.trim().toLowerCase() === word.toLowerCase();
    setAttempts(a=>a+1);
    if (ok){
      setCorrect(c=>c+1);
      setStreak(s => {
        const ns = s+1; if (ns>maxStreak) setMaxStreak(ns); return ns; });
      const base = 12; // base per correct
      const bonus = Math.round(Math.pow(streak+1, 1.2));
      setScore(s => s + base + bonus);
      setWasWrong(false);
      next();
    } else {
      setScore(s => s - 4);
      setWasWrong(true);
      setStreak(0);
    }
  }

  function end(){
    (async () => { try { await api.submitScore("wordScram", Math.max(0, score)); } catch {} })();
    setShowResult(true);
  }

  const keyHandler = useCallback((e) => {
    if (!showResult) return;
    if (e.key === 'Escape') setShowResult(false);
    if (e.key === 'Enter') { setShowResult(false); start(); }
  }, [showResult]);

  useEffect(() => {
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [keyHandler]);

  return (
    <div id="wordScram" className="game-container active">
      <h2 style={{textAlign:"center"}}>🧩 Word Scramble</h2>
      <div className="score-display">
        <div className="score-item">Time: <span>{time}</span>s</div>
        <div className="score-item">Score: <span>{score}</span></div>
      </div>

      {!running ? (
        <div style={{textAlign:"center"}}>
          <button onClick={start}>▶️ Start</button>
        </div>
      ) : (
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"2rem", letterSpacing:"3px", margin:"10px 0"}}>{scrambled}</div>
          <input
            value={guess}
            onChange={(e)=>{ setGuess(e.target.value); if (wasWrong) setWasWrong(false); }}
            onKeyDown={(e)=>e.key==="Enter" && submit()}
            autoFocus
            style={{padding:"10px 14px", borderRadius:12, border:"2px solid transparent",
                    background: wasWrong ? "rgba(255,80,80,0.9)" : "rgba(255,255,255,0.9)",
                    color: wasWrong ? "#fff" : "#333",
                    boxShadow: wasWrong ? "0 0 0 3px rgba(255,80,80,0.4)" : "none",
                    transition:"background .2s, box-shadow .2s"}}
          />
          <div style={{marginTop:10}}>
            <button onClick={submit}>Submit</button>
          </div>
          <div style={{marginTop:8, fontSize:'.8em', opacity:.8}}>
            Solved: {correct} / {attempts} &nbsp; Streak: {streak}
          </div>
        </div>
      )}
      {showResult && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>setShowResult(false)}>
          <div className="modal-card" style={{position:'relative', textAlign:'left', maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={()=>setShowResult(false)}>✕</button>
            <h3 style={{marginTop:0}}>🧩 Session Complete</h3>
            <p style={{opacity:.85, lineHeight:1.4}}>Great run! Here's how you did.</p>
            <div style={{display:'flex', gap:'14px', flexWrap:'wrap', margin:'14px 0'}}>
              <Stat label="Score" value={score} />
              <Stat label="Solved" value={correct} />
              <Stat label="Attempts" value={attempts} />
              <Stat label="Accuracy" value={attempts? Math.round((correct/attempts)*100)+"%" : "-"} />
              <Stat label="Max Streak" value={maxStreak} />
            </div>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
              <button onClick={()=>{ setShowResult(false); start(); }}>🔁 Play Again</button>
              <button onClick={()=>setShowResult(false)}>Close</button>
            </div>
            <div style={{marginTop:10, fontSize:'.65em', opacity:.55}}>ESC to close • Enter to play again.</div>
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
