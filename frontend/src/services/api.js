const RAW = import.meta.env.VITE_API_BASE || "";
const BASE = RAW.replace(/\/+$/, "");   // no trailing slash

if (!BASE) {
  console.error("VITE_API_BASE is not set. Example: http://localhost:4000 or https://api.yourdomain.com");
}

function token(){ return localStorage.getItem("token") || sessionStorage.getItem("token"); }
function setToken(t){ localStorage.setItem("token", t); }

export const api = {
  async signup(email, name, password, inviteCode){
    const r = await fetch(`${BASE}/auth/signup`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, name, password, inviteCode })
    });
    return handle(r);
  },
  async login(email, password){
    const r = await fetch(`${BASE}/auth/login`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ email, password })
    });
    return handle(r);
  },
  async topScores(game, season){
    const params = new URLSearchParams();
    if (game) params.set('game', game);
    if (season) params.set('season', season);
    const r = await fetch(`${BASE}/scores?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    return handle(r);
  },
  async submitScore(game, score, season){
    const r = await fetch(`${BASE}/scores`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ game, score, season })
    });
    const data = await handle(r);
    if (!data?.error) {
      try {
        window.dispatchEvent(new CustomEvent('qa:score:new', { detail: { game, score, season } }));
      } catch {}
    }
    return data;
  },
  async overall(season){
    const params = new URLSearchParams();
    if (season) params.set('season', season);
    const r = await fetch(`${BASE}/scores/overall?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    return handle(r);
  },
  async achievements(season){
    const params = new URLSearchParams();
    if (season) params.set('season', season);
    const r = await fetch(`${BASE}/scores/achievements?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    return handle(r);
  },
  async myAchievements(season){
    const params = new URLSearchParams();
    if (season) params.set('season', season);
    const r = await fetch(`${BASE}/scores/my-achievements?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    return handle(r);
  },
  // Admin
  async adminGetSeason(){
    const r = await fetch(`${BASE}/api/admin/season`, { headers: { Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async adminSetAuto(auto){
    const r = await fetch(`${BASE}/api/admin/season/auto`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ auto })
    });
    return handle(r);
  },
  async adminNewSeason(season){
    const r = await fetch(`${BASE}/api/admin/season/new`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(season ? { season } : {})
    });
    return handle(r);
  },
  async adminResetSeason(season){
    const r = await fetch(`${BASE}/api/admin/season/reset`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}`, ...(season==="__ALL__"? { 'x-confirm-reset-all': 'yes' } : {}) },
      body: JSON.stringify(season ? { season } : {})
    });
    return handle(r);
  },
  async adminGetFeatures(){
    const r = await fetch(`${BASE}/api/admin/features`, { headers: { Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async adminSetFeatures(flags){
    const r = await fetch(`${BASE}/api/admin/features`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(flags || {})
    });
    return handle(r);
  },
  async adminGetAuthSettings(){
    const r = await fetch(`${BASE}/api/admin/auth-settings`, { headers: { Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async adminSetAuthSettings(body){
    const r = await fetch(`${BASE}/api/admin/auth-settings`, {
      method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body||{})
    });
    return handle(r);
  },
  async adminListUsers(){
    const r = await fetch(`${BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async adminToggleUserActive(id, active){
    const r = await fetch(`${BASE}/api/admin/users/active`, {
      method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ id, active })
    });
    return handle(r);
  },
  async adminDeleteUser(id){
    const r = await fetch(`${BASE}/api/admin/users/${id}`, { method:'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async adminResendVerify(id){
    const r = await fetch(`${BASE}/api/admin/users/resend-verify`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ id }) });
    return handle(r);
  },
  async getLinks(env) {
    const u = env ? `${BASE}/tools/links?env=${encodeURIComponent(env)}` : `${BASE}/tools/links`;
    const r = await fetch(u, { 
      headers: { Authorization: `Bearer ${token()}` }
    });
    return handle(r);
  },
  async createLink(body) {
    const r = await fetch(`${BASE}/tools/links`, {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(body)
    });
    return handle(r);
  },
  async updateLink(id, body) {
    const r = await fetch(`${BASE}/tools/links/${id}`, {
      method: "PUT",
      headers: { "Content-Type":"application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(body)
    });
    return handle(r);
  },
  async deleteLink(id) {
    const r = await fetch(`${BASE}/tools/links/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` }
    });
    return handle(r);
  },
  // Tournaments
  async adminCreateTournament(body){
    const r = await fetch(`${BASE}/api/admin/tournaments`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body||{}) });
    return handle(r);
  },
  async adminListTournaments(){
    const r = await fetch(`${BASE}/api/admin/tournaments`, { headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async adminGetTournament(id){
    const r = await fetch(`${BASE}/api/admin/tournaments/${id}`, { headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async adminAddParticipants(id, participantIds){
    const r = await fetch(`${BASE}/api/admin/tournaments/${id}/participants`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ participantIds }) });
    return handle(r);
  },
  async adminStartTournament(id, participantIds){
    const r = await fetch(`${BASE}/api/admin/tournaments/${id}/start`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(participantIds? { participantIds } : {}) });
    return handle(r);
  },
  async adminReportMatch(id, roundIndex, matchIndex, payload){
    const r = await fetch(`${BASE}/api/admin/tournaments/${id}/rounds/${roundIndex}/matches/${matchIndex}`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(payload||{}) });
    return handle(r);
  },
  async adminAdvanceRound(id, roundIndex){
    const r = await fetch(`${BASE}/api/admin/tournaments/${id}/rounds/${roundIndex}/advance`, { method:'POST', headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async tournamentsGet(id){
    const r = await fetch(`${BASE}/api/tournaments/${id}`, { headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async tournamentsList(){
    const r = await fetch(`${BASE}/api/tournaments`, { headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async tournamentsJoin(id){
    const r = await fetch(`${BASE}/api/tournaments/${id}/join`, { method:'POST', headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  // Daily tournaments
  async tournamentsDaily(){
    const r = await fetch(`${BASE}/api/tournaments/daily`, { headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async tournamentsDailyJoin(slug){
    const r = await fetch(`${BASE}/api/tournaments/daily/${encodeURIComponent(slug)}/join`, { method:'POST', headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async tournamentsDailyResults(date){
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const r = await fetch(`${BASE}/api/tournaments/daily/results${qs}`, { headers:{ Authorization: `Bearer ${token()}` } });
    return handle(r);
  },
  async authForgot(email){
    const r = await fetch(`${BASE}/auth/forgot`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email })
    });
    return handle(r);
  },
  async authVerify(email, token){
    const r = await fetch(`${BASE}/auth/verify`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, token })
    });
    return handle(r);
  },
  async authReset(email, token, newPassword){
    const r = await fetch(`${BASE}/auth/reset`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, token, newPassword })
    });
    return handle(r);
  }
};

async function handle(res){
  // If the request was blocked (CORS/mixed-content), fetch throws before here.
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.token) setToken(data.token);
  if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
  return data;
}
