// backend/src/llm/vector.js
import { makeEmbeddings } from "./clients.js";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// We'll lazy-load the loaders so we can fall back gracefully across LC versions
async function loadDirectoryDocs(dir = "data/qa-knowledge") {
  try {
    // ✅ Path for langchain@0.2.x
    const { DirectoryLoader } = await import("langchain/document_loaders/fs/directory");
    const { TextLoader } = await import("langchain/document_loaders/fs/text");
    const loader = new DirectoryLoader(dir, {
      ".md": (p) => new TextLoader(p),
      ".txt": (p) => new TextLoader(p),
    });
    return await loader.load();
  } catch (e) {
    // Fallback: manual scan (works even if loader exports change)
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const { Document } = await import("langchain/document");

    async function* walk(d) {
      for (const entry of await fs.readdir(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (/\.(md|txt)$/i.test(entry.name)) yield full;
      }
    }

    const docs = [];
    for await (const file of walk(dir)) {
      const text = await fs.readFile(file, "utf8");
      docs.push(new Document({ pageContent: text, metadata: { source: file } }));
    }
    return docs;
  }
}

let vectorStore = null;

export async function loadVectorStore() {
  const docs = await loadDirectoryDocs().catch(() => []);
  const embeddings = makeEmbeddings();
  vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
  return { ok: true, count: docs.length };
}

export async function ragSearch(query, k = 4) {
  if (!vectorStore) await loadVectorStore();
  const results = await vectorStore.similaritySearch(query, k);
  return results.map((d) => ({
    pageContent: d.pageContent.slice(0, 1000),
    meta: d.metadata,
  }));
}
