import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../../services/api.js";

/* Canvas-based rAF version: minimal React state, fixed timestep */
const CELL = 22;
const COLS = 36;
const ROWS = 26;
const BASE_INTERVAL = 110;      // ms logical step start
const MIN_INTERVAL = 55;        // ms cap
const SPEED_STEP_EVERY = 6;     // items per speed increase
const INTERVAL_DELTA = 5;       // ms reduced per step
const FOODS_TARGET = 5;
const FOOD_EMOJIS = ["🍎","🍓","🍌","🍇","🥕","🥦","🌽","🍑","🥝","🧀"];

const randCell = () => [Math.floor(Math.random()*COLS), Math.floor(Math.random()*ROWS)];
const randEmoji = () => FOOD_EMOJIS[Math.floor(Math.random()*FOOD_EMOJIS.length)];

export default function Snake() {
  /* high-level UI state */
  const [open, setOpen]           = useState(false); // popup visibility
  const [running, setRunning]     = useState(false);
  const [showResult, setShowResult] = useState(false);

  /* game state */
  // React state only for scoreboard & UI toggles
  const [score, setScore]   = useState(0);
  const [items, setItems]   = useState(0);
  const [steps, setSteps]   = useState(0);
  const [best, setBest]     = useState(0);
  const [lengthValue, setLengthValue] = useState(1);

  /* game refs (mutable, avoid re-render cost) */
  const dirRef      = useRef([1, 0]);
  const lastDirRef  = useRef([1, 0]);
  const snakeRef    = useRef([[Math.floor(COLS/2), Math.floor(ROWS/2)]]);
  const foodsRef    = useRef([]);
  const intervalRef = useRef(BASE_INTERVAL);
  const accRef      = useRef(0);            // accumulated ms
  const lastTimeRef = useRef(0);            // last rAF timestamp
  const rafRef      = useRef(null);
  const focusRef    = useRef(null);   // element to capture keyboard focus
  const canvasRef   = useRef(null);
  const scaleRef    = useRef(1);
  const runningRef  = useRef(false);

  const reset = useCallback(() => {
    const start = [Math.floor(COLS/2), Math.floor(ROWS/2)];
  snakeRef.current = [[...start]];
  setLengthValue(1);
    dirRef.current = [1, 0];
    lastDirRef.current = [1, 0];
    foodsRef.current = [];
    setScore(0);
    setItems(0);
    setSteps(0);
    setShowResult(false);
  intervalRef.current = BASE_INTERVAL;
  accRef.current = 0;
  }, []);

  const start = useCallback(() => {
    if (!open) setOpen(true);
    reset();
  runningRef.current = true;
  setRunning(true);
    setTimeout(() => { focusRef.current?.focus(); resizeCanvas(); draw(); }, 30);
  }, [reset, open]);

  /* localized keyboard handling (only active while modal open) */
  useEffect(() => {
    if (!open) return;
    const el = focusRef.current;
    if (!el) return;
    const key = (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"," "].includes(k)) e.preventDefault();
      if (!runningRef.current) {
        if (k === "enter") start();
        if (k === "escape") { closeGame(); }
        return;
      }
      const [dx, dy] = lastDirRef.current;
      if ((k === "arrowup" || k === "w")    && dy !== 1)  { dirRef.current = [0, -1]; }
      else if ((k === "arrowdown" || k === "s") && dy !== -1) { dirRef.current = [0, 1]; }
      else if ((k === "arrowleft" || k === "a") && dx !== 1)  { dirRef.current = [-1,0]; }
      else if ((k === "arrowright" || k === "d")&& dx !== -1) { dirRef.current = [1, 0]; }
      else if (k === "escape") { end(); }
    };
    el.addEventListener("keydown", key);
    return () => el.removeEventListener("keydown", key);
  }, [open, start]);

  /* keep food count filled */
  const occupied = (cell, includeHead = true) => {
    const s = snakeRef.current;
    return s.some((seg, i) => (includeHead || i > 0) && seg[0] === cell[0] && seg[1] === cell[1]);
  };

  const ensureFoods = useCallback(() => {
    const arr = foodsRef.current;
    while (arr.length < FOODS_TARGET) {
      let c;
      do { c = randCell(); } while (occupied(c));
      arr.push({ pos: c, emoji: randEmoji() });
    }
  }, []);

  useEffect(() => { if (runningRef.current) ensureFoods(); }, [running, ensureFoods]);

  /* rAF loop with fixed timestep accumulator */
  const gameLoop = useCallback((ts) => {
    if (!runningRef.current) return;
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const delta = ts - lastTimeRef.current;
    lastTimeRef.current = ts;
    accRef.current += delta;
    while (accRef.current >= intervalRef.current) {
      tick();
      accRef.current -= intervalRef.current;
    }
    draw();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [draw]);

  useEffect(() => {
    if (running) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(rafRef.current);
    }
  }, [running, gameLoop]);

  /* resize handler to scale canvas if viewport small */
  const resizeCanvas = useCallback(() => {
    const w = COLS * CELL;
    const h = ROWS * CELL;
    const availW = window.innerWidth * 0.9;
    const availH = window.innerHeight * 0.75;
    const scale = Math.min(1, Math.min(availW / w, availH / h));
    scaleRef.current = scale;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = w * scale;
      canvas.height = h * scale;
      canvas.style.width = w * scale + "px";
      canvas.style.height = h * scale + "px";
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [open, resizeCanvas]);

  /* drawing */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = scaleRef.current;
    const w = COLS * CELL * scale;
    const h = ROWS * CELL * scale;
    ctx.clearRect(0,0,w,h);

    // background
    ctx.fillStyle = "#0c1113";
    ctx.fillRect(0,0,w,h);

    // foods
    ctx.font = `${16*scale}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    foodsRef.current.forEach(f => {
      const [fx, fy] = f.pos;
      ctx.fillText(f.emoji, (fx+0.5)*CELL*scale, (fy+0.5)*CELL*scale);
    });

    // snake
    const s = snakeRef.current;
    ctx.fillStyle = "rgba(50,212,122,0.85)";
    for (let i=1;i<s.length;i++) {
      const [sx, sy] = s[i];
      ctx.fillRect(sx*CELL*scale, sy*CELL*scale, CELL*scale, CELL*scale);
    }
    const [hx, hy] = s[0];
    ctx.fillStyle = "#2ed478";
    ctx.fillRect(hx*CELL*scale, hy*CELL*scale, CELL*scale, CELL*scale);
    ctx.font = `${14*scale}px system-ui`;
    ctx.fillStyle = "#052818";
    ctx.fillText("🧪", (hx+0.5)*CELL*scale, (hy+0.5)*CELL*scale);
  }, []);

  // redraw on open resize only (animation handled by rAF)
  useEffect(() => { if (open) draw(); }, [open, draw]);

  function tick() {
    setSteps(s => s + 1); // lightweight state update (small)
    const s = snakeRef.current;
    const [dx, dy] = dirRef.current;
    const head = s[0];
    const next = [head[0] + dx, head[1] + dy];
    lastDirRef.current = dirRef.current;

    // walls
    if (next[0] < 0 || next[0] >= COLS || next[1] < 0 || next[1] >= ROWS) {
      end();
      return;
    }

    // Will we eat?
    const foodsNow = foodsRef.current;
    const eatIndex = foodsNow.findIndex(f => f.pos[0] === next[0] && f.pos[1] === next[1]);
    const willGrow = eatIndex !== -1;

    // Self collision: if not growing, ignore tail (it moves away)
    const bodyLen = willGrow ? s.length : Math.max(0, s.length - 1);
    for (let i = 0; i < bodyLen; i++) {
      const seg = s[i];
      if (seg[0] === next[0] && seg[1] === next[1]) {
        end();
        return;
      }
    }

    // Build next snake
    // mutate snake in place for perf
    if (!willGrow) {
      // move tail to front (reuse allocation)
      const tail = s.pop();
      tail[0] = next[0];
      tail[1] = next[1];
      s.unshift(tail);
    } else {
      s.unshift(next);
      setLengthValue(s.length);
    }

    if (willGrow) {
      // remove eaten food
      foodsRef.current.splice(eatIndex,1);
      setScore(sc => sc + 10);
      setItems(it => {
        const nextItems = it + 1;
        if (nextItems % SPEED_STEP_EVERY === 0 && intervalRef.current > MIN_INTERVAL) {
          intervalRef.current = Math.max(MIN_INTERVAL, intervalRef.current - INTERVAL_DELTA);
        }
        return nextItems;
      });
      ensureFoods();
    }
  }

  function end() {
  runningRef.current = false;
  setRunning(false);
    setShowResult(true);
    setBest(b => Math.max(b, score));
    (async () => { try { await api.submitScore("snake", score); } catch {} })();
  }

  const closeGame = () => {
  runningRef.current = false;
  setRunning(false);
    setShowResult(false);
    setOpen(false);
  };

  /* UI */
  const boardW = COLS * CELL;
  const boardH = ROWS * CELL;

  return (
    <div id="snake" className="game-container active" style={{ textAlign: "center" }}>
      <h2 style={{ marginBottom: 8 }}>🐍 QA Snake</h2>
      {!open && (
        <button onClick={() => { setOpen(true); setTimeout(() => focusRef.current?.focus(), 30); }}>Open Game</button>
      )}
      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeGame} style={{ background:"rgba(0,0,0,0.7)" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative" }}>
            <div ref={focusRef} tabIndex={0} style={{ outline: "none" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <strong style={{ fontSize:"1.05em" }}>Snake</strong>
                <div style={{ fontSize:"0.7em", opacity:.65, display:"flex", gap:10 }}>
                  <span>Enter start</span><span>ESC exit</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", fontSize:"0.75em", marginBottom:8 }}>
                <Stat label="Score" value={score} />
                <Stat label="Len" value={lengthValue} />
                <Stat label="Items" value={items} />
                <Stat label="Best" value={best} />
              </div>
              {!running && !showResult && (
                <button onClick={start} style={{ marginBottom:8 }}>Start</button>
              )}
              <div style={{ position:"relative", width: boardW, height: boardH, maxWidth: "90vw", maxHeight:"75vh", overflow:"hidden", borderRadius:12, boxShadow:"0 0 0 1px rgba(255,255,255,0.25), 0 8px 24px -10px rgba(0,0,0,0.6)" }}>
                <canvas ref={canvasRef} style={{ display:"block", background:"#0f1416", borderRadius:12 }} />
              </div>
              {showResult && (
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:"0.85em", marginBottom:6 }}>Run Over</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <Mini label="Score" value={score} />
                    <Mini label="Len" value={lengthValue} />
                    <Mini label="Items" value={items} />
                    <Mini label="Ticks" value={steps} />
                    <Mini label="Best" value={best} />
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button onClick={()=>{ setShowResult(false); start(); }}>Again</button>
                    <button onClick={closeGame}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.12)",
      padding: "12px 18px",
      borderRadius: "12px",
      minWidth: "90px",
      textAlign: "center",
      fontSize: "0.9em",
    }}>
      {label}<br /><strong>{value}</strong>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.1)",
      padding: "6px 10px",
      borderRadius: 6,
      display: "flex",
      gap: 4,
      alignItems: "center",
    }}>
      <span style={{ opacity:.6 }}>{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}
