import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getTournamentPublic, userJoinTournament, listPublicTournaments, getDailyTournaments, joinDailyTournament, getDailyResults } from "../controllers/tournamentController.js";
import { submitScore, topScores, overallLeaderboard, achievements } from "../controllers/gameController.js";
const r = Router();
r.get("/scores", requireAuth, topScores);
r.post("/scores", requireAuth, submitScore);
r.get("/scores/overall", requireAuth, overallLeaderboard);
r.get("/scores/achievements", requireAuth, achievements);
// Daily tournaments (define BEFORE generic :id routes)
r.get('/tournaments/daily', requireAuth, getDailyTournaments);
r.post('/tournaments/daily/:slug/join', requireAuth, joinDailyTournament);
r.get('/tournaments/daily/results', requireAuth, getDailyResults);
// Public tournament endpoints under /api (mounted as /api in app.js)
r.get('/tournaments', requireAuth, listPublicTournaments);
r.get('/tournaments/:id', requireAuth, getTournamentPublic);
r.post('/tournaments/:id/join', requireAuth, userJoinTournament);
export default r;
