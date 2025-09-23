import mongoose from "mongoose";
import { getSeasonConfig, setCurrentSeason, setAutoSeason, computeMonthSeason, setFeatureFlags } from "../services/seasonService.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";
import { sendMail } from "../services/mailer.js";
import Score from "../models/Score.js";

let seasons = [{ number: 1, week: 1 }];
let tournaments = [];

export async function getSeason(req, res){
  const cfg = await getSeasonConfig();
  res.json({
    autoSeason: cfg.autoSeason,
    currentSeason: cfg.currentSeasonOverride || computeMonthSeason(),
    override: cfg.currentSeasonOverride,
    enableQATools: !!cfg.enableQATools,
    enableChatbot: !!cfg.enableChatbot,
  });
}

export async function newSeason(req, res){
  const { season } = req.body; // optional explicit season string
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  const next = season || computeMonthSeason(d);
  const cfg = await setCurrentSeason(next);
  res.json({ ok:true, currentSeason: cfg.currentSeasonOverride });
}

export async function setWeek(req,res){
  const { week } = req.body;
  seasons[0].week = Number(week) || 1;
  res.json(seasons[0]);
}

export async function setSeasonAuto(req,res){
  const { auto } = req.body;
  const cfg = await setAutoSeason(!!auto);
  res.json({ ok:true, autoSeason: cfg.autoSeason });
}

export async function resetSeasonScores(req,res){
  const { season } = req.body; // if omitted, use current effective season
  const target = season || computeMonthSeason();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database not connected" });
  }
  if (target === "__ALL__"){
    // Triple-check: require a special header confirmation as well
    const hdr = req.headers["x-confirm-reset-all"];
    if (hdr !== "yes") return res.status(400).json({ error: "Missing x-confirm-reset-all=yes" });
    const result = await Score.deleteMany({});
    return res.json({ ok:true, deleted: result.deletedCount, season: "ALL" });
  }
  const result = await Score.deleteMany({ season: target });
  res.json({ ok:true, deleted: result.deletedCount, season: target });
}

export function createTournament(req,res){
  const { name, game } = req.body;
  const t = { id: String(Date.now()), name, game, status: "upcoming", participants: [] };
  tournaments.push(t);
  res.json(t);
}
export function listTournaments(req,res){ res.json(tournaments); }

export async function getFeatures(req, res){
  const cfg = await getSeasonConfig();
  res.json({ enableQATools: !!cfg.enableQATools, enableChatbot: !!cfg.enableChatbot });
}

export async function setFeatures(req, res){
  const { enableQATools, enableChatbot } = req.body || {};
  const cfg = await setFeatureFlags({ enableQATools, enableChatbot });
  res.json({ ok: true, enableQATools: !!cfg.enableQATools, enableChatbot: !!cfg.enableChatbot });
}

// ---- Auth Settings ----
export async function getAuthSettings(_req, res){
  const cfg = await getSeasonConfig();
  res.json({ emailVerifyOnSignup: !!cfg.emailVerifyOnSignup });
}

export async function setAuthSettings(req, res){
  const { emailVerifyOnSignup } = req.body || {};
  const cfg = await Settings.findOne({ key:'global' }) || await Settings.create({ key:'global' });
  if (typeof emailVerifyOnSignup === 'boolean') cfg.emailVerifyOnSignup = emailVerifyOnSignup;
  await cfg.save();
  res.json({ ok:true, emailVerifyOnSignup: !!cfg.emailVerifyOnSignup });
}

// ---- User Management ----
export async function listUsers(_req, res){
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean();
  res.json(users);
}

export async function toggleUserActive(req, res){
  const { id, active } = req.body || {};
  if (!id || typeof active !== 'boolean') return res.status(400).json({ error:'id and active required' });
  const u = await User.findById(id);
  if (!u) return res.status(404).json({ error:'not found' });
  u.active = active;
  await u.save();
  res.json({ ok:true });
}

export async function deleteUser(req, res){
  const { id } = req.params;
  if (!id) return res.status(400).json({ error:'id required' });
  const r = await User.deleteOne({ _id:id });
  res.json({ ok:true, deleted: r.deletedCount });
}

export async function resendVerification(req, res){
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error:'id required' });
  const u = await User.findById(id);
  if (!u) return res.status(404).json({ error:'not found' });
  const token = (Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)).slice(0,48);
  u.verifyToken = token; u.verifyTokenExp = new Date(Date.now()+1000*60*60*24);
  await u.save();
  const base = process.env.APP_BASE_URL || 'http://localhost:5173';
  const url = `${base}/?verifyToken=${token}&email=${encodeURIComponent(u.email)}`;
  await sendMail({ to: u.email, subject:'Verify your email', text:`Verify: ${url}`, html:`<a href="${url}">${url}</a>` }).catch(()=>({}));
  res.json({ ok:true });
}
