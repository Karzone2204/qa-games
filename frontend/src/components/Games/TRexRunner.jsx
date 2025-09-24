import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../../services/api.js";

export default function TRexRunner() {
  const [open, setOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const canvasRef = useRef(null);
  const gameStateRef = useRef(null);
  const rafRef = useRef(null);

  // Game constants
  const GRAV = 2600;      // px/s^2
  const JUMP_V = -880;    // px/s
  const STEP = 1/60;

  useEffect(() => {
    const stored = localStorage.getItem('trex_best');
    setBest(stored ? parseFloat(stored) : 0);
  }, []);

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    
    // Set canvas size to match container
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const W = Math.floor(rect.width);
    const H = Math.floor(rect.height);
    
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Game state
    gameStateRef.current = {
      W, H, ctx, DPR,
      running: false,
      t: 0,
      keys: { jump: false },
      world: { speed: 420, clouds: [], groundX: 0 },
      dino: {
        x: W * 0.12,
        y: H * 0.78 - 60,
        w: Math.max(48, Math.min(72, Math.round(W * 0.065))),
        h: Math.round(Math.max(48, Math.min(72, Math.round(W * 0.065))) * 0.94),
        vy: 0,
        onGround: true,
        phase: 0
      },
      obstacles: [],
      spawnTimer: 0,
      spawnEvery: 1.1,
      lastTime: performance.now(),
      acc: 0
    };

    // Initialize dino position
    const dino = gameStateRef.current.dino;
    dino.y = gameStateRef.current.H * 0.78 - dino.h;

    // Seed clouds
    for (let i = 0; i < 4; i++) {
      gameStateRef.current.world.clouds.push({
        x: Math.random() * W,
        y: H * 0.2 + Math.random() * H * 0.25,
        s: 30 + Math.random() * 40
      });
    }
  }, []);

  const groundY = useCallback(() => {
    return gameStateRef.current ? gameStateRef.current.H * 0.78 : 0;
  }, []);

  const spawnCactus = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;

    const base = 36 + Math.random() * 28;
    const cols = 1 + (Math.random() < 0.3 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0);
    const gap = 10;
    const totalW = cols * base + (cols - 1) * gap;
    const h = base * (1.3 + Math.random() * 0.5);
    const x = state.W + totalW;
    const y = groundY();
    
    state.obstacles.push({
      type: 'cactus',
      x, y, w: totalW, h: h,
      cols, base, gap
    });
  }, [groundY]);

  const collideDino = useCallback((obstacle) => {
    const state = gameStateRef.current;
    if (!state) return false;

    const dino = state.dino;
    if (obstacle.type === 'cactus') {
      const ax = dino.x + 8, ay = dino.y + 6, aw = dino.w - 14, ah = dino.h - 10;
      const bx = obstacle.x + 4, by = obstacle.y - obstacle.h, bw = obstacle.w - 8, bh = obstacle.h;
      return !(ax + aw < bx || ax > bx + bw || ay + ah < by || ay > by + bh);
    }
    return false;
  }, []);

  const update = useCallback((dt) => {
    const state = gameStateRef.current;
    if (!state || !state.running) return;

    state.t += dt;
    const speed = 420 + Math.min(420, state.t * 28);
    state.world.speed = speed;

    // Spawn obstacles
    state.spawnTimer += dt;
    if (state.spawnTimer >= Math.max(0.48, state.spawnEvery - state.t * 0.003)) {
      state.spawnTimer = 0;
      spawnCactus();
    }

    // Dino physics
    const dino = state.dino;
    if (state.keys.jump && dino.onGround) {
      dino.vy = JUMP_V;
      dino.onGround = false;
    }

    dino.vy += GRAV * dt;
    dino.y += dino.vy * dt;
    
    const gy = groundY() - dino.h;
    if (dino.y >= gy) {
      dino.y = gy;
      dino.vy = 0;
      dino.onGround = true;
    }

    dino.phase += (dino.onGround ? 12 : 4) * dt;

    // Move obstacles and check collisions
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = state.obstacles[i];
      obstacle.x -= speed * dt;
      
      if (obstacle.x + obstacle.w < -20) {
        state.obstacles.splice(i, 1);
        continue;
      }
      
      if (collideDino(obstacle)) {
        endGame();
        break;
      }
    }

    // Move ground and clouds
    state.world.groundX = (state.world.groundX - speed * dt) % 120;
    for (const cloud of state.world.clouds) {
      cloud.x -= (speed * 0.25) * dt;
      if (cloud.x < -80) {
        cloud.x = state.W + Math.random() * 200;
        cloud.y = state.H * 0.15 + Math.random() * state.H * 0.3;
      }
    }

    setScore(parseFloat(state.t.toFixed(1)));
  }, [spawnCactus, collideDino, groundY]);

  const drawCloud = useCallback((ctx, x, y, s) => {
    ctx.fillStyle = '#ffffffcc';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.36, 0, Math.PI * 2);
    ctx.arc(x + s * 0.3, y - s * 0.18, s * 0.28, 0, Math.PI * 2);
    ctx.arc(x + s * 0.6, y, s * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const drawCactus = useCallback((ctx, x, y, base, h) => {
    ctx.fillStyle = '#0f5132';
    ctx.fillRect(x + base * 0.4, y - h, base * 0.2, h);
    
    const armH = h * 0.36, armW = base * 0.16;
    ctx.fillRect(x + base * 0.15, y - h * 0.55, armW, armH);
    ctx.fillRect(x + base * 0.70, y - h * 0.45, armW, armH);
    
    ctx.beginPath();
    ctx.arc(x + base * 0.25, y - h * 0.55, armW / 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x + base * 0.78, y - h * 0.45, armW / 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x + base * 0.5, y - h, base * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const drawCactusGroup = useCallback((ctx, obstacle) => {
    const { base, gap, cols } = obstacle;
    let x = obstacle.x;
    
    for (let i = 0; i < cols; i++) {
      drawCactus(ctx, x, obstacle.y, base, obstacle.h * (0.9 + Math.random() * 0.1));
      x += base + gap;
    }
  }, [drawCactus]);

  const roundRect = useCallback((ctx, x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }, []);

  const drawDino = useCallback((ctx, x, y, w, h, phase, air) => {
    ctx.save();
    const bob = air ? 0 : Math.sin(phase * 2) * 2;
    y += bob;
    
    // Tail
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h * 0.62);
    ctx.lineTo(x - w * 0.12, y + h * 0.52);
    ctx.lineTo(x + w * 0.08, y + h * 0.72);
    ctx.closePath();
    ctx.fill();
    
    // Body
    ctx.fillStyle = '#111827';
    roundRect(ctx, x + w * 0.08, y + h * 0.28, w * 0.64, h * 0.44, 6);
    ctx.fill();
    
    // Head
    roundRect(ctx, x + w * 0.52, y + h * 0.06, w * 0.42, h * 0.36, 6);
    ctx.fill();
    
    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + w * 0.86, y + h * 0.16, w * 0.06, h * 0.06);
    ctx.fillStyle = '#111827';
    ctx.fillRect(x + w * 0.90, y + h * 0.18, w * 0.03, h * 0.03);
    
    // Mouth
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + w * 0.60, y + h * 0.26, w * 0.24, 4);
    
    // Legs
    ctx.fillStyle = '#111827';
    const t = Math.floor(phase) % 2;
    const lw = w * 0.16, lh = h * 0.38;
    
    if (t === 0) {
      ctx.fillRect(x + w * 0.22, y + h * 0.58, lw, lh);
      ctx.fillRect(x + w * 0.52, y + h * 0.58, lw, lh * 0.7);
    } else {
      ctx.fillRect(x + w * 0.22, y + h * 0.58, lw, lh * 0.7);
      ctx.fillRect(x + w * 0.52, y + h * 0.58, lw, lh);
    }
    
    ctx.restore();
  }, [roundRect]);

  const draw = useCallback(() => {
    const state = gameStateRef.current;
    if (!state) return;

    const { ctx, W, H, world, dino, obstacles } = state;
    
    // Clear canvas
    ctx.clearRect(0, 0, W, H);
    
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#eaf2ff');
    sky.addColorStop(1, '#cdeafe');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    
    // Clouds
    for (const cloud of world.clouds) {
      drawCloud(ctx, cloud.x, cloud.y, cloud.s);
    }
    
    // Ground
    const gy = groundY();
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(0, gy, W, H - gy);
    
    // Ground ticks and horizon
    ctx.fillStyle = '#eab308';
    for (let x = world.groundX; x < W; x += 120) {
      ctx.fillRect(x, gy, 40, 4);
    }
    ctx.fillRect(0, gy, W, 2);
    
    // Obstacles
    for (const obstacle of obstacles) {
      if (obstacle.type === 'cactus') {
        drawCactusGroup(ctx, obstacle);
      }
    }
    
    // Dino
    drawDino(ctx, dino.x, dino.y, dino.w, dino.h, dino.phase, !dino.onGround);
  }, [drawCloud, groundY, drawCactusGroup, drawDino]);

  const gameLoop = useCallback((now) => {
    const state = gameStateRef.current;
    if (!state) return;

    const dt = Math.min(0.05, (now - state.lastTime) / 1000);
    state.lastTime = now;
    state.acc += dt;
    
    while (state.acc >= STEP) {
      if (state.running) {
        update(STEP);
      }
      state.acc -= STEP;
    }
    
    draw();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  const startGame = useCallback(async () => {
    const state = gameStateRef.current;
    if (!state) return;

    // Reset game state
    state.running = true;
    state.t = 0;
    state.world.clouds.length = 0;
    state.world.groundX = 0;
    state.obstacles.length = 0;
    state.spawnTimer = 0;
    state.spawnEvery = 1.1;
    
    // Reset dino
    state.dino.vy = 0;
    state.dino.onGround = true;
    state.dino.y = groundY() - state.dino.h;
    state.dino.phase = 0;

    // Seed clouds
    for (let i = 0; i < 4; i++) {
      state.world.clouds.push({
        x: Math.random() * state.W,
        y: state.H * 0.2 + Math.random() * state.H * 0.25,
        s: 30 + Math.random() * 40
      });
    }

    setRunning(true);
    setShowResult(false);
    setScore(0);
  }, [groundY]);

  const endGame = useCallback(async () => {
    const state = gameStateRef.current;
    if (!state) return;

    state.running = false;
    setRunning(false);
    
    const finalScore = parseFloat(state.t.toFixed(1));
    const newBest = Math.max(best, finalScore);
    
    if (finalScore > best) {
      setBest(newBest);
      localStorage.setItem('trex_best', newBest.toFixed(1));
    }

    // Submit score
    try {
      await api.submitScore('trex', finalScore);
    } catch (err) {
      console.warn('Failed to submit score:', err);
    }

    setTimeout(() => {
      setShowResult(true);
    }, 250);
  }, [best]);

  const handleKeyPress = useCallback((e) => {
    const state = gameStateRef.current;
    if (!state) return;

    if (['Space', 'ArrowUp', ' '].includes(e.key)) {
      e.preventDefault();
      
      if (e.type === 'keydown') {
        state.keys.jump = true;
        
        if (!state.running && !showResult) {
          startGame();
        }
      } else {
        state.keys.jump = false;
      }
    }
  }, [showResult, startGame]);

  useEffect(() => {
    initGame();
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(gameLoop);

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyPress);
    window.addEventListener('resize', initGame);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyPress);
      window.removeEventListener('resize', initGame);
    };
  }, [initGame, gameLoop, handleKeyPress]);

  if (!open) {
    return (
      <div 
        className="game-card" 
        onClick={() => setOpen(true)}
        style={{ cursor: 'pointer' }}
      >
        <div className="game-icon">🦕</div>
        <div className="game-title">T-Rex Runner</div>
        <div className="game-desc">Jump over cacti in this endless runner!</div>
        <div className="game-best">Best: {best.toFixed(1)}s</div>
      </div>
    );
  }

  return (
    <div className="game-container active">
      <div className="game-header">
        <h2>🦕 T-Rex Runner</h2>
        <button className="close-btn" onClick={() => setOpen(false)}>×</button>
      </div>

      {!running && !showResult && (
        <div style={{textAlign:'center', marginBottom: '20px'}}>
          <p>Press <strong>Space</strong> or <strong>Arrow Up</strong> to jump over cacti!</p>
          <button onClick={startGame} style={{
            background: 'linear-gradient(135deg, #4CAF50, #45a049)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: '10px'
          }}>
            ▶️ Start Game
          </button>
        </div>
      )}

      {showResult && (
        <div className="game-result">
          <h3>Game Over!</h3>
          <p>Score: <strong>{score.toFixed(1)}s</strong></p>
          <p>Best: <strong>{best.toFixed(1)}s</strong></p>
          <button onClick={() => { setShowResult(false); setRunning(false); }}>Play Again</button>
        </div>
      )}

      <div className="game-canvas-container">
        {running && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 20px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            marginBottom: '10px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            <div>Score: {score.toFixed(1)}s</div>
            <div>Best: {best.toFixed(1)}s</div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="game-canvas"
          style={{
            width: '100%',
            height: '400px',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, #eaf2ff, #cdeafe)'
          }}
        />
      </div>
      
      {running && (
        <div style={{textAlign: 'center', marginTop: '15px', fontSize: '14px', opacity: '0.8'}}>
          <p>Press <kbd style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.3)'
          }}>Space</kbd> or <kbd style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.3)'
          }}>↑</kbd> to jump!</p>
        </div>
      )}
    </div>
  );
}