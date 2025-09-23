import Score from "../models/Score.js";
import mongoose from "mongoose";
import { getCurrentSeason } from "../services/seasonService.js";

export async function submitScore(req, res) {
  const { game, score, season } = req.body;
  if (!game || typeof score !== "number") return res.status(400).json({ error: "Invalid payload" });
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database not connected", hint: "Set MONGODB_URI or set SKIP_DB=1 to disable score persistence." });
  }
  const useSeason = season || await getCurrentSeason();
  const doc = await Score.create({ player: req.user.id, game, score, season: useSeason });
  res.json({ ok: true, id: doc._id });
}
export async function topScores(req, res) {
  const { game, season } = req.query;
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database not connected", hint: "Set MONGODB_URI or set SKIP_DB=1 to disable score persistence." });
  }
  const q = game ? { game } : {};
  if (season) q.season = season;
  const rows = await Score.find(q).sort({ score: -1 }).limit(20).populate("player","name email role");
  res.json(rows);
}

export async function overallLeaderboard(req, res){
  const { season } = req.query;
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database not connected", hint: "Set MONGODB_URI or set SKIP_DB=1 to disable score persistence." });
  }
  const match = season ? { season } : {};
  const agg = await Score.aggregate([
    { $match: match },
    { $group: { _id: "$player", total: { $sum: "$score" } } },
    { $sort: { total: -1 } },
    { $limit: 20 },
  ]);
  // populate player names
  const ids = agg.map(a=>a._id);
  const users = await mongoose.model('User').find({ _id: { $in: ids } }, 'name email');
  const map = new Map(users.map(u=>[String(u._id), u]));
  const rows = agg.map(a=>({ player: map.get(String(a._id)), total: a.total }));
  res.json(rows);
}

export async function achievements(req, res){
  const { season } = req.query;
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database not connected", hint: "Set MONGODB_URI or set SKIP_DB=1 to disable score persistence." });
  }
  const match = season ? { season } : {};
  // Top 1 per game for the season
  const perGameTop = await Score.aggregate([
    { $match: match },
    { $sort: { game: 1, score: -1 } },
    { $group: { _id: "$game", top: { $first: { player: "$player", score: "$score" } } } },
  ]);
  // Personal best breakers this season (latest score is top for that player+game)
  const personalBests = await Score.aggregate([
    { $match: match },
    { $sort: { player: 1, game: 1, score: -1, createdAt: -1 } },
    { $group: { _id: { player: "$player", game: "$game" }, best: { $first: "$score" } } },
    { $sort: { best: -1 } },
    { $limit: 50 }
  ]);
  // Map players for display
  const playerIds = [
    ...perGameTop.map(x=>x.top.player),
    ...personalBests.map(x=>x._id.player)
  ];
  const uniq = Array.from(new Set(playerIds.map(String)));
  const users = await mongoose.model('User').find({ _id: { $in: uniq } }, 'name email');
  const userMap = new Map(users.map(u=>[String(u._id), u]));

  const topByGame = perGameTop.map(x=>({ game: x._id, player: userMap.get(String(x.top.player)), score: x.top.score }));
  const bests = personalBests.map(x=>({ game: x._id.game, player: userMap.get(String(x._id.player)), score: x.best }));
  res.json({ topByGame, personalBests: bests });
}

// Return the current user's season-scoped achievements with lock/progress
export async function myAchievements(req, res){
  const season = req.query.season;
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database not connected", hint: "Set MONGODB_URI or set SKIP_DB=1 to disable score persistence." });
  }
  const useSeason = season || await getCurrentSeason();
  const me = req.user.id;
  // Aggregate per-game stats for this user and season
  const rows = await Score.aggregate([
    { $match: { player: new mongoose.Types.ObjectId(me), season: useSeason } },
    { $group: { _id: "$game", played: { $sum: 1 }, best: { $max: "$score" }, total: { $sum: "$score" } } }
  ]);
  const stats = new Map(rows.map(r => [r._id, r]));

  // Compute a simple daily play streak within the season
  const plays = await Score.aggregate([
    { $match: { player: new mongoose.Types.ObjectId(me), season: useSeason } },
    { $project: { day: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } } } },
    { $group: { _id: "$day" } },
    { $project: { _id: 0, day: "$\_id" } },
    { $sort: { day: 1 } }
  ]);
  // longest consecutive day streak helper
  function longestConsecutiveDayStreak(days){
    if (!days || !days.length) return 0;
    const toDate = (s) => new Date(s+"T00:00:00Z");
    let longest = 1, cur = 1;
    for (let i=1;i<days.length;i++){
      const prev = toDate(days[i-1]).getTime();
      const now  = toDate(days[i]).getTime();
      const diff = (now - prev) / (24*3600*1000);
      if (diff === 1) { cur += 1; longest = Math.max(longest, cur); }
      else if (diff === 0) { /* same day (shouldn't happen post group) */ }
      else { cur = 1; }
    }
    return longest;
  }
  const distinctDays = plays.map(p => p.day);
  const dayStreak = longestConsecutiveDayStreak(distinctDays);
  // Define a richer set of achievements
  const defs = [
    {
      id: "bug_destroyer",
      game: "bugSmasher",
      title: "Bug Destroyer",
      desc: "Smash 100 bugs",
      // Refined: score awards ~10 base plus streak bonus; assume avg ~12/bug
      target: 100,
      progress: (s) => Math.floor((s?.total || 0) / 12),
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "bug_destroyer_pro",
      game: "bugSmasher",
      title: "Bug Exterminator",
      desc: "Smash 300 bugs",
      target: 300,
      progress: (s) => Math.floor((s?.total || 0) / 12),
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "memory_master",
      game: "memory",
      title: "Memory Master",
      desc: "Win a game",
      target: 1,
      // Memory only submits on win → each score counts as a win
      progress: (s) => (s?.played || 0),
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "memory_grandmaster",
      game: "memory",
      title: "Memory Grandmaster",
      desc: "Win 5 games",
      target: 5,
      progress: (s) => (s?.played || 0),
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "zip_sprinter",
      game: "zip",
      title: "Zip Sprinter",
      desc: "Finish a level in under 40s",
      target: 1,
      // zip score = 100 - secs, so under 40s => score > 60
      progress: (s) => (s?.best || 0) > 60 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "zip_lightning",
      game: "zip",
      title: "Zip Lightning",
      desc: "Finish a level in under 25s",
      target: 1,
      // under 25s => score > 75
      progress: (s) => (s?.best || 0) > 75 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "sudoku_solver",
      game: "sudoku",
      title: "Sudoku Solver",
      desc: "Complete one Sudoku",
      target: 1,
      progress: (s) => (s?.played || 0) > 0 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "sudoku_grandmaster",
      game: "sudoku",
      title: "Sudoku Grandmaster",
      desc: "Complete 3 Sudokus",
      target: 3,
      progress: (s) => (s?.played || 0),
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "mini_sudoku_streak",
      game: "miniSudoku",
      title: "Mini Sudoku Streak",
      desc: "Complete 3 mini sudokus",
      target: 3,
      progress: (s) => (s?.played || 0),
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "mini_sudoku_ace",
      game: "miniSudoku",
      title: "Mini Sudoku Ace",
      desc: "Complete 6 mini sudokus",
      target: 6,
      progress: (s) => (s?.played || 0),
      locked: (s) => !(s && s.played > 0)
    },
    // Train the Brain (visual memory): reach 500 points
    {
      id: "brain_train_pro",
      game: "trainBrain",
      title: "Brain Train Pro",
      desc: "Score 500+ in Train The Brain",
      target: 1,
      progress: (s) => (s?.best || 0) >= 500 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "brain_train_elite",
      game: "trainBrain",
      title: "Brain Train Elite",
      desc: "Score 1000+ in Train The Brain",
      target: 1,
      progress: (s) => (s?.best || 0) >= 1000 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "math_marathon",
      game: "mathSprint",
      title: "Math Marathon",
      desc: "Reach 500 points in a run",
      target: 1,
      progress: (s) => (s?.best || 0) >= 500 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "math_ultra",
      game: "mathSprint",
      title: "Math Ultra",
      desc: "Reach 1000 points in a run",
      target: 1,
      progress: (s) => (s?.best || 0) >= 1000 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "type_turbo",
      game: "typeRacer",
      title: "Type Turbo",
      desc: "Hit 60 WPM",
      target: 1,
      progress: (s) => (s?.best || 0) >= 60 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "type_maniac",
      game: "typeRacer",
      title: "Type Maniac",
      desc: "Hit 90 WPM",
      target: 1,
      progress: (s) => (s?.best || 0) >= 90 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "rps_champion",
      game: "rps",
      title: "RPS Champion",
      desc: "Score 150+ vs bot",
      target: 1,
      progress: (s) => (s?.best || 0) >= 150 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    {
      id: "rps_legend",
      game: "rps",
      title: "RPS Legend",
      desc: "Score 250+ vs bot",
      target: 1,
      progress: (s) => (s?.best || 0) >= 250 ? 1 : 0,
      locked: (s) => !(s && s.played > 0)
    },
    // On-fire: 10 days in a row with at least one play
    {
      id: "on_fire_10",
      game: "any",
      title: "On Fire 🔥",
      desc: "Play 10 days in a row this season",
      target: 10,
      progress: () => dayStreak,
      locked: () => distinctDays.length === 0
    }
    ,{
      id: "on_fire_20",
      game: "any",
      title: "Blazing Streak 🔥",
      desc: "Play 20 days in a row this season",
      target: 20,
      progress: () => dayStreak,
      locked: () => distinctDays.length === 0
    }
  ];
  const items = defs.map(d => {
    const s = stats.get(d.game);
    const prog = d.progress(s);
    const clamped = Math.max(0, Math.min(d.target, prog));
    const complete = clamped >= d.target && !d.locked(s);
    return {
      id: d.id,
      game: d.game,
      title: d.title,
      description: d.desc,
      locked: d.locked(s),
      progress: clamped,
      target: d.target,
      complete
    };
  });
  const badges = items.filter(x => x.complete).length;
  res.json({ season: useSeason, badges, totalBadges: items.length, items });
}
