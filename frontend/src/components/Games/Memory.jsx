import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../services/api.js";
import ConfettiOverlay from "../UI/ConfettiOverlay.jsx";

export default function Memory() {
  const TOTAL_PAIRS = 8;

  // Game state
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);  // indices (max 2)
  const [moves, setMoves]   = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [elapsed, setElapsed]   = useState(0);
  const [started, setStarted]   = useState(false); // timer/game active

  // End state
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState(null);   // "win" | "timeout" | null
  const [finalScore, setFinalScore] = useState(null);
  const [endAttempts, setEndAttempts] = useState(0);

  // Refs
  const timerRef = useRef(null);
  const resolvingRef = useRef(false);
  const runningRef   = useRef(false);

  // *** Single source of truth for matches ***
  const pairsFound = useMemo(
    () => Math.floor(cards.filter(c => c.matched).length / 2),
    [cards]
  );

  function init() {
    const emojis = ['🎮','🎯','🎨','🎭','🎪','🎸','🎲','🎳'];
    const deck = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }));

    setCards(deck);
    setFlipped([]);
    setMoves(0);
    setTimeLeft(60);
    setElapsed(0);

    setFinished(false);
    setResult(null);
    setFinalScore(null);
    setEndAttempts(0);

    resolvingRef.current = false;
    runningRef.current = true;

    // Start timer fresh only when explicitly started
    clearInterval(timerRef.current);
    setStarted(true);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
            runningRef.current = false;
            const attempts = moves + (flipped.length ? 1 : 0);
            setEndAttempts(attempts);
            setResult('timeout');
            setFinished(true);
            return 0;
        }
        return t - 1;
      });
      setElapsed(e => e + 1);
    }, 1000);
  }

  // Do NOT auto-start; only clear interval on unmount
  useEffect(() => () => clearInterval(timerRef.current), []);

  function flip(i) {
    if (!runningRef.current) return;
    if (resolvingRef.current) return;

    setCards(prev => {
      // ignore if card already up or matched, or two already up
      if (prev[i].flipped || prev[i].matched || flipped.length >= 2) return prev;

      const next = prev.map(c => ({ ...c }));
      next[i].flipped = true;

      const newFlipped = [...flipped, i];
      setFlipped(newFlipped);

      if (newFlipped.length === 2) {
        setMoves(m => m + 1);
        const [a, b] = newFlipped;
        resolvingRef.current = true;

        // Resolve after short delay
        setTimeout(() => {
          setCards(curr => {
            const clone = curr.map(c => ({ ...c }));
            const A = clone[a], B = clone[b];

            if (A && B && !A.matched && !B.matched && A.emoji === B.emoji) {
              A.matched = true;
              B.matched = true;

              // WIN CHECK using updated deck (clone)
              const found = Math.floor(clone.filter(c => c.matched).length / 2);
              if (found === TOTAL_PAIRS) {
                clearInterval(timerRef.current);
                runningRef.current = false;
                const score = Math.max(
                  1000 - ((moves + 1) * 12) - ((elapsed + 1) * 3) + (timeLeft * 5),
                  100
                );
                setFinalScore(score);
                setResult("win");
                setFinished(true);
                (async () => { try { await api.submitScore("memory", score); } catch {} })();
              }
            } else {
              // not a match → flip back
              if (A) A.flipped = false;
              if (B) B.flipped = false;
            }
            return clone;
          });

          setFlipped([]);
          resolvingRef.current = false;
        }, 700);
      }

      return next;
    });
  }

  return (
    <div id="memory" className="game-container active">
      {finished && result === 'win' && (
        <ConfettiOverlay runKey={finalScore ?? 1} durationMs={2400} />
      )}
      <h2 style={{ textAlign: "center" }}>🧠 Memory Master Challenge 🧠</h2>

      <div className="score-display">
        <div className="score-item">Moves: <span id="memoryMoves">{moves}</span></div>
        <div className="score-item">Time Left: <span id="memoryTime">{timeLeft}</span>s</div>
        <div className="score-item">Matches: <span id="memoryMatches">{pairsFound}</span>/{TOTAL_PAIRS}</div>
      </div>
      {!started && (
        <div style={{textAlign:'center', marginTop:20}}>
          <button onClick={init}>▶️ Start Game</button>
        </div>
      )}
      {started && (
        <>
          <div id="memoryGrid" className="memory-grid">
            {cards.map((c, idx) => (
              <div
                key={c.id}
                className={`memory-card ${c.flipped ? "flipped" : ""} ${c.matched ? "matched" : ""}`}
                onClick={() => flip(idx)}
              >
                {c.flipped || c.matched ? c.emoji : "?"}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <button onClick={init}>🔄 New Game</button>
          </div>
        </>
      )}

      {finished && result && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ position: 'relative', textAlign: 'left' }}>
            <button className="modal-close" onClick={() => setFinished(false)} aria-label="Close">✕</button>

            {result === 'win' ? (
              <>
                <h3 style={{marginTop:0, fontSize:'1.6em'}}>🎉 Congratulations!</h3>
                <p style={{opacity:.9, lineHeight:1.5}}>You completed the Memory Master Challenge.</p>
                <div style={{display:'flex', gap:'20px', flexWrap:'wrap', margin:'16px 0'}}>
                  <MiniStat label="Score" value={finalScore} />
                  <MiniStat label="Moves" value={moves} />
                  <MiniStat label="Time"  value={`${elapsed}s`} />
                </div>
                <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                  <button onClick={init}>🔁 Play Again</button>
                  <button onClick={() => setFinished(false)}>OK</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{marginTop:0, fontSize:'1.6em'}}>⏳ Time's up!</h3>
                <p style={{opacity:.9, lineHeight:1.5}}>Attempts: <strong>{endAttempts}</strong></p>
                <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                  <button onClick={init}>🔁 Try Again</button>
                  <button onClick={() => setFinished(false)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.12)',
      padding: '12px 18px',
      borderRadius: '12px',
      minWidth: '90px',
      textAlign:'center',
      fontSize:'0.9em'
    }}>
      {label}<br/><strong>{value}</strong>
    </div>
  );
}
