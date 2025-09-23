import mongoose from "mongoose";
import Tournament from "../models/Tournament.js";
import User from "../models/User.js";
import DailyTournament from "../models/DailyTournament.js";
import Score from "../models/Score.js";

function nextPowerOfTwo(n){
  let p=1; while(p<n) p<<=1; return p;
}

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

export async function adminCreateTournament(req, res){
  const { name, game, season } = req.body || {};
  if (!name || !game) return res.status(400).json({ error: "name and game required" });
  const t = await Tournament.create({ name, game, season, status: "upcoming", participants: [], rounds: [], currentRound: 0, bracketSize: 0, createdBy: req.user?.id || null });
  res.json(t);
}

export async function adminListTournaments(_req, res){
  const list = await Tournament.find({}).sort({ createdAt: -1 }).lean();
  res.json(list);
}

export async function adminGetTournament(req, res){
  const { id } = req.params;
  const t = await Tournament.findById(id)
    .populate({ path:'participants', select:'name email' })
    .populate({ path:'rounds.matches.p1', select:'name email' })
    .populate({ path:'rounds.matches.p2', select:'name email' })
    .populate({ path:'rounds.matches.winner', select:'name email' });
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
}

export async function adminSeedAndStart(req, res){
  const { id } = req.params;
  const { participantIds } = req.body || {};
  const t = await Tournament.findById(id);
  if (!t) return res.status(404).json({ error: 'not found' });
  if (t.status !== 'upcoming') return res.status(400).json({ error: 'tournament already started' });
  let ids = Array.isArray(participantIds) && participantIds.length ? participantIds : t.participants.map(x=>String(x));
  ids = ids.filter(Boolean);
  if (ids.length < 2) return res.status(400).json({ error: 'need at least 2 participants' });
  // expand to power of two with byes (nulls)
  const size = nextPowerOfTwo(ids.length);
  const byes = size - ids.length;
  const seeds = shuffle(ids.slice());
  for (let i=0;i<byes;i++) seeds.push(null);
  const matches = [];
  for (let i=0;i<size;i+=2){
    const p1 = seeds[i] ? new mongoose.Types.ObjectId(seeds[i]) : null;
    const p2 = seeds[i+1] ? new mongoose.Types.ObjectId(seeds[i+1]) : null;
    matches.push({ p1, p2, winner: p1 && !p2 ? p1 : (p2 && !p1 ? p2 : null), p1Score: 0, p2Score: 0 });
  }
  t.rounds = [{ matches }];
  t.bracketSize = size;
  t.currentRound = 0;
  t.status = 'running';
  await t.save();
  res.json(t);
}

export async function adminAddParticipants(req, res){
  const { id } = req.params;
  const { participantIds } = req.body || {};
  if (!Array.isArray(participantIds)) return res.status(400).json({ error:'participantIds array required' });
  const t = await Tournament.findById(id);
  if (!t) return res.status(404).json({ error:'not found' });
  if (t.status !== 'upcoming') return res.status(400).json({ error:'cannot add participants after start' });
  const set = new Set(t.participants.map(x=>String(x)));
  for (const pid of participantIds){ if (pid) set.add(String(pid)); }
  t.participants = Array.from(set).map(x=>new mongoose.Types.ObjectId(x));
  await t.save();
  res.json(t);
}

export async function userJoinTournament(req, res){
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error:'invalid id' });
  const t = await Tournament.findById(id);
  if (!t) return res.status(404).json({ error:'not found' });
  if (t.status !== 'upcoming') return res.status(400).json({ error:'tournament already started' });
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ error: 'auth required' });
  const exists = t.participants.some(x=>String(x)===String(uid));
  if (!exists) t.participants.push(uid);
  await t.save();
  res.json({ ok:true });
}

export async function getTournamentPublic(req, res){
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error:'invalid id' });
  const t = await Tournament.findById(id)
    .populate({ path:'participants', select:'name email' })
    .populate({ path:'rounds.matches.p1', select:'name email' })
    .populate({ path:'rounds.matches.p2', select:'name email' })
    .populate({ path:'rounds.matches.winner', select:'name email' })
    .lean();
  if (!t) return res.status(404).json({ error:'not found' });
  res.json(t);
}

export async function listPublicTournaments(_req, res){
  const list = await Tournament.find({ status: { $in: ['upcoming','running'] } }).sort({ createdAt: -1 }).select({ name:1, status:1, game:1 }).lean();
  res.json(list);
}

export async function adminReportMatch(req, res){
  const { id, roundIndex, matchIndex } = req.params;
  const { winnerId, p1Score, p2Score } = req.body || {};
  const t = await Tournament.findById(id);
  if (!t) return res.status(404).json({ error:'not found' });
  const rIdx = Number(roundIndex), mIdx = Number(matchIndex);
  if (!t.rounds[rIdx] || !t.rounds[rIdx].matches[mIdx]) return res.status(400).json({ error:'invalid match' });
  const m = t.rounds[rIdx].matches[mIdx];
  if (m.winner) return res.status(400).json({ error:'match already decided' });
  if (winnerId && ![String(m.p1), String(m.p2)].includes(String(winnerId))) return res.status(400).json({ error:'winner must be p1 or p2' });
  if (typeof p1Score === 'number') m.p1Score = p1Score;
  if (typeof p2Score === 'number') m.p2Score = p2Score;
  m.winner = winnerId ? new mongoose.Types.ObjectId(winnerId) : (m.p1Score===m.p2Score ? null : (m.p1Score>m.p2Score? m.p1 : m.p2));
  await t.save();
  res.json({ ok:true });
}

export async function adminAdvanceRound(req, res){
  const { id, roundIndex } = req.params;
  const t = await Tournament.findById(id);
  if (!t) return res.status(404).json({ error:'not found' });
  const rIdx = Number(roundIndex);
  const round = t.rounds[rIdx];
  if (!round) return res.status(400).json({ error:'invalid round' });
  // Ensure all matches decided
  if (round.matches.some(m=>!m.winner && m.p1 && m.p2)) return res.status(400).json({ error:'not all matches decided' });
  // Build next round winners (carry byes or auto-winners forward too)
  const winners = round.matches.map(m=> m.winner || m.p1 || m.p2).filter(Boolean);
  if (winners.length === 1){
    // tournament completed
    t.status = 'completed';
    t.currentRound = rIdx;
    t.results = { champion: winners[0] };
    await t.save();
    return res.json(t);
  }
  const nextMatches = [];
  for (let i=0;i<winners.length;i+=2){
    const p1 = winners[i] || null;
    const p2 = winners[i+1] || null;
    nextMatches.push({ p1, p2, winner:null, p1Score:0, p2Score:0 });
  }
  if (!t.rounds[rIdx+1]) t.rounds[rIdx+1] = { matches: [] };
  t.rounds[rIdx+1].matches = nextMatches;
  t.currentRound = rIdx+1;
  await t.save();
  res.json(t);
}

// ---- Daily Tournaments (two static per day) ----
function todayUtc(){ const d=new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
function fmtDate(d){ return d.toISOString().slice(0,10); }
function ymdToday(){ return fmtDate(todayUtc()); }
function ymdYesterday(){ const t=todayUtc(); t.setUTCDate(t.getUTCDate()-1); return fmtDate(t); }

const DAILY_DEFS = [
  { slug:'sprint', title:'Daily Sprint', game:'typeRacer' },
  { slug:'brain',  title:'Daily Brain',  game:'mathSprint' }
];

async function ensureTodayDaily(){
  const date = ymdToday();
  const found = await DailyTournament.find({ date }).lean();
  const missing = DAILY_DEFS.filter(d => !found.some(x => x.slug===d.slug));
  if (missing.length){
    for (const def of missing){
      await DailyTournament.create({ date, slug:def.slug, title:def.title, game:def.game, participants:[], locked:false, results:[] });
    }
  }
}

export async function getDailyTournaments(_req, res){
  await ensureTodayDaily();
  const list = await DailyTournament.find({ date: ymdToday() }).select({ date:1, slug:1, title:1, game:1, participants:1, locked:1 }).lean();
  res.json(list);
}

export async function joinDailyTournament(req, res){
  await ensureTodayDaily();
  const { slug } = req.params;
  const date = ymdToday();
  const dt = await DailyTournament.findOne({ date, slug });
  if (!dt) return res.status(404).json({ error:'not found' });
  if (dt.locked) return res.status(400).json({ error:'tournament locked for today' });
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ error:'auth required' });
  if (!dt.participants.some(x=>String(x)===String(uid))) dt.participants.push(uid);
  await dt.save();
  res.json({ ok:true });
}

export async function getDailyResults(req, res){
  const date = req.query.date || ymdYesterday(); // defaults to yesterday
  const list = await DailyTournament.find({ date }).select({ date:1, slug:1, title:1, game:1, participants:1 }).lean();
  // For each daily, compute top scores of that date range from Score collection
  // Map daily date (UTC) to day range in local Score timestamps; we use createdAt day in UTC
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  const results = [];
  for (const d of list){
    const participantIds = (d.participants||[]).map(x => new mongoose.Types.ObjectId(x));
    const top = await Score.aggregate([
      { $match: { game: d.game, createdAt: { $gte: start, $lte: end }, player: { $in: participantIds } } },
      { $sort: { score: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: 'player', foreignField: '_id', as: 'playerDoc' } },
      { $unwind: '$playerDoc' },
      { $project: { _id:0, user:'$player', name:'$playerDoc.name', email:'$playerDoc.email', score:1 } }
    ]);
    results.push({ date, slug:d.slug, title:d.title, game:d.game, top });
  }
  res.json(results);
}
