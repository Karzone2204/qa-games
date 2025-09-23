import { apiBase } from "./apiBase";

export async function genUICases({ feature, sources = [], focus = [], count } = {}) {
  const r = await fetch(`${apiBase()}/qa/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ feature, sources, focus, count })
  });
  if (!r.ok) throw new Error(`QA generation failed: ${r.status}`);
  return r.json();
}
