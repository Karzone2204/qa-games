import React from 'react';

export default function BackgroundAura({ variant='default' }) {
  // variant hook if we ever want different blob colors.
  return (
    <div aria-hidden="true" style={base}>
      <div style={blob('#0ea5e9', 700, 700, '-15%', '-10%')} />
      <div style={blob('#10b981', 640, 640, '68%', '60%')} />
    </div>
  );
}

const base = {
  position:'fixed', inset:0, zIndex:0,
  background:'#0b1322',
  backgroundImage:'radial-gradient(circle at 50% 40%, rgba(32,78,112,0.50), rgba(11,19,34,0.95) 65%)',
  overflow:'hidden', pointerEvents:'none'
};
const blob = (color, w, h, left, top)=>({ position:'absolute', left, top, width:w, height:h, background:color, opacity:.16, filter:'blur(140px)', borderRadius:'50%' });
