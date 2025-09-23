#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { execFile } from 'node:child_process';

const BASE = (process.env.CONFLUENCE_BASE_URL || '').replace(/\/$/,'');
const EMAIL = process.env.CONFLUENCE_EMAIL;
const TOKEN = process.env.CONFLUENCE_API_TOKEN;
const ALLOW_PWSH = /^(1|true|yes)$/i.test(process.env.CONFLUENCE_ALLOW_PWSH || '');

function die(msg){ console.error(msg); process.exit(1); }

if (!BASE || !EMAIL || !TOKEN) die('Missing CONFLUENCE_BASE_URL / EMAIL / API_TOKEN');
const title = process.argv.slice(2).join(' ');
if (!title) die('Usage: npm run confluence:find -- "Page Title"');

const basic = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

async function fetchNode(){
  const url = `${BASE}/rest/api/search?cql=title~\"${encodeURIComponent(title)}\"&limit=5`;
  const r = await fetch(url, { headers: { Authorization: `Basic ${basic}`, Accept:'application/json' } });
  if (!r.ok) die(`HTTP ${r.status}`);
  const j = await r.json();
  console.log(JSON.stringify(j,null,2));
}

function buildPwshEncoded(script){ return Buffer.from(script, 'utf16le').toString('base64'); }
function fetchPwsh(){
  const url = `${BASE}/rest/api/search?cql=title~\"${title.replace(/`/g,'``').replace(/"/g,'\"')}\"&limit=5`;
  const lines = [];
  lines.push("$ErrorActionPreference = 'Stop'");
  lines.push(`$url = \"${url}\"`);
  lines.push(`$basic = \"${basic}\"`);
  lines.push("$headers = @{ Authorization = \"Basic $basic\"; Accept = 'application/json' }");
  lines.push("$params = @{ Method = 'Get'; Uri = $url; Headers = $headers }");
  lines.push("if ($env:CONFLUENCE_PROXY) { $params['Proxy'] = $env:CONFLUENCE_PROXY }");
  lines.push("if ($env:CONFLUENCE_INSECURE -match '^(1|true|yes)$') { $params['SkipCertificateCheck'] = $true }");
  lines.push("$res = Invoke-RestMethod @params");
  lines.push("$res | ConvertTo-Json -Depth 10");
  const script = lines.join('; ');
  const encoded = buildPwshEncoded(script);
  execFile('pwsh', ['-NoProfile','-EncodedCommand', encoded], { timeout: 45000 }, (err, stdout, stderr) => {
    if (err) die(stderr?.trim() || err.message);
    console.log(stdout);
  });
}

if (ALLOW_PWSH) fetchPwsh(); else fetchNode();
