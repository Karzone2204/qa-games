import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getSeasonConfig } from "../services/seasonService.js";
import { listLinks, createLink, updateLink, deleteLink, generateTestCases } from "../controllers/toolsController.js";
import { confluenceSimilaritySearch } from "../llm/confluenceStore.js";

const r = Router();

// Feature flag guard for QA Tools
async function requireQAToolsEnabled(req, res, next){
	const cfg = await getSeasonConfig();
	if (!cfg.enableQATools && req.user?.role !== 'admin') {
		return res.status(403).json({ error: "QA Tools are disabled by admin" });
	}
	next();
}

// Everyone logged-in can view
r.get("/links", requireAuth, requireQAToolsEnabled, listLinks);

// Admin-only changes
r.post("/links", requireAuth, requireAdmin, createLink);
r.put("/links/:id", requireAuth, requireAdmin, updateLink);
r.delete("/links/:id", requireAuth, requireAdmin, deleteLink);

// LLM test case generation
r.post('/testcases/generate', requireAuth, requireQAToolsEnabled, generateTestCases);

// Confluence search (debug/verification): returns vector hits directly
r.get('/confluence/search', requireAuth, requireQAToolsEnabled, async (req, res) => {
	const q = (req.query.query || '').toString().trim();
	const k = Math.max(1, Math.min(parseInt(req.query.k) || 4, 8));
	if (!q || q.length < 3) return res.status(400).json({ error: 'query required (min 3 chars)' });
	try {
		const hits = await confluenceSimilaritySearch(q, k);
		res.json({ ok: true, count: hits.length, hits });
	} catch (e) {
		res.status(500).json({ ok: false, error: e?.message || 'search failed' });
	}
});

export default r;
