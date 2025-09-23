import crypto from 'crypto';
import fetch from 'node-fetch';
import https from 'https';
import os from 'os';
import path from 'path';
import fsPromises from 'fs/promises';
import fs from 'fs';
import { ENVIRONMENTS, REQUEST_TYPE_BUILDERS, TEMPLATES, FEEDS, FEED_CREDENTIAL_OVERRIDES } from '../config/dataGenConfig.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

function randomSuffix(){
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomAlphaNum(len = 10){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let out = '';
  for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function randomVIN(){
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'; // exclude I,O,Q
  let vin = '';
  for(let i=0;i<17;i++) vin += chars[Math.floor(Math.random()*chars.length)];
  return vin;
}

function randomVRN(){
  return `VRN-${randomAlphaNum(3)}-${randomAlphaNum(4)}`;
}

function buildContext(envKey){
  const nowId = Date.now();
  return {
    orderExternalRef: `EXT_REF_ORDER_${randomSuffix()}`,
    policyHolderExternalRef: `EXT_REF_POLICY_${randomSuffix()}`,
    licenceExternalRef: `EXT_REF_LICENCE_${randomSuffix()}`,
    vehicleExternalRef: `EXT_REF_VEHICLE_${randomSuffix()}`,
    fileExternalRefs: [1,2,3].map(i=>`EXT_REF_FILE_${randomSuffix()}${i}`),
    policyNumber: `P-${nowId}`,
    vin: crypto.randomBytes(8).toString('hex').toUpperCase(),
    vrn: `VRN${randomSuffix().slice(0,4)}`,
  firstName: `Auto${randomAlphaNum(4)}`,
  lastName: `User${randomAlphaNum(5)}`,
    email: `auto_${nowId}@example.test`,
    phoneNumber: `07${Math.floor(100000000 + Math.random()*900000000)}`,
    ...ENVIRONMENTS[envKey]
  };
}

const tokenCache = new Map(); // envKey -> { token, exp }

export async function getBearerToken(envKey, scopeOverride, feedKey){
  const env = ENVIRONMENTS[envKey];
  if(!env) throw new Error('Unknown environment');
  const cacheKey = `${envKey}:${feedKey||'default'}`;
  const cached = tokenCache.get(cacheKey);
  const now = Date.now();
  if(cached && cached.exp > now + 5000) { // still valid (5s safety window)
    return cached.token;
  }

  if(process.env.DATA_GEN_DEBUG_SECRET === '1'){
    const scr = env.clientSecret || '';
    const masked = scr.length <= 8 ? '*'.repeat(scr.length) : scr.slice(0,3) + '*'.repeat(scr.length-6) + scr.slice(-3);
    console.log(`[DataGen SECRET] env=${envKey} len=${scr.length} masked=${masked}`);
  }

  // If tokenUrl still looks like placeholder, fallback to mock token to avoid runtime failures.
  const feedOverride = FEED_CREDENTIAL_OVERRIDES?.[envKey]?.[feedKey || ''] || {};
  const tokenUrl = feedOverride.tokenUrl || env.tokenUrl;
  const clientId = feedOverride.clientId || env.clientId;
  const clientSecret = feedOverride.clientSecret || env.clientSecret;
  const scope = scopeOverride || feedOverride.scope || env.scope || 'api.default';

  if(/example\/token/.test(tokenUrl)) {
    const mock = 'MOCK_TOKEN_' + randomSuffix();
    if(process.env.DATA_GEN_DEBUG_OUTBOUND === '1'){
      console.log(`[DataGen TOKEN] env=${envKey} feed=${feedKey||'default'} using mock token (placeholder tokenUrl: ${tokenUrl})`);
    }
    tokenCache.set(cacheKey, { token: mock, exp: now + 5*60*1000 });
    return mock;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope
  });
  // If token host is Microsoft public endpoint, skip custom CA unless explicitly forced.
  const isMsHost = /login\.microsoftonline\.com/.test(tokenUrl);
  const forceCa = process.env.DATA_GEN_FORCE_CA === '1';
  const agent = (isMsHost && !forceCa) ? undefined : buildHttpsAgent();
  if(process.env.DATA_GEN_DEBUG_TLS === '1'){
    console.log(`[DataGen TLS] token fetch env=${envKey} feed=${feedKey||'default'} msHost=${isMsHost} forceCa=${forceCa} usingCustomAgent=${!!agent}`);
  }
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    agent
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Token endpoint non-JSON (${resp.status})`); }
  if(!resp.ok) throw new Error(data.error_description || data.error || `Token request failed ${resp.status}`);
  if(!data.access_token) throw new Error('Token response missing access_token');
  const expiresIn = (Number(data.expires_in) || 3600) * 1000;
  tokenCache.set(cacheKey, { token: data.access_token, exp: now + expiresIn });
  return data.access_token;
}

export async function generateRequest({ envKey, feedKey, requestType }){
  if(!FEEDS[feedKey]) throw new Error('Unsupported feed');
  const builders = REQUEST_TYPE_BUILDERS[requestType];
  if(!builders) throw new Error('Unsupported request type');
  const ctx = buildContext(envKey);
  const template = TEMPLATES['Solvd_Order']();
  template.BatchReference = `AutoBR_${randomSuffix()}`;
  template.payloads = builders.map(fn => fn(ctx));
  return { template, ctx };
}

function toIso(d){ return new Date(d).toISOString(); }

function formatLike(original, ms){
  const dt = new Date(ms);
  const str = String(original ?? '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)){
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth()+1).padStart(2,'0');
    const d = String(dt.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  return dt.toISOString();
}

export function transformSourcePayload(source){
  const payload = JSON.parse(JSON.stringify(source || {}));
  const uniq = randomAlphaNum(8);
  const now = Date.now();
  const plus1d = now + 86400000;
  const minus1h = now - 3600000;
  const plus365d = now + 86400000 * 365;

  // BatchReference at top-level
  if (payload && typeof payload === 'object'){
    if (Object.prototype.hasOwnProperty.call(payload, 'BatchReference')) payload.BatchReference = `AutoBR_${uniq}`;
  }

  const arr = payload.Payloads || payload.payloads;
  if (Array.isArray(arr)){
    for(const msg of arr){
      const MT = msg.MessageType ?? msg.messageType;
      const P = msg.Payload ?? msg.payload;
      if (!P) continue;
      if (MT === 10){
        if (Object.prototype.hasOwnProperty.call(P, 'ExternalReference')) P.ExternalReference = `E_${uniq}`;
        if (Object.prototype.hasOwnProperty.call(P, 'externalReference')) P.externalReference = `E_${uniq}`;
        if (Array.isArray(P.OrderItemDetails)){
          for(const oi of P.OrderItemDetails){ if (oi && Object.prototype.hasOwnProperty.call(oi,'BookInDate')){ oi.BookInDate = formatLike(oi.BookInDate, plus1d); } }
        }
        if (Array.isArray(P.orderItemDetails)){
          for(const oi of P.orderItemDetails){ if (oi && Object.prototype.hasOwnProperty.call(oi,'bookInDate')){ oi.bookInDate = formatLike(oi.bookInDate, plus1d); } }
        }
        if (Object.prototype.hasOwnProperty.call(P, 'NotificationDateTime')) P.NotificationDateTime = formatLike(P.NotificationDateTime, minus1h);
        if (Object.prototype.hasOwnProperty.call(P, 'notificationDateTime')) P.notificationDateTime = formatLike(P.notificationDateTime, minus1h);
        if (Object.prototype.hasOwnProperty.call(P, 'NotificationDate')) P.NotificationDate = formatLike(P.NotificationDate, minus1h);
        if (Object.prototype.hasOwnProperty.call(P, 'notificationDate')) P.notificationDate = formatLike(P.notificationDate, minus1h);
        const pol = P.InsurancePolicy || P.insurancePolicy;
        if (pol){
          if (Object.prototype.hasOwnProperty.call(pol,'InsurerExtRef')) pol.InsurerExtRef = randomAlphaNum(14);
          if (Object.prototype.hasOwnProperty.call(pol,'PolicyStartDate')) pol.PolicyStartDate = formatLike(pol.PolicyStartDate, now);
          if (Object.prototype.hasOwnProperty.call(pol,'PolicyEndDate')) pol.PolicyEndDate = formatLike(pol.PolicyEndDate, plus365d);
          if (P.InsurancePolicy) P.InsurancePolicy = pol; else P.insurancePolicy = pol;
        }
        const inc = P.IncidentDetails || P.incidentDetails;
        if (inc && Object.prototype.hasOwnProperty.call(inc,'IncidentDateTime')){
          inc.IncidentDateTime = formatLike(inc.IncidentDateTime, minus1h);
          if (P.IncidentDetails) P.IncidentDetails = inc; else P.incidentDetails = inc;
        }
      }
      if (MT === 9){
        if (Object.prototype.hasOwnProperty.call(P,'Vin')) P.Vin = randomVIN();
        if (Object.prototype.hasOwnProperty.call(P,'VIN')) P.VIN = randomVIN();
        if (Object.prototype.hasOwnProperty.call(P,'Vrn')) P.Vrn = randomVRN();
        if (Object.prototype.hasOwnProperty.call(P,'VRN')) P.VRN = randomVRN();
        if (Object.prototype.hasOwnProperty.call(P,'ExternalReference')) P.ExternalReference = `EXT_REF_VEHICLE_${uniq}`;
      }
      if (MT === 11){
        if (Object.prototype.hasOwnProperty.call(P,'ExternalReference')) P.ExternalReference = `EXT_REF_POLICYHOLDER_${uniq}`;
        if (Object.prototype.hasOwnProperty.call(P,'FirstName')) P.FirstName = `Auto${randomAlphaNum(4)}`;
        if (Object.prototype.hasOwnProperty.call(P,'LastName')) P.LastName = `User${randomAlphaNum(5)}`;
      }
    }
  }

  // Replace any CHANGEME tokens (case-insensitive, common variants) consistently across strings
  function deepReplaceChangeme(obj){
    if (obj == null) return obj;
    if (typeof obj === 'string'){
      if (/changeme|change_me|change-me/i.test(obj)){
        return obj.replace(/changeme|change_me|change-me/gi, uniq);
      }
      return obj;
    }
    if (Array.isArray(obj)) return obj.map(v => deepReplaceChangeme(v));
    if (typeof obj === 'object'){
      const out = {};
      for(const [k,v] of Object.entries(obj)) out[k] = deepReplaceChangeme(v);
      return out;
    }
    return obj;
  }
  return deepReplaceChangeme(payload);
}

export async function postRequest({ envKey, feedKey, payload, overrideToken }){
  const env = ENVIRONMENTS[envKey];
  if(!env) throw new Error('Unknown environment');
  const token = overrideToken || await getBearerToken(envKey, undefined, feedKey);
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  const bizRegion = process.env.DATA_GEN_BUSINESS_REGION || process.env.DATA_GEN_TEST_BUSINESS_REGION;
  if(bizRegion) headers['Accept-BusinessRegion'] = bizRegion;
  if(process.env.DATA_GEN_DEBUG_OUTBOUND === '1') {
    const shortTok = token ? token.slice(0,25)+'…' : 'none';
    console.log('[DataGen OUT]', `env=${envKey}`, 'POST', env.multiTypeUrl, 'Headers:', {
      Authorization: `Bearer ${shortTok}`,
      'Content-Type': headers['Content-Type'],
      'Accept-BusinessRegion': headers['Accept-BusinessRegion'] || null
    });
    console.log('[DataGen OUT] Payload BatchReference:', payload.BatchReference, 'Payload count:', Array.isArray(payload.payloads)?payload.payloads.length:0);
  }
  const res = await fetch(env.multiTypeUrl, { method: 'POST', headers, body: JSON.stringify(payload), agent: buildHttpsAgent() });
  const text = await res.text();
  let json;
  try{ json = JSON.parse(text); } catch { json = { raw: text }; }
  const debug = {
    environment: envKey,
    target: env.multiTypeUrl,
    headers: {
      'Content-Type': headers['Content-Type'],
      'Accept-BusinessRegion': headers['Accept-BusinessRegion'] || null,
      Authorization: 'Bearer ' + (token ? token.slice(0,35)+'…' : '')
    },
    enabledByFlag: process.env.DATA_GEN_DEBUG_OUTBOUND === '1'
  };
  return { status: res.status, ok: res.ok, data: json, debug };
}

function buildHttpsAgent(){
  const insecure = process.env.DATA_GEN_INSECURE_TLS === '1';
  const caPath = process.env.DATA_GEN_CA_FILE;
  if(!insecure && !caPath) return undefined;
  let ca;
  if(caPath){
    try {
      ca = fs.readFileSync(caPath, 'utf8');
      if(process.env.DATA_GEN_DEBUG_TLS === '1') {
        const count = (ca.match(/BEGIN CERTIFICATE/g) || []).length;
        console.log(`[DataGen TLS] Loaded CA file ${caPath} with ${count} cert(s)`);
      }
    } catch (e) {
      console.warn('[DataGen TLS] Failed to read CA file', caPath, e.message);
    }
  }
  return new https.Agent({ rejectUnauthorized: !insecure, ca });
}

export async function getBearerTokenViaPwsh(envKey, scopeOverride, feedKey){
  if(process.env.DATA_GEN_ALLOW_PWSH !== '1'){
    throw new Error('PowerShell token path disabled. Set DATA_GEN_ALLOW_PWSH=1 to enable.');
  }
  const env = ENVIRONMENTS[envKey];
  if(!env) throw new Error('Unknown environment');
  const feedOverride = FEED_CREDENTIAL_OVERRIDES?.[envKey]?.[feedKey || ''] || {};
  const tokenUrl = feedOverride.tokenUrl || env.tokenUrl;
  const clientId = feedOverride.clientId || env.clientId;
  const clientSecret = feedOverride.clientSecret || env.clientSecret;
  const scope = scopeOverride || feedOverride.scope || env.scope || 'api://resource/.default';
  const esc = (s)=> String(s||'').replace(/'/g, "''");
  const psScript = `
    $ErrorActionPreference='Stop';
    # Prefer modern TLS and optionally skip cert validation if requested
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13 } catch {}
    ${process.env.DATA_GEN_PWSH_SKIP_CERT === '1' ? "[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}" : ''}
    $u='${esc(tokenUrl)}';
    $cid='${esc(clientId)}';
    $sec='${esc(clientSecret)}';
    $scp='${esc(scope)}';
    $b = @{ grant_type='client_credentials'; client_id=$cid; client_secret=$sec; scope=$scp };
    $r = Invoke-RestMethod -Method Post -Uri $u -Body $b -ContentType 'application/x-www-form-urlencoded';
    if(-not $r.access_token){ throw 'No access_token in response' }
    $r.access_token
  `;
  const candidates = [ 'pwsh', 'powershell' ];
  let lastErr;
  for(const exe of candidates){
    try{
      const { stdout } = await execFileAsync(exe, ['-NoLogo','-NoProfile','-Command', psScript], { timeout: 20000, windowsHide: true });
      const token = (stdout || '').toString().trim();
      if(!token) throw new Error('Empty token from PowerShell');
      if(process.env.DATA_GEN_DEBUG_OUTBOUND === '1'){
        const short = token.slice(0,25)+'…'+token.slice(-10);
        console.log(`[DataGen PWSH] Token acquired via ${exe}: ${short}`);
      }
      return token;
    }catch(e){ lastErr = e; }
  }
  throw new Error(`PowerShell token acquisition failed: ${lastErr?.message || 'unknown error'}`);
}

export async function postRequestViaPwsh({ envKey, payload, token }){
  if(process.env.DATA_GEN_ALLOW_PWSH !== '1'){
    throw new Error('PowerShell submit path disabled. Set DATA_GEN_ALLOW_PWSH=1 to enable.');
  }
  const env = ENVIRONMENTS[envKey];
  if(!env) throw new Error('Unknown environment');
  const bizRegion = process.env.DATA_GEN_BUSINESS_REGION || process.env.DATA_GEN_TEST_BUSINESS_REGION;
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'datagen-'));
  const tmpFile = path.join(tmpDir, 'payload.json');
  await fsPromises.writeFile(tmpFile, JSON.stringify(payload));
  const esc = (s)=> String(s||'').replace(/'/g, "''");
  const psScript = `
    $ErrorActionPreference='Stop';
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13 } catch {}
    ${process.env.DATA_GEN_PWSH_SKIP_CERT === '1' ? "[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}" : ''}
    $u='${esc(env.multiTypeUrl)}';
    $h=@{ Authorization='Bearer ${esc(token)}'; 'Content-Type'='application/json' };
    ${bizRegion ? `$h['Accept-BusinessRegion'] = '${esc(bizRegion)}';` : ''}
    $b = Get-Content -Raw -Path '${esc(tmpFile)}';
    try {
      $resp = Invoke-WebRequest -Method Post -Uri $u -Headers $h -Body $b -ContentType 'application/json';
      $ct = $resp.Content; $status = [int]$resp.StatusCode;
      try { $parsed = $ct | ConvertFrom-Json -ErrorAction Stop } catch { $parsed = $null }
      $out = @{ status=$status; ok=($status -ge 200 -and $status -lt 300); data = $parsed; raw = if($parsed){ $null } else { $ct } };
      $out | ConvertTo-Json -Depth 40
    } catch {
      $e = $_.Exception.Message; @{ status=0; ok=$false; error=$e } | ConvertTo-Json -Depth 10
    }
  `;
  const candidates = [ 'pwsh', 'powershell' ];
  let lastErr; let stdout;
  try {
    for(const exe of candidates){
      try{
        const res = await execFileAsync(exe, ['-NoLogo','-NoProfile','-Command', psScript], { timeout: 30000, windowsHide: true });
        stdout = (res.stdout || '').toString();
        if(stdout.trim()) break;
      }catch(e){ lastErr = e; }
    }
  } finally {
    try { await fsPromises.unlink(tmpFile); } catch {}
    try { await fsPromises.rmdir(tmpDir); } catch {}
  }
  if(!stdout){
    throw new Error(`PowerShell submit failed: ${lastErr?.message || 'no output'}`);
  }
  let parsed; try { parsed = JSON.parse(stdout); } catch { parsed = { status:0, ok:false, raw: stdout } }
  const debug = {
    environment: envKey,
    target: env.multiTypeUrl,
    headers: {
      'Content-Type': 'application/json',
      'Accept-BusinessRegion': bizRegion || null,
      Authorization: 'Bearer ' + (token ? token.slice(0,35)+'…' : '')
    },
    via: 'powershell'
  };
  return { status: parsed.status ?? 0, ok: !!parsed.ok, data: parsed.data ?? parsed, debug };
}

export async function postJsonViaPwsh({ url, token, body, businessRegion }){
  if(process.env.DATA_GEN_ALLOW_PWSH !== '1'){
    throw new Error('PowerShell path disabled. Set DATA_GEN_ALLOW_PWSH=1 to enable.');
  }
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'datagen-'));
  const tmpFile = path.join(tmpDir, 'payload.json');
  await fsPromises.writeFile(tmpFile, JSON.stringify(body));
  const esc = (s)=> String(s||'').replace(/'/g, "''");
  const psScript = `
    $ErrorActionPreference='Stop';
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13 } catch {}
    ${process.env.DATA_GEN_PWSH_SKIP_CERT === '1' ? "[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}" : ''}
    $u='${esc(url)}';
    $h=@{ Authorization='Bearer ${esc(token)}'; 'Content-Type'='application/json' };
    ${businessRegion ? `$h['Accept-BusinessRegion'] = '${esc(businessRegion)}';` : ''}
    $b = Get-Content -Raw -Path '${esc(tmpFile)}';
    try {
      $resp = Invoke-WebRequest -Method Post -Uri $u -Headers $h -Body $b -ContentType 'application/json';
      $ct = $resp.Content; $status = [int]$resp.StatusCode;
      try { $parsed = $ct | ConvertFrom-Json -ErrorAction Stop } catch { $parsed = $null }
      $out = @{ status=$status; ok=($status -ge 200 -and $status -lt 300); data = $parsed; raw = if($parsed){ $null } else { $ct } };
      $out | ConvertTo-Json -Depth 40
    } catch {
      $e = $_.Exception.Message; @{ status=0; ok=$false; error=$e } | ConvertTo-Json -Depth 10
    }
  `;
  const candidates = [ 'pwsh', 'powershell' ];
  let lastErr; let stdout;
  try {
    for(const exe of candidates){
      try{
        const res = await execFileAsync(exe, ['-NoLogo','-NoProfile','-Command', psScript], { timeout: 30000, windowsHide: true });
        stdout = (res.stdout || '').toString();
        if(stdout.trim()) break;
      }catch(e){ lastErr = e; }
    }
  } finally {
    try { await fsPromises.unlink(tmpFile); } catch {}
    try { await fsPromises.rmdir(tmpDir); } catch {}
  }
  if(!stdout){
    throw new Error(`PowerShell post failed: ${lastErr?.message || 'no output'}`);
  }
  let parsed; try { parsed = JSON.parse(stdout); } catch { parsed = { status:0, ok:false, raw: stdout } }
  return parsed; // { status, ok, data | raw }
}
