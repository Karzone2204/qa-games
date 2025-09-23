import React, { useEffect, useRef } from 'react';

// Lightweight, dependency-free confetti burst overlay.
// Usage: <ConfettiOverlay runKey={someChangingNumber} durationMs={2000} />
export default function ConfettiOverlay({ runKey = 0, durationMs = 2200 }) {
  const canvasRef = useRef(null);
  const stopRef = useRef(true);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    function resize(){
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = () => canvas.clientWidth || window.innerWidth;
    const H = () => canvas.clientHeight || window.innerHeight;

    // Particle setup
    const colors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#ff6b81', '#a29bfe', '#ffd32a'];
    const rand = (a,b)=> a + Math.random()*(b-a);
    const spawnCount = Math.min(220, Math.floor((W()*H())/25000) + 120);
    const originXs = [0.15, 0.35, 0.5, 0.65, 0.85];
    const originY = 0.15;

    const parts = [];
    for (let i=0;i<spawnCount;i++){
      const ox = originXs[i % originXs.length] + rand(-0.06, 0.06);
      const x = W()*ox;
      const y = H()*originY + rand(-10, 10);
      const speed = rand(280, 520);
      const angle = rand(75, 105) * Math.PI/180; // mostly upward
      parts.push({
        x, y,
        vx: Math.cos(angle)*speed,
        vy: -Math.abs(Math.sin(angle)*speed),
        g: rand(900, 1200),
        drag: rand(0.985, 0.994),
        size: rand(6, 10),
        rot: rand(0, Math.PI*2),
        rotSpd: rand(-6, 6),
        color: colors[i % colors.length],
        ttl: durationMs + rand(-300, 300)
      });
    }

    let last = performance.now();
    let elapsed = 0;
    stopRef.current = false;

    function frame(now){
      const dt = Math.min(0.033, (now - last)/1000);
      last = now;
      elapsed += dt*1000;

      ctx.clearRect(0,0,canvas.width, canvas.height);
      for (const p of parts){
        if (p.ttl <= 0) continue;
        // physics
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpd * dt;
        p.ttl -= dt*1000;

        // draw rectangle confetti with rotation
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size*0.6, -p.size*0.35, p.size, p.size*0.7);
        ctx.restore();
      }

      if (elapsed < durationMs || parts.some(p => p.ttl > 0)){
        rafRef.current = requestAnimationFrame(frame);
      } else {
        stopRef.current = true;
        ctx.clearRect(0,0,canvas.width, canvas.height);
      }
    }

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [runKey, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex: 9999,
      }}
    />
  );
}
