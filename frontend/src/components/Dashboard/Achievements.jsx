import React, { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { gameTitle } from "../../services/titles.js";
import BadgeIcon from "../UI/BadgeIcon.jsx";

export default function Achievements(){
  const [season, setSeason] = useState(()=>{
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [mine, setMine] = useState({ season, badges:0, totalBadges:0, items:[] });
  useEffect(() => { api.myAchievements(season).then(setMine); }, [season]);

  const icons = {
    bugSmasher: '🐛',
    memory: '🧠',
    zip: '🧵',
    sudoku: '🔢',
    miniSudoku: '🔢',
    mathSprint: '🧮',
    typeRacer: '⌨️',
    rps: '✊',
    trainBrain: '🧬',
    any: '🔥'
  };

  return (
    <div style={{maxWidth:900, margin:"20px auto"}}>
      <div style={{display:"flex", gap:12, alignItems:"center", justifyContent:"center"}}>
        <h3 style={{margin:0}}>Season</h3>
        <input value={season} onChange={e=>setSeason(e.target.value)} style={{padding:"6px 10px", borderRadius:8}} />
      </div>

      <section style={{marginTop:24}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
          <h2 style={{margin:0, display:'flex', alignItems:'center', gap:8}}>🌟 Your Achievements</h2>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{display:'inline-flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:999, background:'linear-gradient(90deg, rgba(255,215,0,0.2), rgba(255,255,255,0.08))', boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.15)'}}>
              <span style={{fontSize:18}}>🏅</span>
              <span><strong>{mine.badges}</strong> / {mine.totalBadges}</span>
            </div>
          </div>
        </div>
        {mine.items && mine.items.length>0 && mine.items.every(it => it.locked) && (
          <div style={{marginTop:10, padding:12, borderRadius:12, background:'rgba(255,255,255,0.06)', border:'1px dashed rgba(255,255,255,0.2)'}}>
            You haven’t played any games this season yet. Play your first game to unlock progress!
          </div>
        )}
        {(!mine.items || mine.items.length===0) && (
          <div style={{marginTop:12, padding:16, borderRadius:12, background:'rgba(255,255,255,0.06)', textAlign:'center', opacity:.9}}>
            No achievements to show yet. Play a game to get started!
          </div>
        )}
        {mine.items && mine.items.length>0 && (
          <div style={{marginTop:14, padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.05)', boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.08)'}}>
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:8, opacity:.85}}>
              <span>Badge Gallery</span>
              <span style={{fontSize:12, opacity:.7}}>(Unlocked show in color; locked are dimmed)</span>
            </div>
            <div style={{display:'flex', gap:10, overflowX:'auto', paddingBottom:6}}>
              {mine.items.map(it => (
                <div key={`badge-${it.id}`} title={`${it.title} • ${it.complete ? 'Completed' : it.locked ? 'Locked' : 'In progress'}`} style={{display:'flex', flexDirection:'column', alignItems:'center', minWidth:64}}>
                  <div style={{filter: it.complete ? 'none' : it.locked ? 'grayscale(90%) brightness(0.8)' : 'saturate(0.7)'}}>
                    <BadgeIcon item={it} size={52} />
                  </div>
                  <div style={{fontSize:10, marginTop:4, maxWidth:72, textAlign:'center', opacity:.9}}>{it.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16, marginTop:12}}>
          {mine.items && mine.items.map(it => (
            <div key={it.id} style={{background:'rgba(255,255,255,0.08)', borderRadius:16, padding:16, position:'relative', overflow:'hidden'}}>
              <div style={{position:'absolute', inset:0, pointerEvents:'none', background: it.complete ? 'radial-gradient(800px 160px at 120% -10%, rgba(16,185,129,0.25), transparent)' : 'radial-gradient(800px 160px at 120% -10%, rgba(59,130,246,0.2), transparent)'}} />
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700, display:'flex', alignItems:'center', gap:10}}>
                    <span style={{fontSize:20}}>{icons[it.game] || '🎯'}</span>
                    <span>{it.title}</span>
                  </div>
                  <div style={{opacity:.85, fontSize:13}}>{it.description}</div>
                </div>
                <div title={gameTitle(it.game)} style={{opacity:.8}}>
                  {it.complete ? '🏅' : (it.locked ? '🔒' : '🧭')}
                </div>
              </div>
              <div style={{height:8, background:'rgba(255,255,255,0.15)', borderRadius:6, marginTop:12, overflow:'hidden'}}>
                <div style={{height:'100%', width:`${Math.min(100, (it.progress/it.target)*100)}%`, background: it.complete ? 'linear-gradient(90deg, #34d399, #10b981)' : 'linear-gradient(90deg, #60a5fa, #22d3ee)'}} />
              </div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:12, opacity:.9, marginTop:6}}>
                <span>{it.progress}/{it.target}</span>
                {it.locked && <span>Locked</span>}
                {(!it.locked && !it.complete) && <span>In progress</span>}
                {it.complete && <span>Completed</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
