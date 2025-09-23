import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api.js';
import { toast } from '../../services/toast.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function TournamentView(){
  const { user } = useAuth();
  const [daily, setDaily] = useState([]);
  const [yesterday, setYesterday] = useState([]);

  async function refresh(){
    const a = await api.tournamentsDaily(); if (!a?.error) setDaily(a);
    const b = await api.tournamentsDailyResults(); if (!b?.error) setYesterday(b);
  }

  useEffect(() => { refresh(); }, []);

  async function join(slug){
    try {
      const r = await api.tournamentsDailyJoin(slug);
      if (r?.error) toast.error(r.error); else { toast.success('Joined'); refresh(); }
    } catch (e) {
      toast.error(`Join failed: ${e?.message || 'network error'}`);
    }
  }

  const map = useMemo(() => Object.fromEntries((daily||[]).map(d=>[d.slug, d])), [daily]);

  const GAME_META = {
    typeRacer: { label: 'Type Racer', icon: '⌨️' },
    mathSprint: { label: 'Math Sprint', icon: '🧮' }
  };

  const Card = ({ slug, title, game }) => {
    const d = map[slug] || {};
    const participants = Array.isArray(d.participants) ? d.participants : [];
    const count = participants.length;
    const locked = !!d.locked;
    const already = !!(user?.id && participants.some(p => String(p) === String(user.id)));
    const meta = GAME_META[game] || { label: game, icon: '🎮' };
    return (
      <div className="match-card" style={{minWidth:260}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontWeight:700}}>{title}</div>
          <div style={{display:'flex', alignItems:'center', gap:6, opacity:.9}}>
            <span style={{fontSize:18}}>{meta.icon}</span>
            <span>{meta.label}</span>
          </div>
        </div>
        <div className="player-slot" style={{marginTop:8}}>
          <span>Players joined</span>
          <span>{count}</span>
        </div>
        <div style={{display:'flex', gap:8, marginTop:8}}>
          <button disabled={locked || already} onClick={()=>join(slug)}>{locked ? 'Locked' : (already ? 'Joined' : 'Join')}</button>
          <button onClick={()=>{
            const map = { typeRacer:'typeRacer', mathSprint:'mathSprint' };
            const sel = map[game];
            if (sel){
              window.dispatchEvent(new CustomEvent('qa:navigate:game', { detail: { game: sel } }));
            }
          }}>Play</button>
        </div>
        {already && user?.name && (
          <div style={{marginTop:6, fontSize:12, opacity:.85}}>Joined as {user.name}</div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ textAlign: 'center', color: '#ffd700' }}>🏆 Daily Tournaments</h2>
      <div className="tournament-bracket" style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
        <Card slug="sprint" title="Daily Sprint" game="typeRacer" />
        <Card slug="brain" title="Daily Brain" game="mathSprint" />
      </div>
      <h3 style={{ textAlign:'center', marginTop:16 }}>Yesterday's Winners</h3>
      <div className="tournament-bracket">
        {(!yesterday || yesterday.length===0) && <div style={{textAlign:'center', opacity:.8}}>No results yet.</div>}
        {(yesterday||[]).map(g => (
          <div key={g.slug} className="tournament-round">
            <div className="match-card" style={{minWidth:280}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                <div style={{fontWeight:700}}>{g.title}</div>
                <div style={{display:'flex', alignItems:'center', gap:6, opacity:.9}}>
                  <span style={{fontSize:18}}>{(GAME_META[g.game]?.icon) || '🎮'}</span>
                  <span>{(GAME_META[g.game]?.label) || g.game}</span>
                </div>
              </div>
              {(g.top||[]).slice(0,3).map((t,i)=> (
                <div key={i} className={`player-slot ${i===0?'winner':''}`}>
                  <span>{i===0?'🥇':i===1?'🥈':i===2?'🥉':''} {t.name}</span>
                  <span>{t.score}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
