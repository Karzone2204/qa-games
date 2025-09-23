import fs from 'node:fs/promises';
import path from 'node:path';
import { makeEmbeddings } from './clients.js';
import { Document } from 'langchain/document';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

const INDEX_DIR = path.resolve(process.cwd(), 'data/confluence/index');

let store = null;
let usingFaiss = false;

async function loadFaissClass() {
  try {
    const mod = await import('@langchain/community/vectorstores/faiss');
    // Try common export names
    return mod.FaissStore || mod.FAISS || null;
  } catch {
    return null;
  }
}

async function ensureDir(){ await fs.mkdir(INDEX_DIR, { recursive: true }); }

export async function loadConfluenceVectorStore() {
  if (store) return store;
  await ensureDir();
  const Faiss = await loadFaissClass();
  if (Faiss) {
    try {
      store = await Faiss.load(INDEX_DIR, makeEmbeddings());
      usingFaiss = true;
      return store;
    } catch {
      // If not found or cannot load, initialize an empty FAISS store so we can persist on first upsert
      try {
        store = await Faiss.fromTexts([], [], makeEmbeddings());
        usingFaiss = true;
        // Save an empty index structure to the directory for future loads
        await store.save(INDEX_DIR);
        return store;
      } catch {
        // fall through to memory
      }
    }
  }
  // Empty memory store (will be populated on first upsert)
  store = await MemoryVectorStore.fromTexts([], [], makeEmbeddings());
  usingFaiss = false;
  return store;
}

export async function saveConfluenceVectorStore() {
  if (!store || !usingFaiss) return; // only Faiss supports save
  try { await store.save(INDEX_DIR); } catch {/* ignore */}
}

export async function upsertConfluenceChunks(rawChunks) {
  await loadConfluenceVectorStore();
  const emb = makeEmbeddings();
  const docs = rawChunks.map(c => new Document({ pageContent: c.pageContent, metadata: c.metadata }));
  if (!store) {
    // Should not happen (load creates one), but guard anyway
    store = await MemoryVectorStore.fromDocuments(docs, emb);
  } else {
    // Some vector stores implement addDocuments; Memory & Faiss both do
    await store.addDocuments(docs);
  }
  await saveConfluenceVectorStore();
  return { added: docs.length, usingFaiss };
}

export async function confluenceSimilaritySearch(query, k=4) {
  await loadConfluenceVectorStore();
  if (!store) return [];
  const res = await store.similaritySearch(query, k);
  return res.map(r => ({
    snippet: r.pageContent.slice(0, 800),
    title: r.metadata.title,
    url: r.metadata.url,
    pageId: r.metadata.pageId,
    version: r.metadata.version,
    storage: usingFaiss ? 'faiss' : 'memory'
  }));
}
