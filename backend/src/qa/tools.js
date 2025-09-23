import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import fetch from "node-fetch";

// Basic allowlist root (project root)
const ROOT = path.resolve(process.cwd(), "..");

export const docsTool = tool(async ({ sources }) => {
  const blobs = [];
  for (const src of sources) {
    try {
      if (/^https?:\/\//i.test(src)) {
        const r = await fetch(src, { timeout: 15000 });
        if (!r.ok) continue;
        blobs.push(await r.text());
      } else {
        // sanitize local path (stay within repo)
        const abs = path.resolve(process.cwd(), src);
        if (!abs.startsWith(process.cwd())) continue; // prevent path escape
        const txt = await fs.readFile(abs, "utf8");
        blobs.push(txt);
      }
    } catch { /* ignore individual source errors */ }
  }
  let joined = blobs.join("\n\n---\n\n");
  if (joined.length > 40000) joined = joined.slice(0, 40000) + "\n...TRUNCATED";
  return joined || "";
}, {
  name: "load_ui_requirements",
  description: "Load UI requirement or component source files (URLs or local repo-relative paths).",
  schema: z.object({ sources: z.array(z.string()).min(1).max(5) })
});
