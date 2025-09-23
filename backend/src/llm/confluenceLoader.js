import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
// switched to cheerio (loaded dynamically) for lower memory usage than jsdom

// Normalize and sanitize base URL:
// 1. Remove trailing '/home' if user pasted a landing page URL.
// 2. Remove trailing slash.
function sanitizeBaseUrl(raw){
  if (!raw) return 'https://innovationgroup.atlassian.net/wiki';
  let u = raw.trim();
  // Remove accidental REST fragments someone pasted into BASE_URL
  // Allowed forms: https://<site>/wiki or https://<site>/confluence (DC)
  u = u.replace(/\/rest(?:\/api)?\/?$/i, '');
  if (u.endsWith('/home')) u = u.slice(0, -5); // remove '/home'
  u = u.replace(/\/$/, '');
  return u;
}
const BASE_URL = sanitizeBaseUrl(process.env.CONFLUENCE_BASE_URL);
const DEBUG = /^(1|true|yes)$/i.test(process.env.CONFLUENCE_DEBUG || '');
const SCOPED = /^(1|true|yes)$/i.test(process.env.CONFLUENCE_SCOPED || '');
let cloudId = process.env.CONFLUENCE_CLOUD_ID || '';

async function ensureCloudId(){
  if (!SCOPED) return; // not needed
  if (cloudId) return; // already provided
  const url = `${BASE_URL.replace(/\/wiki$/,'')}/_edge/tenant_info`;
  try {
    const r = await fetch(url, { method: 'GET' });
    if (!r.ok) throw new Error(`tenant_info status ${r.status}`);
    const data = await r.json();
    if (!data.cloudId) throw new Error('tenant_info missing cloudId');
    cloudId = data.cloudId;
    if (DEBUG) console.log('[Confluence][DEBUG] Discovered cloudId', cloudId);
  } catch (e) {
    console.warn('[Confluence] Could not auto-discover cloudId:', e.message);
  }
}

function apiBase(){
  if (SCOPED && cloudId) return `https://api.atlassian.com/ex/confluence/${cloudId}/wiki`;
  // classic (unscoped) mode uses site BASE_URL
  return BASE_URL;
}
const API_EMAIL = process.env.CONFLUENCE_EMAIL; // service account email (Cloud Basic)
const API_TOKEN = process.env.CONFLUENCE_API_TOKEN; // Cloud API token (Basic)
const API_PAT   = process.env.CONFLUENCE_PAT; // Data Center/Server PAT (Bearer)
const ALLOW_PWSH = /^(1|true|yes)$/i.test(process.env.CONFLUENCE_ALLOW_PWSH || '');

const RAW_DIR = path.resolve(process.cwd(), 'data/confluence/raw');
const CLEAN_DIR = path.resolve(process.cwd(), 'data/confluence/clean');
const MANIFEST = path.resolve(process.cwd(), 'data/confluence/manifest.json');

async function ensureDirs() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(CLEAN_DIR, { recursive: true });
}

export async function loadPageList(explicitListFile = 'confluence-pages.json') {
  const file = path.resolve(process.cwd(), explicitListFile);
  const txt = await fs.readFile(file, 'utf8');
  return JSON.parse(txt);
}

async function fetchPage(id) {
  const url = `${apiBase()}/rest/api/content/${id}?expand=body.storage,version,metadata.labels`;
  if (DEBUG) console.log('[Confluence][DEBUG] Fetch page', id, 'URL=', url, 'SCOPED=', SCOPED, 'cloudId=', cloudId || '(none)');
  // Auth strategy: Prefer PAT (Bearer) if provided; else Basic with email:token
  let headers = { Accept: 'application/json' };
  if (API_PAT) {
    headers.Authorization = `Bearer ${API_PAT}`;
  } else if (API_EMAIL && API_TOKEN) {
    const auth = Buffer.from(`${API_EMAIL}:${API_TOKEN}`).toString('base64');
    headers.Authorization = `Basic ${auth}`;
  } else {
    throw new Error('Missing credentials: set CONFLUENCE_PAT (preferred for DC/Server) or CONFLUENCE_EMAIL + CONFLUENCE_API_TOKEN (Cloud).');
  }
  // If explicitly allowed, use PowerShell path first (corporate TLS/proxy friendly)
  if (ALLOW_PWSH) {
    const via = await fetchPageViaPwsh(url, headers).catch(e => { if (DEBUG) console.warn('[Confluence][DEBUG] pwsh fetch failed, falling back to node:', e.message); return null; });
    if (via) return via;
  }
  let r;
  try {
    r = await fetch(url, { headers });
  } catch (e) {
    // Final fallback to pwsh on network error if allowed
    if (!ALLOW_PWSH) throw new Error(`Network error fetching ${id}: ${e.message}`);
    const via = await fetchPageViaPwsh(url, headers).catch(err => { throw new Error(`Network error fetching ${id}: ${e.message}; pwsh fallback failed: ${err.message}`); });
    return via;
  }
  let bodyText = '';
  if (!r.ok) {
    try { bodyText = await r.text(); } catch { bodyText = ''; }
    const snippet = bodyText.slice(0, 300).replace(/\n/g, ' ');
    if (r.status === 401) {
      throw new Error(`Fetch failed id=${id} status=401 Unauthorized: Invalid credentials (Cloud Basic email/token or DC/Server PAT). bodySnippet="${snippet}"`);
    }
    if (r.status === 403) {
      throw new Error(`Fetch failed id=${id} status=403 Forbidden: Account lacks Confluence product access or global 'Can use Confluence' permission, or IP/policy restriction. bodySnippet="${snippet}"`);
    }
    throw new Error(`Fetch failed id=${id} status=${r.status} ${r.statusText} bodySnippet="${snippet}"`);
  }
  try {
    return await r.json();
  } catch (e) {
    throw new Error(`JSON parse failed for page ${id}: ${e.message}`);
  }
}

function buildPwshEncoded(script){
  return Buffer.from(script, 'utf16le').toString('base64');
}

async function fetchPageViaPwsh(url, authHeaders){
  const lines = [];
  lines.push("$ErrorActionPreference = 'Stop'");
  lines.push(`$url = \"${url.replace(/`/g,'``').replace(/"/g,'\"')}\"`);
  // Build headers in pwsh based on provided Authorization (Bearer or Basic)
  lines.push(`$headers = @{ Authorization = \"${authHeaders.Authorization}\"; Accept = 'application/json' }`);
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

async function htmlToText(html) {
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html, { decodeEntities: true });
  $('script,style,noscript').remove();
  // Code blocks -> fenced code
  $('pre,code').each((_, el) => {
    const t = $(el).text();
    // Use escaped backticks within template literal
    $(el).replaceWith(`\n\n\`\`\`\n${t}\n\`\`\`\n\n`);
  });
  // Tables -> pipe rows
  $('table').each((_, tbl) => {
    const lines = [];
    $(tbl).find('tr').each((__, tr) => {
      const cells = [];
      $(tr).children('th,td').each((___, td) => {
        cells.push($(td).text().trim().replace(/\s+/g, ' '));
      });
      if (cells.length) lines.push('| ' + cells.join(' | ') + ' |');
    });
    $(tbl).replaceWith('\n' + lines.join('\n') + '\n');
  });
  // Headings -> Markdown style
  for (let i = 1; i <= 6; i++) {
    $(`h${i}`).each((_, h) => {
      const t = $(h).text().trim();
      $(h).replaceWith(`\n${'#'.repeat(i)} ${t}\n`);
    });
  }
  let text = $.root().text();
  text = text.replace(/\r/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  return text;
}

async function readManifest() {
  try { return JSON.parse(await fs.readFile(MANIFEST,'utf8')); } catch { return { pages: {} }; }
}
async function writeManifest(m) { await fs.writeFile(MANIFEST, JSON.stringify(m,null,2),'utf8'); }

export async function fetchAndCleanPages(pageList) {
  await ensureDirs();
  await ensureCloudId();
  const manifest = await readManifest();
  const updated = [];
  let err401 = 0, err403 = 0;
  for (const p of pageList) {
    try {
      const raw = await fetchPage(p.id);
      const version = raw.version?.number || 0;
      const prevVersion = manifest.pages[p.id]?.version;
      if (prevVersion && prevVersion === version) continue; // no change
  const storage = raw.body?.storage?.value || '';
  const clean = await htmlToText(storage);
      await fs.writeFile(path.join(RAW_DIR, `${p.id}.json`), JSON.stringify(raw,null,2),'utf8');
      await fs.writeFile(path.join(CLEAN_DIR, `${p.id}.txt`), clean,'utf8');
      manifest.pages[p.id] = { version, title: raw.title, updated: new Date().toISOString() };
      updated.push({ id: p.id, title: raw.title, version, text: clean });
    } catch (e) {
      if (DEBUG) console.error('[Confluence][DEBUG] Full error object:', e);
      console.error('[Confluence] Page fetch error', p.id, e.message);
      if (/status=401/.test(e.message)) err401++;
      if (/status=403/.test(e.message)) err403++;
    }
  }
  await writeManifest(manifest);
  if (!updated.length && (err401 || err403)) {
    console.warn(`[Confluence] All pages failed (${err401}x401, ${err403}x403). 401 => bad email/token. 403 => missing product license/global permission or policy restriction. Ask a site admin to: (1) Grant Confluence product access to user ${API_EMAIL}, (2) Verify global 'Can use Confluence' permission, (3) Confirm no IP allowlist blocks this client.`);
  }
  return updated;
}

export function chunkDocument({ id, title, version, text }, { chunkSize=3000, overlap=300 } = {}) {
  const maxCharsEnv = Number(process.env.CONFLUENCE_MAX_CHARS_PER_PAGE || '500000');
  const MAX = isNaN(maxCharsEnv) || maxCharsEnv <= 0 ? 500000 : maxCharsEnv;
  if (text && text.length > MAX) {
    text = text.slice(0, MAX);
  }
  const chunks = [];
  let idx = 0;
  while (idx < text.length) {
    const end = Math.min(text.length, idx + chunkSize);
    const slice = text.slice(idx, end);
    chunks.push({
      pageContent: slice,
      metadata: {
        pageId: id,
        title,
        version,
        // Expose user-friendly site URL for metadata even if using scoped API endpoint
        url: `${BASE_URL}/spaces/${guessSpaceKeyFromUrl()}/pages/${id}`
      }
    });
    idx = end - overlap;
    if (idx < 0) idx = 0;
    if (idx >= end) idx = end; // safety
  }
  return chunks;
}

function guessSpaceKeyFromUrl(){
  // Placeholder; optionally derive per page later via additional expand if needed.
  return 'GGW';
}
