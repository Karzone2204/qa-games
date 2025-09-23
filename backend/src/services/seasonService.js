import Settings from "../models/Settings.js";

export function computeMonthSeason(date = new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

export async function getSeasonConfig(){
  let s = await Settings.findOne({ key: 'global' });
  if (!s) s = await Settings.create({ key:'global' });
  return s;
}

export async function getCurrentSeason(){
  const cfg = await getSeasonConfig();
  return cfg.currentSeasonOverride || computeMonthSeason();
}

export async function setCurrentSeason(season){
  const cfg = await getSeasonConfig();
  cfg.currentSeasonOverride = season || null;
  await cfg.save();
  return cfg;
}

export async function setAutoSeason(on){
  const cfg = await getSeasonConfig();
  cfg.autoSeason = !!on;
  await cfg.save();
  return cfg;
}

export async function setFeatureFlags({ enableQATools, enableChatbot }){
  const cfg = await getSeasonConfig();
  if (typeof enableQATools === 'boolean') cfg.enableQATools = enableQATools;
  if (typeof enableChatbot === 'boolean') cfg.enableChatbot = enableChatbot;
  await cfg.save();
  return cfg;
}
