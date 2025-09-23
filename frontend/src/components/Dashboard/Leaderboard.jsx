import React, { useEffect, useState } from "react";
import { api } from "../../services/api.js";

export default function Leaderboard({ game="bugSmasher" }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.topScores(game).then(setRows).catch(console.error); }, [game]);
  useEffect(() => {
    const refresh = () => { api.topScores(game).then(setRows).catch(console.error); };
    window.addEventListener('qa:score:refresh', refresh);
    return () => window.removeEventListener('qa:score:refresh', refresh);
  }, [game]);
  return (
    <div className="leaderboard" style={{maxWidth:800, margin:"30px auto"}}>
      <h2>🏆 Top {game}</h2>
      <ul className="leaderboard-list" style={{listStyle:"none", padding:0}}>
        {rows.map((r, i) => (
          <li key={r._id || i} className="leaderboard-item" style={{display:"flex", justifyContent:"space-between", padding:"10px 15px", margin:"8px 0", background:"rgba(255,255,255,0.1)", borderRadius:12}}>
            <span>{i+1}. {r.player?.name || "Player"}</span>
            <span>{r.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
