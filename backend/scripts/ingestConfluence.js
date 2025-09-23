#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ override: true });
const { loadPageList, fetchAndCleanPages, chunkDocument } = await import('../src/llm/confluenceLoader.js');
const { upsertConfluenceChunks } = await import('../src/llm/confluenceStore.js');

async function main(){
  console.log('[Confluence] Ingestion start');
  const missing = ['CONFLUENCE_BASE_URL','CONFLUENCE_EMAIL','CONFLUENCE_API_TOKEN'].filter(k => !process.env[k]);
  if (missing.length){
    console.warn('[Confluence] Missing environment variables:', missing.join(', '));
  }
  const debug = /^(1|true|yes)$/i.test(process.env.CONFLUENCE_DEBUG || '');
  const rawBase = process.env.CONFLUENCE_BASE_URL || '';
  const sanitizedBase = rawBase.replace(/\/$/,'').replace(/\/home$/,'');
  if (debug) console.log('[Confluence][DEBUG] Raw base URL:', rawBase, 'Sanitized:', sanitizedBase);

  // Preflight connectivity & basic auth probe (does not fail ingestion, just logs)
  await preflight(sanitizedBase).catch(e => console.warn('[Confluence] Preflight warning:', e.message));
  const pages = await loadPageList();
  console.log(`[Confluence] Page list loaded (${pages.length}). IDs: ${pages.map(p=>p.id).join(', ')}`);
  const updated = await fetchAndCleanPages(pages);
  if (!updated.length){
    console.log('[Confluence] No page changes detected');
    return;
  }
  let totalChunks = 0;
  for (const p of updated){
    const chunks = chunkDocument(p);
    totalChunks += chunks.length;
    await upsertConfluenceChunks(chunks);
    console.log(`[Confluence] Upserted ${chunks.length} chunks for page ${p.id}`);
  }
  console.log(`[Confluence] Ingestion complete. Pages updated: ${updated.length}, chunks: ${totalChunks}`);
}

main().catch(e => { console.error('[Confluence] Ingestion error', e); process.exit(1); });

async function preflight(base){
  const email = process.env.CONFLUENCE_EMAIL;
  const token = process.env.CONFLUENCE_API_TOKEN;
  if (!email || !token) throw new Error('Skipping preflight (missing credentials)');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const url = `${base}/rest/api/space?limit=1`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }, method: 'GET' });
    const ms = Date.now() - t0;
    if (!r.ok){
      const body = await r.text();
      console.warn(`[Confluence] Preflight HTTP ${r.status} ${r.statusText} (${ms}ms) bodySnippet="${body.slice(0,200).replace(/\n/g,' ')}"`);
    } else {
      console.log(`[Confluence] Preflight success (${ms}ms)`);
    }
  } catch (e) {
    throw new Error(`Network error: ${e.message}`);
  }
}
