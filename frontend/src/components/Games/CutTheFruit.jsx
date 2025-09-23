import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../services/api.js';
import { Zap, Heart, Trophy, Play, RotateCcw } from 'lucide-react';

const CutTheFruitGame = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // UI / game state
  const [gameState, setGameState] = useState('menu'); // 'menu' | 'playing' | 'gameOver'
  const [gameMode, setGameMode] = useState('arcade'); // 'arcade' | 'zen' | 'hardcore'
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(60);
  const [comboNow, setComboNow] = useState(0);

  // Objects
  const fruitsRef = useRef([]);
  const piecesRef = useRef([]);
  const trailsRef = useRef([]);        // silver blade segments
  const dropletsRef = useRef([]);      // juice droplets
  const stainsRef = useRef([]);        // background stains
  const floatersRef = useRef([]);      // floating score texts
  const isSlicingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Loops / timers
  const rafRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const gameTimerRef = useRef(null);

  // FX
  const flashOpacityRef = useRef(0);
  const shakeRef = useRef(0);

  // Canvas metrics
  const logicalWidthRef = useRef(0);
  const logicalHeightRef = useRef(0);
  const dprRef = useRef(1);

  // Fruit configs
  const fruitTypes = [
    { name: 'banana', emoji: '🍌', points: 10, color: '#FFE135' },
    { name: 'orange', emoji: '🍊', points: 20, color: '#FF8C00' },
    { name: 'strawberry', emoji: '🍓', points: 30, color: '#FF6B6B' },
    { name: 'watermelon', emoji: '🍉', points: 40, color: '#4ECDC4' }
  ];
  const bombType = { name: 'bomb', emoji: '💣', points: 0, color: '#2C3E50' };

  // ---------- helpers ----------
  const randId = () => Math.random().toString(36).slice(2, 11);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    dprRef.current = dpr;
    logicalWidthRef.current = rect.width;
    logicalHeightRef.current = rect.height;

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const initGame = (mode) => {
    setGameMode(mode);
    setScore(0);
    setLives(3);
    setTimeLeft(mode === 'arcade' ? 60 : 999);
    setComboNow(0);

    fruitsRef.current = [];
    piecesRef.current = [];
    trailsRef.current = [];
    dropletsRef.current = [];
    stainsRef.current = [];
    floatersRef.current = [];

    shakeRef.current = 0;
    flashOpacityRef.current = 0;

    setGameState('playing');

    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    spawnTimerRef.current = setInterval(() => {
      const chance = mode === 'hardcore' ? 0.75 : mode === 'arcade' ? 0.55 : 0.5;
      if (Math.random() < chance) {
        const f = createFruit(mode);
        if (f) fruitsRef.current.push(f);
      }
    }, mode === 'hardcore' ? 650 : 950);

    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (mode === 'arcade') {
      gameTimerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) { endGame(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const endGame = useCallback(() => {
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setGameState('gameOver');
  }, []);

  const createFruit = (mode) => {
    const w = logicalWidthRef.current;
    const h = logicalHeightRef.current;
    const isBomb = mode === 'hardcore' ? Math.random() < 0.22 : Math.random() < 0.11;
    const fruitType = isBomb ? bombType : fruitTypes[(Math.random() * fruitTypes.length) | 0];

    const spawnSide = Math.random();
    let x, y, vx, vy;

    if (spawnSide < 0.7) {
      const fromLeft = Math.random() < 0.5;
      x = fromLeft ? Math.random() * (w * 0.3) : w * 0.7 + Math.random() * (w * 0.3);
      y = h + 50;
      const targetX = w * 0.3 + Math.random() * (w * 0.4);
      const targetY = h * 0.15 + Math.random() * (h * 0.3);
      const t = 1.5 + Math.random() * 0.5; // seconds
      vx = (targetX - x) / (t * 60);
      vy = ((targetY - y) / (t * 60)) - (0.25 * t * 60) / 2;
    } else if (spawnSide < 0.85) {
      x = -50; y = h * 0.5 + Math.random() * (h * 0.3);
      vx = 7 + Math.random() * 4; vy = -6 - Math.random() * 4;
    } else {
      x = w + 50; y = h * 0.5 + Math.random() * (h * 0.3);
      vx = -7 - Math.random() * 4; vy = -6 - Math.random() * 4;
    }

    return {
      id: randId(),
      type: fruitType,
      x, y, vx, vy,
      gravity: 0.25,
      size: 70 + Math.random() * 30,
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      sliced: false,
      isBomb
    };
  };

  const createFruitPieces = (fruit) => {
    const out = [];
    const n = 4 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
      const spd = 3 + Math.random() * 4;
      const size = fruit.size * (0.28 + Math.random() * 0.4);
      out.push({
        id: randId(),
        x: fruit.x + (Math.random() - 0.5) * 18,
        y: fruit.y + (Math.random() - 0.5) * 18,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 2,
        gravity: 0.4,
        size,
        rotation: fruit.rotation + (Math.random() - 0.5) * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        emoji: fruit.type.emoji,
        opacity: 1,
        fadeRate: 0.02 + Math.random() * 0.02
      });
    }
    return out;
  };

  // ---------- slicing ----------
  const isPointInFruit = (x, y, fruit) => {
    const dx = x - fruit.x, dy = y - fruit.y;
    return Math.hypot(dx, dy) < (fruit.size * 0.5) * 0.6 + 10; // generous hitbox
  };

  const lineIntersectsFruit = (x1, y1, x2, y2, fruit) => {
    const steps = Math.max(8, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (isPointInFruit(x1 + t * (x2 - x1), y1 + t * (y2 - y1), fruit)) return true;
    }
    return false;
  };

  const addJuice = (x, y, color) => {
    const n = 14 + ((Math.random() * 10) | 0);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 5.5;
      dropletsRef.current.push({
        id: randId(),
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1,
        g: 0.35,
        r: 3 + Math.random() * 4.5,
        a: 0.98,
        col: color,
        fade: 0.018 + Math.random() * 0.028
      });
    }
    stainsRef.current.push({
      id: randId(),
      x, y,
      r: 70 + Math.random() * 60,
      col: color,
      a: 0.38,
      fade: 0.0035
    });
    if (stainsRef.current.length > 20) stainsRef.current.shift();
    if (dropletsRef.current.length > 220) dropletsRef.current.splice(0, dropletsRef.current.length - 220);
  };

  const addFloater = (x, y, text, color = '#FFD700') => {
    floatersRef.current.push({
      id: randId(),
      x, y,
      vy: -1.2,
      a: 1,
      fade: 0.02,
      size: 26,
      text,
      color
    });
  };

  // FIXED: Thin silver blade trail system
  const addBladeSegment = (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    const speed = Math.hypot(dx, dy);
    
    // Only add if there's actual movement
    if (speed < 2) return;
    
    trailsRef.current.push({
      id: randId(),
      x1, y1, x2, y2,
      width: Math.min(4, 2 + speed * 0.03), // Much thinner blade
      life: 1.0,
      maxLife: 1.0
    });
    
    // Keep fewer trail segments for better performance
    if (trailsRef.current.length > 40) trailsRef.current.shift();
  };

  const handleSlice = useCallback((x1, y1, x2, y2) => {
    const sliced = [];
    const keep = [];
    const fruits = fruitsRef.current;

    for (let i = 0; i < fruits.length; i++) {
      const f = fruits[i];
      if (f.sliced) { keep.push(f); continue; }
      if (lineIntersectsFruit(x1, y1, x2, y2, f)) {
        if (f.isBomb) {
          setLives(prev => Math.max(0, prev - 1));
          shakeRef.current = 14;
          flashOpacityRef.current = 0.7;
          // bomb burst
          for (let k = 0; k < 8; k++) {
            const ang = (Math.PI * 2 * k) / 8;
            const spd = 5 + Math.random() * 3;
            piecesRef.current.push({
              id: randId(),
              x: f.x, y: f.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - 1,
              gravity: 0.3,
              size: 20 + Math.random() * 10,
              rotation: Math.random() * Math.PI * 2,
              rotationSpeed: (Math.random() - 0.5) * 0.4,
              emoji: '💥',
              opacity: 1,
              fadeRate: 0.04
            });
          }
        } else {
          sliced.push(f);
          piecesRef.current.push(...createFruitPieces(f));
          addJuice(f.x, f.y, f.type.color);
        }
      } else {
        keep.push(f);
      }
    }

    fruitsRef.current = keep;

    if (sliced.length > 0) {
      const base = sliced.reduce((s, f) => s + f.type.points, 0);
      const mult = sliced.length;
      const gain = base * mult;
      setScore(prev => prev + gain);
      const cx = sliced.reduce((s, f) => s + f.x, 0) / sliced.length;
      const cy = sliced.reduce((s, f) => s + f.y, 0) / sliced.length;
      addFloater(cx, cy - 10, `+${gain}`, '#FFE97F');
      if (mult > 1) {
        addFloater(cx, cy - 40, `×${mult}`, '#FF6B35');
        setComboNow(mult);
        setTimeout(() => setComboNow(0), 650);
      }
    }
  }, []);

  // ---------- input ----------
  const startSliceAt = (clientX, clientY) => {
    if (gameState !== 'playing') return;
    isSlicingRef.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    lastPosRef.current = { x, y };
  };

  const moveSliceTo = (clientX, clientY) => {
    if (gameState !== 'playing' || !isSlicingRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const { x: lx, y: ly } = lastPosRef.current;
    const dist = Math.hypot(x - lx, y - ly);

    // Optimized for thin blade - more responsive
    if (dist > 2) {
      addBladeSegment(lx, ly, x, y);
      // Test for slicing with smaller movement threshold
      if (dist > 5) handleSlice(lx, ly, x, y);
    }

    lastPosRef.current = { x, y };
  };

  const endSlice = () => { 
    isSlicingRef.current = false; 
  };

  // ---------- loop ----------
  const stepPhysics = () => {
    const w = logicalWidthRef.current;
    const h = logicalHeightRef.current;

    // fruits
    const nextFruits = [];
    for (const f of fruitsRef.current) {
      const nf = { ...f, x: f.x + f.vx, y: f.y + f.vy, vy: f.vy + f.gravity, rotation: f.rotation + f.rotationSpeed };
      const off = nf.y > h + 120 || nf.x < -120 || nf.x > w + 120;
      if (off) {
        if (!f.sliced && !f.isBomb) setLives(prev => Math.max(0, prev - 1));
      } else nextFruits.push(nf);
    }
    fruitsRef.current = nextFruits;

    // pieces
    const nextPieces = [];
    for (const p of piecesRef.current) {
      const np = { ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + p.gravity, rotation: p.rotation + p.rotationSpeed, opacity: Math.max(0, p.opacity - p.fadeRate) };
      if (np.opacity > 0 && np.y < h + 120 && np.x > -120 && np.x < w + 120) nextPieces.push(np);
    }
    piecesRef.current = nextPieces;

    // droplets
    const nextDrops = [];
    for (const d of dropletsRef.current) {
      const nd = { ...d, x: d.x + d.vx, y: d.y + d.vy, vy: d.vy + d.g, a: Math.max(0, d.a - d.fade) };
      if (nd.a > 0 && nd.y < h + 60) nextDrops.push(nd);
    }
    dropletsRef.current = nextDrops;

    // stains
    const nextStains = [];
    for (const s of stainsRef.current) {
      const ns = { ...s, a: Math.max(0, s.a - s.fade) };
      if (ns.a > 0.02) nextStains.push(ns);
    }
    stainsRef.current = nextStains;

    // FIXED: Faster trail decay for better performance
    const nextTrails = [];
    for (const t of trailsRef.current) {
      const nt = { ...t, life: Math.max(0, t.life - 0.05) }; // Faster decay for performance
      if (nt.life > 0) nextTrails.push(nt);
    }
    trailsRef.current = nextTrails;

    // floaters
    const nextFloats = [];
    for (const f of floatersRef.current) {
      const nf = { ...f, y: f.y + f.vy, a: Math.max(0, f.a - f.fade) };
      if (nf.a > 0) nextFloats.push(nf);
    }
    floatersRef.current = nextFloats;

    // FX decay
    if (shakeRef.current > 0) shakeRef.current -= 0.9;
    if (flashOpacityRef.current > 0) flashOpacityRef.current = Math.max(0, flashOpacityRef.current - 0.06);
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = logicalWidthRef.current;
    const h = logicalHeightRef.current;

    ctx.clearRect(0, 0, w, h);

  // background (gaming theme blue/purple, no white)
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1e3a8a');   // deep blue
  bg.addColorStop(1, '#312e81');   // indigo
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

    // shake
    if (shakeRef.current > 0) {
      const s = shakeRef.current;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    // stains (multiply)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (const s of stainsRef.current) {
      ctx.globalAlpha = s.a;
      const grd = ctx.createRadialGradient(s.x, s.y, 5, s.x, s.y, s.r);
      grd.addColorStop(0, s.col);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // fruits
    for (const f of fruitsRef.current) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      ctx.shadowColor = 'rgba(0,0,0,0.30)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;
      ctx.font = `${f.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.type.emoji, 0, 0);
      ctx.restore();
    }

    // pieces
    for (const p of piecesRef.current) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.shadowColor = p.emoji === '💥' ? '#FF6B35' : '#FFD700';
      ctx.shadowBlur = 12;
      ctx.font = `${p.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    }

    // droplets (juice)
    for (const d of dropletsRef.current) {
      ctx.save();
      ctx.globalAlpha = d.a;
      ctx.fillStyle = d.col;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // THIN SILVER BLADE TRAIL - Fast and elegant
    for (const t of trailsRef.current) {
      ctx.save();
      
      const alpha = t.life;
      
      // Simple silver gradient - no heavy effects
      const grad = ctx.createLinearGradient(t.x1, t.y1, t.x2, t.y2);
      grad.addColorStop(0, `rgba(220, 220, 255, ${alpha * 0.9})`);
      grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
      grad.addColorStop(1, `rgba(200, 200, 230, ${alpha * 0.8})`);
      
      ctx.strokeStyle = grad;
      ctx.lineWidth = t.width;
      ctx.lineCap = 'round';
      ctx.globalAlpha = alpha;
      
      // Very subtle glow - no performance impact
      ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 4;
      
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      
      ctx.restore();
    }

    // floaters
    for (const fl of floatersRef.current) {
      ctx.save();
      ctx.globalAlpha = fl.a;
      ctx.font = `bold ${fl.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = fl.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeText(fl.text, fl.x, fl.y);
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.restore();
    }

    // bomb flash
    if (flashOpacityRef.current > 0) {
      ctx.save();
      ctx.globalAlpha = flashOpacityRef.current * 0.6;
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (shakeRef.current > 0) ctx.restore();
  };

  const loop = () => {
    if (gameState !== 'playing') return;
    stepPhysics();
    render();
    rafRef.current = requestAnimationFrame(loop);
  };

  // ---------- effects ----------
  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas]);

  useEffect(() => {
    if (gameState === 'playing') {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      render();
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameState]);

  useEffect(() => {
    if (lives <= 0 && gameState === 'playing') endGame();
  }, [lives, gameState, endGame]);

  // Submit score to season stats when game ends
  useEffect(() => {
    if (gameState === 'gameOver') {
      (async () => { try { await api.submitScore('cutFruit', score); } catch {} })();
    }
  }, [gameState, score]);

  // ---------- UI ----------
  return (
    <div className="game-container active" style={{display:'flex', flexDirection:'column', alignItems:'center', gap:12}}>
      <h2>🍎 Cut the Fruit</h2>

      <div
        ref={containerRef}
        className="w-full relative overflow-hidden"
        style={{ position:'relative', width:'100%', height:'56vh', minHeight:380, overflow:'hidden', background:'linear-gradient(135deg, rgba(2,12,34,0.7), rgba(12,36,64,0.7))', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20 }}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair select-none"
          style={{ position:'absolute', top:0, left:0, right:0, bottom:0, touchAction:'none', zIndex:2 }}
          onPointerDown={(e) => {
            e.preventDefault();
            const el = e.currentTarget;
            try { el.setPointerCapture(e.pointerId); } catch {}
            if (gameState !== 'playing') {
              // auto-start with current mode (default 'arcade')
              initGame(gameMode || 'arcade');
              // yield one frame to size canvas before reading rect
              requestAnimationFrame(() => startSliceAt(e.clientX, e.clientY));
            } else {
              startSliceAt(e.clientX, e.clientY);
            }
          }}
          onPointerMove={(e) => {
            if (!isSlicingRef.current) return;
            e.preventDefault();
            moveSliceTo(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            endSlice();
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
          }}
          onPointerCancel={(e) => {
            e.preventDefault();
            endSlice();
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
          }}
          onLostPointerCapture={endSlice}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />

        {/* HUD */}
        {gameState === 'playing' && (
          <div className="absolute inset-0" style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:10 }}>
            <div className="absolute" style={{ position:'absolute', top:12, left:12, background:'rgba(0,31,139,0.28)', border:'1px solid rgba(0,102,255,0.25)', borderRadius:8, padding:'6px 10px' }}>
              <div className="flex items-center gap-2 text-white font-bold drop-shadow">
                <Trophy className="w-5 h-5" />
                <span className="text-xl">{score}</span>
              </div>
            </div>

            <div className="absolute" style={{ position:'absolute', top:12, right:12, background:'rgba(0,31,139,0.28)', border:'1px solid rgba(0,102,255,0.25)', borderRadius:8, padding:'6px 10px' }}>
              <div className="flex items-center gap-2">
                {Array.from({ length: 3 }, (_, i) => {
                  const filled = i < lives;
                  return (
                    <Heart
                      key={i}
                      width={24}
                      height={24}
                      stroke={filled ? '#ef4444' : '#9ca3af'}
                      fill={filled ? '#ef4444' : 'none'}
                      style={{ filter: filled ? 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' : 'none' }}
                    />
                  );
                })}
              </div>
            </div>

            {gameMode === 'arcade' && (
              <div className="absolute" style={{ position:'absolute', top:80, left:'50%', transform:'translateX(-50%)', background:'rgba(0,31,139,0.28)', border:'1px solid rgba(0,102,255,0.25)', borderRadius:8, padding:'6px 10px' }}>
                <div className="flex items-center gap-2 text-white font-bold">
                  <Zap className="w-5 h-5" />
                  <span className="text-xl">{timeLeft}s</span>
                </div>
              </div>
            )}

            {comboNow > 1 && (
              <div className="absolute pointer-events-none" style={{ position:'absolute', top:112, left:'50%', transform:'translateX(-50%)' }}>
                <div className="px-4 py-1 rounded-full bg-yellow-400/90 text-gray-900 font-extrabold shadow-lg">
                  Combo ×{comboNow}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Menu */}
        {gameState === 'menu' && (
          <div className="absolute inset-0" style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:20 }}>
            <div style={{ background:'linear-gradient(135deg, rgba(12,45,90,0.85), rgba(8,20,40,0.85))', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:24, width:'100%', maxWidth:620, textAlign:'center', margin:'0 16px', backdropFilter:'blur(12px)' }}>
              <h1 style={{ fontSize:28, fontWeight:700, marginBottom:8 }}>🍎 Cut the Fruit</h1>
              <p style={{ opacity:.9, marginBottom:16 }}>Slice fruits, avoid bombs!</p>

              <div style={{ display:'grid', gap:10 }}>
                <button onClick={() => initGame('arcade')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <Play className="w-5 h-5" /> Arcade Mode (60s)
                </button>
                <button onClick={() => initGame('zen')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <Play className="w-5 h-5" /> Zen Mode (Endless)
                </button>
                <button onClick={() => initGame('hardcore')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <Play className="w-5 h-5" /> Hardcore Mode (More Bombs!)
                </button>
              </div>

              <div style={{ marginTop:20, fontSize:13, opacity:.9 }}>
                <h3 style={{ fontWeight:600, marginBottom:8 }}>Fruit Points:</h3>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {fruitTypes.map((fruit) => (
                    <div key={fruit.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span>{fruit.emoji}</span>
                      <span>{fruit.points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Over */}
        {gameState === 'gameOver' && (
          <div className="absolute inset-0" style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:20 }}>
            <div style={{ background:'linear-gradient(135deg, rgba(12,45,90,0.85), rgba(8,20,40,0.85))', color:'#fff', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:24, width:'100%', maxWidth:620, textAlign:'center', margin:'0 16px', backdropFilter:'blur(12px)' }}>
              <h2 style={{ fontSize:24, fontWeight:700, marginBottom:16 }}>Game Over!</h2>
              <div style={{ fontSize:56, marginBottom:12 }}>💥</div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#f59e0b', marginBottom:8 }}>Final Score</div>
                <div style={{ fontSize:32, fontWeight:800 }}>{score}</div>
              </div>
              <div>
                <button onClick={() => setGameState('menu')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%' }}>
                  <RotateCcw className="w-5 h-5" /> Play Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CutTheFruitGame;