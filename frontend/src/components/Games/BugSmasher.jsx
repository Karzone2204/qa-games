import React, { useEffect, useRef, useState } from "react";
import { api } from "../../services/api.js";

export default function BugSmasher() {
  const areaRef = useRef(null);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [missed, setMissed] = useState(0);
  const [combo, setCombo] = useState(1);
  const [running, setRunning] = useState(false);
  const [difficulty, setDifficulty] = useState('normal'); // easy | normal | hard
  const [showDifficulty, setShowDifficulty] = useState(false);
  const lastHitRef = useRef(Date.now());
  const [finished, setFinished] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const spawnRef = useRef(null);
  const timerRef = useRef(null);
  const endedRef = useRef(false); // prevents re-triggering modal after close

  function start() {
    setScore(0);
    setTime(30);
    setMissed(0);
    setCombo(1);
    setRunning(true);
  setFinished(false);
    setSubmitted(false);
  endedRef.current = false;
    lastHitRef.current = Date.now();
  }

  const DIFFICULTIES = {
    easy: { spawnMs: 1300, missMs: 3000 },
    normal: { spawnMs: 1000, missMs: 2500 },
    hard: { spawnMs: 750, missMs: 1900 }
  };

  // game timer
  useEffect(() => {
    if (!running) return;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setRunning(false);
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [running]);

  // spawn bugs
  useEffect(() => {
    if (!running) return;
    const area = areaRef.current;
    function spawn() {
      if (!area) return;
      const bug = document.createElement("div");
      bug.className = "bug";
      bug.textContent = ["🐛","🦟","🐜","🕷️","🦗","🐞"][Math.floor(Math.random()*6)];

      const maxX = area.clientWidth - 50;
      const maxY = area.clientHeight - 50;
      bug.style.left = Math.random() * maxX + "px";
      bug.style.top  = Math.random() * maxY + "px";

      bug.onclick = () => {
        if (bug.classList.contains("smashed")) return;
        const now = Date.now();
        const delta = now - lastHitRef.current;
        lastHitRef.current = now;
        setCombo((c) => Math.min(delta < 1000 ? c + 0.5 : Math.max(1, c - 0.5), 5));
        bug.classList.add("smashed");
        setScore((s) => s + Math.floor(10 * (delta < 1000 ? combo + 0.5 : Math.max(1, combo - 0.5))));
        setTimeout(() => bug.remove(), 300);
        // popup
        const popup = document.createElement("div");
        popup.className = "score-popup";
        popup.textContent = "+10";
        popup.style.left = bug.style.left;
        popup.style.top = bug.style.top;
        area.appendChild(popup);
        setTimeout(() => popup.remove(), 1000);
      };

      area.appendChild(bug);
      const missMs = DIFFICULTIES[difficulty]?.missMs || 2500;
      // auto-miss after difficulty-specific lifetime
      setTimeout(() => {
        if (bug.isConnected && !bug.classList.contains("smashed")) {
          bug.remove();
          setMissed((m) => m + 1);
          setCombo((c) => Math.max(1, c - 1));
        }
      }, missMs);
    }

    const spawnMs = DIFFICULTIES[difficulty]?.spawnMs || 1000;
    spawnRef.current && clearInterval(spawnRef.current);
    spawnRef.current = setInterval(spawn, spawnMs);
    return () => clearInterval(spawnRef.current);
  }, [running, combo, difficulty]);

  // end-game hook: save score
  useEffect(() => {
    if (!running && time === 0 && !endedRef.current) {
      endedRef.current = true; // mark ended so we don't reopen after close
      setFinished(true);
      (async () => {
        if (!submitted) {
          try { await api.submitScore("bugSmasher", score); } catch {}
          setSubmitted(true);
        }
      })();
    }
  }, [running, time, score, combo, submitted]);

  useEffect(() => {
    if (missed >= 5 && running) {
      setRunning(false);
      setTime(0);
    }
  }, [missed, running]);

  return (
    <div id="bugSmasher" className="game-container active">
      <h2 style={{ textAlign: "center" }}>🐛 Bug Smasher Championship 🐛</h2>
      <div className="score-display">
        <div className="score-item">Score: <span id="bugScore">{score}</span></div>
        <div className="score-item">Time: <span id="bugTime">{time}</span>s</div>
        <div className="score-item">Combo: x<span id="bugCombo">{combo.toFixed(1)}</span></div>
        <div className="score-item">Missed: <span id="bugMissed">{missed}</span>/5</div>
      </div>
      <div ref={areaRef} id="bugGameArea" className="bug-game-area" />
      <div style={{ textAlign: "center" }}>
        <button onClick={start} disabled={running}>🎮 Start Game</button>
        <button
          onClick={() => {
            // If end modal is open, close it when opening difficulty
            if (finished) setFinished(false);
            setShowDifficulty(true);
          }}
          disabled={running && !finished}
        >⚙️ Difficulty</button>
      </div>
      {/* Global key / overlay handlers for difficulty modal */}
      {showDifficulty && (
        <DifficultyModal
          current={difficulty}
          difficulties={DIFFICULTIES}
          onSelect={(d) => { setDifficulty(d); setShowDifficulty(false); }}
          onClose={() => setShowDifficulty(false)}
        />
      )}
      {/* Hide end modal if difficulty selector open to avoid stacked overlays */}
      {finished && !showDifficulty && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ position:'relative', textAlign:'left' }}>
            <button className="modal-close" aria-label="Close" onClick={() => setFinished(false)}>✕</button>
            <h3 style={{marginTop:0, fontSize:'1.6em'}}>{missed >=5 ? '💥 Game Over!' : '🎮 Time Up!'}</h3>
            <p style={{opacity:.9, lineHeight:1.5}}>
              {missed >=5 ? 'Too many bugs escaped!' : 'The clock hit zero.'} Here are your stats:
            </p>
            <div style={{display:'flex', gap:'20px', flexWrap:'wrap', margin:'16px 0'}}>
              <Mini label="Score" value={score} />
              <Mini label="Combo" value={`x${combo.toFixed(1)}`} />
              <Mini label="Missed" value={`${missed}/5`} />
            </div>
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
              <button onClick={start}>🔁 Play Again</button>
              <button onClick={() => setFinished(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Extracted difficulty modal with robust close (esc, overlay click)
function DifficultyModal({ current, difficulties, onSelect, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Select difficulty"
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{ position: 'relative', textAlign: 'left' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        <h3 style={{ marginTop: 0 }}>🎚️ Select Difficulty</h3>
        <p style={{ opacity: .85, lineHeight: 1.4 }}>Adjust spawn speed and how long bugs stay before escaping.</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '12px 0' }}>
          {Object.entries(difficulties).map(([key]) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              disabled={current === key}
              style={current === key ? { outline: '2px solid #ffd700' } : null}
            >{key.charAt(0).toUpperCase() + key.slice(1)}</button>
          ))}
        </div>
        <div style={{ fontSize: '.8em', opacity: .7 }}>Easy: slower spawn + longer life. Hard: rapid spawn + short life.</div>
      </div>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{
      background:'rgba(255,255,255,0.12)',
      padding:'12px 18px',
      borderRadius:'12px',
      minWidth:'90px',
      textAlign:'center',
      fontSize:'0.9em'
    }}>
      {label}<br/><strong>{value}</strong>
    </div>
  );
}
