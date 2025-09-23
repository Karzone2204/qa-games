import { listEnvironments, listFeeds, ENVIRONMENTS, FEED_FILE_SUFFIXES, FEEDS } from '../config/dataGenConfig.js';
import { generateRequest, postRequest, getBearerTokenViaPwsh, postRequestViaPwsh, transformSourcePayload, getBearerToken, postJsonViaPwsh } from '../services/dataGenService.js';
import fetch from 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

export async function meta(_req, res){
  try{
    const envs = listEnvironments();
    const feeds = listFeeds();
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const genRoot = path.resolve(__dirname, '../../generated');
    const availability = {};
    for(const [feedKey] of Object.entries(FEEDS)){
      availability[feedKey] = {};
      const suffix = FEED_FILE_SUFFIXES[feedKey] || 'ATUser';
      const reqTypes = FEEDS[feedKey].requestTypes || [];
      for(const rt of reqTypes){
        const p = path.join(genRoot, feedKey, rt, `source_${suffix}.json`);
        availability[feedKey][rt] = fs.existsSync(p);
      }
    }
    return res.json({ environments: envs, feeds, availability });
  } catch(e){
    return res.json({ environments: listEnvironments(), feeds: listFeeds(), availability: {} });
  }
}

export async function generate(req, res){
  try{
  const { environment, feed, requestType, source, sourceName } = req.body || {};
    if(!environment || !feed || !requestType) return res.status(400).json({ error: 'environment, feed, requestType required'});
  const result = await generateRequest({ envKey: environment, feedKey: feed, requestType });
    let template = result.template;
    let savedSourceFile;
    if (source && typeof source === 'object'){
      // Persist ONLY the raw source once, named with _ATUser.json
      try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const outDir = path.resolve(__dirname, '../../generated');
        fs.mkdirSync(outDir, { recursive: true });
        const base = (typeof sourceName === 'string' && sourceName.trim()) ? sourceName.trim() : 'source';
        const filePath = path.join(outDir, `${base}_ATUser.json`);
        fs.writeFileSync(filePath, JSON.stringify(source, null, 2));
        savedSourceFile = filePath;
      } catch(e) { /* ignore file write errors */ }
      // Transform in-memory for response only
      template = transformSourcePayload(source);
    } else {
      // No source provided from client; load default saved source from solution by feed/requestType.
      try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const genRoot = path.resolve(__dirname, '../../generated');
        const feedKey = String(feed);
        const reqKey = String(requestType);
        const suffix = FEED_FILE_SUFFIXES[feedKey] || 'ATUser';
        const preferredDir = path.join(genRoot, feedKey, reqKey);
        const base = (typeof sourceName === 'string' && sourceName.trim()) ? sourceName.trim() : (process.env.DATA_GEN_SOURCE_FILE || 'source');
        let filePath = path.join(preferredDir, `${base}_${suffix}.json`);
        if (!fs.existsSync(filePath)){
          filePath = path.join(genRoot, `${base}_ATUser.json`);
        }
        if (!fs.existsSync(filePath)){
          return res.status(400).json({ error: `Source file not found. Try ${base}_${suffix}.json under backend/generated/${feedKey}/${reqKey} or fallback ${base}_ATUser.json under backend/generated.` });
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        savedSourceFile = filePath;
        template = transformSourcePayload(parsed);
      } catch(e) {
        return res.status(400).json({ error: `Failed to load source file: ${e.message}` });
      }
    }
  const safeCtx = { ...(result.ctx || {}) };
  if (safeCtx.clientSecret) delete safeCtx.clientSecret;
  return res.json({ template, ctx: safeCtx, savedSourceFile });
  }catch(e){
    return res.status(500).json({ error: e.message });
  }
}

export async function submit(req, res){
  try{
  const { environment, feed, payload, manualToken, usePwshToken, usePwshSubmit } = req.body || {};
    if(!environment || !payload) return res.status(400).json({ error: 'environment & payload required'});
    const headerOverride = req.headers['x-override-token'];
    let overrideToken = manualToken || headerOverride;
    if(!overrideToken && usePwshToken){
      try{
        overrideToken = await getBearerTokenViaPwsh(environment, undefined, feed);
      }catch(e){
        return res.status(502).json({ error: `PowerShell token error: ${e.message}` });
      }
    }
    if(usePwshSubmit){
      const tokenForSubmit = overrideToken || await getBearerTokenViaPwsh(environment, undefined, feed);
      const resp = await postRequestViaPwsh({ envKey: environment, payload, token: tokenForSubmit });
      return res.json(resp);
    }
  const resp = await postRequest({ envKey: environment, feedKey: feed, payload, overrideToken });
    return res.json(resp);
  }catch(e){
    let debug;
    if(process.env.DATA_GEN_DEBUG_OUTBOUND === '1'){
      const envKey = req.body?.environment;
      const envCfg = ENVIRONMENTS[envKey] || {};
      debug = {
        target: envCfg.multiTypeUrl || null,
        tokenUrl: envCfg.tokenUrl || null,
        env: envKey || null,
        caFile: process.env.DATA_GEN_CA_FILE || null,
        businessRegion: process.env.DATA_GEN_TEST_BUSINESS_REGION || process.env.DATA_GEN_BUSINESS_REGION || null,
        note: 'Debug info included due to DATA_GEN_DEBUG_OUTBOUND=1'
      };
    }
    return res.status(500).json({ error: e.message, debug });
  }
}

export async function tokenTest(req, res){
  const envKey = req.params.environment;
  const envCfg = ENVIRONMENTS[envKey];
  if(!envCfg) return res.status(400).json({ error: 'Unknown environment' });
  // We replicate token portion of service to isolate TLS vs secret vs scope issues.
  const info = { environment: envKey, tokenUrl: envCfg.tokenUrl, scope: envCfg.scope, clientId: envCfg.clientId };
  const caPath = process.env.DATA_GEN_CA_FILE;
  if(caPath){
    try {
      const raw = fs.readFileSync(caPath, 'utf8');
      info.caFile = caPath;
      info.caCertCount = (raw.match(/BEGIN CERTIFICATE/g) || []).length;
    } catch(e){ info.caReadError = e.message; }
  } else {
    info.caFile = null;
  }
  info.insecureTLS = process.env.DATA_GEN_INSECURE_TLS === '1';
  info.forceCa = process.env.DATA_GEN_FORCE_CA === '1';
  info.msHost = /login\.microsoftonline\.com/.test(envCfg.tokenUrl);
  // Extra diagnostics: external trust and proxy context
  info.nodeExtraCaCerts = process.env.NODE_EXTRA_CA_CERTS || null;
  if(info.nodeExtraCaCerts){
    try {
      const rawExtra = fs.readFileSync(info.nodeExtraCaCerts, 'utf8');
      info.nodeExtraCaCertsCertCount = (rawExtra.match(/BEGIN CERTIFICATE/g) || []).length;
    } catch(e){ info.nodeExtraCaCertsReadError = e.message; }
  }
  info.proxy = {
    HTTPS_PROXY: process.env.HTTPS_PROXY || null,
    HTTP_PROXY: process.env.HTTP_PROXY || null,
    NO_PROXY: process.env.NO_PROXY || null
  };
  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: envCfg.clientId,
      client_secret: envCfg.clientSecret,
      scope: envCfg.scope
    });
    const fetchMod = (await import('node-fetch')).default;
    const httpsMod = await import('https');
    let agent;
    if(!(info.msHost && !info.forceCa)) { // only apply custom agent if NOT Microsoft host OR explicitly forced
      if(info.insecureTLS || caPath){
        let ca;
        if(caPath){ try { ca = fs.readFileSync(caPath, 'utf8'); } catch{} }
        agent = new httpsMod.Agent({ rejectUnauthorized: !info.insecureTLS, ca });
      }
    }
    info.usingCustomAgent = !!agent;
    const resp = await fetchMod(envCfg.tokenUrl, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body, agent });
    const text = await resp.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw:text }; }
    if(!resp.ok){
      return res.status(resp.status).json({ error: data.error_description || data.error || `Token error ${resp.status}`, info });
    }
    const access = data.access_token || null;
    return res.json({ ok:true, tokenPreview: access ? access.slice(0,25)+'…' : null, expiresIn: data.expires_in, info });
  } catch(e){
    return res.status(500).json({ error: e.message, info });
  }
}

export async function tlsPeerCert(req, res){
  const envKey = req.params.environment;
  const envCfg = ENVIRONMENTS[envKey];
  if(!envCfg) return res.status(400).json({ error: 'Unknown environment' });
  const url = new URL(envCfg.tokenUrl);
  const host = url.hostname;
  const port = url.port || 443;
  try {
    const httpsMod = await import('https');
    const options = { host, port, method: 'GET', path: '/', rejectUnauthorized: false };
    let captured = [];
    await new Promise((resolve, reject) => {
      const reqTls = httpsMod.request(options, (resp)=>{ resp.resume(); resp.on('end', resolve); });
      reqTls.on('error', reject);
      reqTls.on('socket', (socket) => {
        socket.on('secureConnect', () => {
          const peer = socket.getPeerCertificate(true);
          const arr = [];
          (function walk(cert){
            if(cert && Object.keys(cert).length){
              arr.push({ subject: cert.subject, issuer: cert.issuer, subjectCN: cert.subject?.CN, issuerCN: cert.issuer?.CN, valid_from: cert.valid_from, valid_to: cert.valid_to, fingerprint: cert.fingerprint, ocsp: cert.ocsp_url || null });
              if(cert.issuerCertificate && cert.issuerCertificate !== cert) walk(cert.issuerCertificate);
            }
          })(peer);
          captured = arr;
        });
      });
      reqTls.end();
      setTimeout(()=>reject(new Error('TLS probe timeout')), 8000);
    });
    return res.json({ host, port, chain: captured });
  } catch(e){
    return res.status(500).json({ error: e.message, host, port });
  }
}

export async function pollOrder(req, res){
  try{
    const { environment, keyword, maxAttempts } = req.body || {};
    if(!environment || !keyword) return res.status(400).json({ error: 'environment and keyword required' });
    const envCfg = ENVIRONMENTS[environment];
    if(!envCfg) return res.status(400).json({ error: 'Unknown environment' });
    const url = envCfg.orderListUrl;
    if(!url) return res.status(400).json({ error: 'orderListUrl not configured for environment' });
  const attempts = Math.max(1, Math.min(Number(maxAttempts) || 10, 10));

    const scopeOverride = 'https://tigplcb2ctest.onmicrosoft.com/gateway/.default';
  const token = await getBearerTokenViaPwsh(environment, scopeOverride);
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    const body = { paging: { number:1, size:10 }, filters: [ { by:'keyword', value: keyword, type:'like' } ], sorts: [] };
    const delays = [];
    for(let i=0;i<attempts;i++){
      let ok=false; let data;
      const resp = await postJsonViaPwsh({ url, token, body, businessRegion: process.env.DATA_GEN_BUSINESS_REGION || process.env.DATA_GEN_TEST_BUSINESS_REGION });
      ok = !!resp.ok && (resp.status >=200 && resp.status <300);
      data = resp.data ?? resp;
      if(ok && data?.data?.results?.length){
        const hit = data.data.results[0];
        return res.json({ found:true, id: hit.id, orderReference: hit.orderReference, attempts: i+1, result: hit });
      }
      if(i < attempts-1){
        await new Promise(resolve=>setTimeout(resolve, 5000));
        delays.push(5000);
      }
    }
    return res.json({ found:false, attempts, message:'Order not created within attempt window' });
  }catch(e){
    return res.status(500).json({ error: e.message });
  }
}
