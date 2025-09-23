import React, { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { gameTitle } from "../../services/titles.js";

export default function SeasonStats(){
  const [season, setSeason] = useState(()=>{
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [overall, setOverall] = useState([]);
  const [games, setGames] = useState(["bugSmasher","memory","sudoku","miniSudoku","tictactoe","typeRacer","mathSprint","wordScram","trainBrain","rps"]);
  const [tops, setTops] = useState({});
  const [loading, setLoading] = useState(false);

  async function fetchAll(){
    setLoading(true);
    try {
      const ov = await api.overall(season);
      const out = {};
      for (const g of games){ out[g] = await api.topScores(g, season); }
      setOverall(ov);
      setTops(out);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [season]);

  useEffect(() => {
    const onRefresh = () => { fetchAll(); };
    window.addEventListener('qa:score:refresh', onRefresh);
    return () => window.removeEventListener('qa:score:refresh', onRefresh);
  }, [season]);

  return (
    <div style={{maxWidth:1000, margin:"20px auto"}}>
      <style>{`
        @keyframes lb-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
      <div style={{display:"flex", gap:12, alignItems:"center", justifyContent:"center"}}>
        <h3 style={{margin:0}}>Season</h3>
        <input value={season} onChange={e=>setSeason(e.target.value)} style={{padding:"6px 10px", borderRadius:8}} />
      </div>

      <section style={{marginTop:20}}>
        <h2 style={{textAlign:"center"}}>Overall Leaderboard</h2>
        {loading && (
          <div style={{maxWidth:600, margin:"8px auto 14px", height:6, background:"rgba(255,255,255,0.12)", borderRadius:999, overflow:'hidden', position:'relative'}} aria-label="Loading overall leaderboard">
            <div style={{position:'absolute', left:0, top:0, bottom:0, width:'35%', background:'linear-gradient(90deg, #4cb3a6, #4a90e2)', borderRadius:999, animation:'lb-scan 1s linear infinite'}} />
          </div>
        )}
        <ul style={{listStyle:"none", padding:0}}>
          {overall.map((r,i)=> {
            const medals = ['🥇','🥈','🥉'];
            const medal = i < 3 ? medals[i] : null;
            const baseStyle = {
              display:"flex", justifyContent:"space-between", alignItems:'center',
              padding:"10px 14px", background:"rgba(255,255,255,0.08)", borderRadius:12,
              margin:"8px 0", border:'1px solid transparent', position:'relative', overflow:'hidden'
            };
            const podium = [
              { c:'#FFD700', bg:'linear-gradient(135deg, rgba(255,215,0,0.28), rgba(255,215,0,0.10))', br:'rgba(255,215,0,0.75)', sh:'0 10px 24px rgba(255,215,0,0.22)' },  // gold
              { c:'#C0C0C0', bg:'linear-gradient(135deg, rgba(192,192,192,0.25), rgba(192,192,192,0.10))', br:'rgba(192,192,192,0.65)', sh:'0 10px 24px rgba(192,192,192,0.20)' }, // silver
              { c:'#CD7F32', bg:'linear-gradient(135deg, rgba(205,127,50,0.25), rgba(205,127,50,0.10))', br:'rgba(205,127,50,0.65)', sh:'0 10px 24px rgba(205,127,50,0.20)' }  // bronze
            ][i] || null;
            const style = podium ? { ...baseStyle, background: podium.bg, borderColor: podium.br, boxShadow: podium.sh } : baseStyle;
            return (
              <li key={i} style={style}>
                {podium ? (
                  <span style={{ position:'absolute', left:0, top:0, bottom:0, width:6, background: podium.c, opacity:0.9 }} aria-hidden />
                ) : null}
                <span style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{opacity:0.75, fontWeight:700, minWidth:22, textAlign:'right'}}>{i+1}.</span>
                  <span style={{fontWeight: podium ? 700 : 600}}>{r.player?.name || r.player?.email || 'Player'}</span>
                  {medal ? <span aria-hidden role="img" style={{fontSize:18, lineHeight:1}}> {medal}</span> : null}
                </span>
                <span style={{fontWeight: podium ? 700 : 600}}>{r.total}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section style={{marginTop:30}}>
        <h2 style={{textAlign:"center"}}>Per-Game Top 10</h2>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16}}>
          {games.map(g => (
            <div key={g} style={{padding:12, background:"rgba(255,255,255,0.06)", borderRadius:12}}>
              <h4 style={{marginTop:0}}>{gameTitle(g)}</h4>
              <ul style={{listStyle:"none", padding:0, margin:0}}>
                {(() => {
                  const seen = new Set();
                  const dedup = [];
                  for (const row of (tops[g]||[])){
                    const key = row.player?._id || row.player?.email || row.player?.name || "anon";
                    if (seen.has(key)) continue;
                    seen.add(key);
                    dedup.push(row);
                    if (dedup.length >= 10) break;
                  }
                  return dedup.map((r,i)=> (
                    <li key={r._id||i} style={{display:"flex", justifyContent:"space-between", padding:"6px 8px"}}>
                      <span>{i+1}. {r.player?.name || 'Player'}</span>
                      <span>{r.score}</span>
                    </li>
                  ));
                })()}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
