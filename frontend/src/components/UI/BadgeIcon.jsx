import React from "react";

function palette(state){
  // complete: gold, locked: grey, progress: silver-blue
  if (state === 'complete') return {
    a: '#f59e0b', b: '#fbbf24', ring: '#f5c451', accent: '#b45309'
  };
  if (state === 'locked') return {
    a: '#9ca3af', b: '#6b7280', ring: '#a1a1aa', accent: '#4b5563'
  };
  return { a: '#93c5fd', b: '#60a5fa', ring: '#60a5fa', accent: '#1d4ed8' };
}

function starPoints(cx, cy, spikes, outerR, innerR){
  const pts = [];
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++){
    const r = (i % 2 === 0) ? outerR : innerR;
    const x = cx + Math.cos(rot) * r;
    const y = cy + Math.sin(rot) * r;
    pts.push(`${x},${y}`);
    rot += step;
  }
  return pts.join(' ');
}

export default function BadgeIcon({ item, size = 36 }){
  const state = item.complete ? 'complete' : (item.locked ? 'locked' : 'progress');
  const { a, b, ring, accent } = palette(state);
  const id = `${item.id || item.game}-grad-circle`;
  const g = item.game;
  const tier = Number.isFinite(item?.tier) ? item.tier : computeTier(item);
  const roman = romanTier(tier);
  const romanSize = roman === 'III' ? 18 : 20;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      {/* circular medal */}
      <circle cx="32" cy="32" r="28" fill={`url(#${id})`} stroke={ring} strokeWidth="2" />
      <circle cx="32" cy="32" r="20" fill="rgba(0,0,0,0.18)" />
      {g === 'bugSmasher' && <BugGlyph />}
      {g === 'memory' && <BrainGlyph />}
      {g === 'zip' && <ZipGlyph />}
      {(g === 'sudoku' || g === 'miniSudoku') && <GridGlyph mini={g==='miniSudoku'} />}
      {g === 'mathSprint' && <MathGlyph />}
      {g === 'typeRacer' && <KeysGlyph />}
      {g === 'rps' && <RpsGlyph />}
      {g === 'trainBrain' && <DnaGlyph />}
      {g === 'any' && <FlameGlyph />}
  {/* Bottom banner for tier (thin base at circle edge) */}
  <rect x="6" y="60" width="52" height="4" rx="2" fill={accent} stroke={ring} strokeWidth="1.5" />
  <text x="32" y="63.5" textAnchor="middle" fontSize={romanSize} fontWeight="900" fill="#ffffff" stroke="#0b1020" strokeWidth="1" style={{letterSpacing: '1.4px'}}>{roman}</text>
    </svg>
  );
}

function BugGlyph(){
  return (
    <g transform="translate(32,34)">
      <ellipse cx="0" cy="0" rx="8" ry="10" fill="#1f2937" />
      <line x1="-12" y1="-8" x2="-4" y2="-4" stroke="#111827" strokeWidth="3" strokeLinecap="round"/>
      <line x1="-12" y1="0" x2="-4" y2="0" stroke="#111827" strokeWidth="3" strokeLinecap="round"/>
      <line x1="-12" y1="8" x2="-4" y2="4" stroke="#111827" strokeWidth="3" strokeLinecap="round"/>
      <line x1="12" y1="-8" x2="4" y2="-4" stroke="#111827" strokeWidth="3" strokeLinecap="round"/>
      <line x1="12" y1="0" x2="4" y2="0" stroke="#111827" strokeWidth="3" strokeLinecap="round"/>
      <line x1="12" y1="8" x2="4" y2="4" stroke="#111827" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="-3" cy="-3" r="1.8" fill="#e5e7eb"/>
      <circle cx="3" cy="-3" r="1.8" fill="#e5e7eb"/>
    </g>
  );
}

function BrainGlyph(){
  return (
    <g transform="translate(32,30)">
      <path d="M-10,-2 C-12,-8 -4,-10 -2,-8 C-2,-12 4,-12 4,-8 C8,-8 12,-4 10,0 C12,2 12,8 6,8 C4,12 -4,12 -6,8 C-12,10 -14,4 -10,-2 Z" fill="#111827" />
    </g>
  );
}

function ZipGlyph(){
  return (
    <polyline points="16,40 24,26 32,34 40,20 48,28" fill="none" stroke="#0b1020" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
  );
}

function GridGlyph({ mini }){
  const inset = 18;
  const step = mini ? 8 : 10;
  const size = 64 - inset*2;
  const lines = [];
  for (let i=1;i<3;i++){
    const x = inset + i*step + (mini? i*step*0.3 : i*step*0.5);
    const y = inset + i*step + (mini? i*step*0.3 : i*step*0.5);
    lines.push(<line key={`v${i}`} x1={x} y1={inset} x2={x} y2={64-inset} stroke="#0b1020" strokeWidth="3" />);
    lines.push(<line key={`h${i}`} x1={inset} y1={y} x2={64-inset} y2={y} stroke="#0b1020" strokeWidth="3" />);
  }
  return <g>{lines}</g>;
}

function MathGlyph(){
  return (
    <g stroke="#0b1020" strokeWidth="5" strokeLinecap="round">
      <line x1="20" y1="24" x2="44" y2="24"/>
      <line x1="32" y1="12" x2="32" y2="36"/>
      <line x1="22" y1="44" x2="42" y2="44"/>
    </g>
  );
}

function KeysGlyph(){
  return (
    <g fill="#0b1020">
      <rect x="18" y="20" width="10" height="10" rx="2" />
      <rect x="30" y="20" width="10" height="10" rx="2" />
      <rect x="24" y="34" width="16" height="10" rx="2" />
    </g>
  );
}

function RpsGlyph(){
  return (
    <g>
      <circle cx="24" cy="26" r="5" fill="#0b1020" />
      <circle cx="40" cy="26" r="5" fill="#0b1020" />
      <circle cx="32" cy="38" r="5" fill="#0b1020" />
    </g>
  );
}

function computeTier(item){
  if (!item || !item.id) return 1;
  const id = String(item.id);
  // Heuristic: treat these suffixes or thresholds as tier 2
  const tier2Hints = ['_pro','_grandmaster','_lightning','_ace','_elite','_ultra','_maniac','_legend','_20'];
  if (tier2Hints.some(h => id.includes(h))) return 2;
  // Tier 3 placeholder: look for _30 or _iii in id (not present yet)
  if (/_30|_iii/i.test(id)) return 3;
  return 1;
}

function romanTier(n){
  if (n >= 3) return 'III';
  if (n === 2) return 'II';
  return 'I';
}

function DnaGlyph(){
  return (
    <g stroke="#0b1020" strokeWidth="3" fill="none" strokeLinecap="round">
      <path d="M22,16 C34,26 30,34 42,44" />
      <path d="M42,16 C30,26 34,34 22,44" />
      <line x1="26" y1="24" x2="38" y2="24" />
      <line x1="26" y1="32" x2="38" y2="32" />
    </g>
  );
}

function FlameGlyph(){
  return (
    <path d="M32 16 C28 24, 40 24, 34 34 C36 36, 36 40, 32 44 C26 40, 24 36, 26 32 C22 26, 30 24, 32 16 Z" fill="#0b1020" />
  );
}
