#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';

const BASE = (process.env.CONFLUENCE_BASE_URL || '').replace(/\/$/, '');
const EMAIL = process.env.CONFLUENCE_EMAIL || '';
const TOKEN = process.env.CONFLUENCE_API_TOKEN || '';
const ALLOW_PWSH = /^(1|true|yes)$/i.test(process.env.CONFLUENCE_ALLOW_PWSH || '');
const DEBUG = /^(1|true|yes)$/i.test(process.env.CONFLUENCE_DEBUG || '');

if (!BASE) {
  console.error('[ResolveIDs] Missing CONFLUENCE_BASE_URL');
  process.exit(1);
}
if (!EMAIL || !TOKEN) {
  console.error('[ResolveIDs] Missing CONFLUENCE_EMAIL or CONFLUENCE_API_TOKEN (Basic auth for Cloud)');
  process.exit(1);
}

const basic = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

function buildPwshEncoded(script){
  return Buffer.from(script, 'utf16le').toString('base64');
}

async function searchByTitleNode(title){
  const url = `${BASE}/rest/api/search?cql=title~"${encodeURIComponent(title)}"&limit=5`;
  const r = await fetch(url, { headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return await r.json();
}

async function searchByTitlePwsh(title){
  const urlRaw = `${BASE}/rest/api/search?cql=title~"${title.replace(/`/g,'``').replace(/"/g,'\"')}"&limit=5`;
  const lines = [];
  lines.push("$ErrorActionPreference = 'Stop'");
  lines.push(`$url = \"${urlRaw}\"`);
  lines.push(`$basic = \"${basic}\"`);
  lines.push("$headers = @{ Authorization = \"Basic $basic\"; Accept = 'application/json' }");
  lines.push("$params = @{ Method = 'Get'; Uri = $url; Headers = $headers }");
  lines.push("if ($env:CONFLUENCE_PROXY) { $params['Proxy'] = $env:CONFLUENCE_PROXY }");
  lines.push("if ($env:CONFLUENCE_INSECURE -match '^(1|true|yes)$') { $params['SkipCertificateCheck'] = $true }");
  lines.push("$res = Invoke-RestMethod @params");
  lines.push("$res | ConvertTo-Json -Depth 10");
  const script = lines.join('; ');
  const encoded = buildPwshEncoded(script);
  return new Promise((resolve, reject) => {
    execFile('pwsh', ['-NoProfile','-EncodedCommand', encoded], { timeout: 45000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.trim() || err.message));
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(new Error(`pwsh JSON parse failed: ${e.message}`)); }
    });
  });
}

function normalizeTitle(s){ return String(s || '').trim().replace(/\s+/g,' ').toLowerCase(); }

async function resolveIdForTitle(title){
  let data;
  try {
    data = await searchByTitleNode(title);
  } catch (e) {
    if (!ALLOW_PWSH) throw e;
    if (DEBUG) console.warn('[ResolveIDs][DEBUG] Node fetch failed, trying pwsh:', e.message);
    data = await searchByTitlePwsh(title);
  }
  const results = Array.isArray(data?.results) ? data.results : [];
  if (!results.length) return null;
  const want = normalizeTitle(title);
  // Prefer exact normalized title match
  const exact = results.find(r => normalizeTitle(r.title || r.content?.title) === want);
  const pick = exact || results[0];
  const id = pick?.content?.id || pick?.id || null;
  const foundTitle = pick?.title || pick?.content?.title || null;
  return id ? { id: String(id), title: foundTitle } : null;
}

async function main(){
  const file = path.resolve(process.cwd(), 'confluence-pages.json');
  const raw = await fs.readFile(file, 'utf8');
  const list = JSON.parse(raw);
  let changed = 0; let missing = 0;
  for (let i=0;i<list.length;i++){
    const entry = list[i];
    const title = entry.title || '';
    if (!title) continue;
    try {
      const res = await resolveIdForTitle(title);
      if (!res){ missing++; console.warn(`[ResolveIDs] Not found: ${title}`); continue; }
      if (String(entry.id) !== String(res.id)){
        if (DEBUG) console.log(`[ResolveIDs] ${title}: ${entry.id || '(none)'} -> ${res.id}`);
        entry.id = res.id;
        changed++;
      }
      // Ensure title reflects the actual page title
      if (res.title && res.title !== entry.title){ entry.title = res.title; }
    } catch (e) {
      console.warn(`[ResolveIDs] Error resolving "${title}":`, e.message);
    }
  }
  await fs.writeFile(file, JSON.stringify(list, null, 2), 'utf8');
  console.log(`[ResolveIDs] Done. Updated IDs: ${changed}. Missing: ${missing}.`);
}

main().catch(e => { console.error('[ResolveIDs] Fatal:', e.message); process.exit(1); });
