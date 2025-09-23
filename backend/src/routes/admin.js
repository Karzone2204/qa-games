import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getSeason, newSeason, setWeek, setSeasonAuto, resetSeasonScores, getFeatures, setFeatures, getAuthSettings, setAuthSettings, listUsers, toggleUserActive, deleteUser, resendVerification } from "../controllers/adminController.js";
import { adminCreateTournament, adminListTournaments, adminGetTournament, adminSeedAndStart, adminAddParticipants, adminReportMatch, adminAdvanceRound } from "../controllers/tournamentController.js";
import { isSendGridConfigured } from "../services/mailer.js";
const r = Router();
r.use(requireAuth, requireAdmin);
r.get("/season", getSeason);
r.post("/season/new", newSeason);
r.post("/season/week", setWeek);
r.post("/season/auto", setSeasonAuto);
r.post("/season/reset", resetSeasonScores);
r.post("/tournaments", adminCreateTournament);
r.get("/tournaments", adminListTournaments);
r.get("/tournaments/:id", adminGetTournament);
r.post("/tournaments/:id/participants", adminAddParticipants);
r.post("/tournaments/:id/start", adminSeedAndStart);
r.post("/tournaments/:id/rounds/:roundIndex/matches/:matchIndex", adminReportMatch);
r.post("/tournaments/:id/rounds/:roundIndex/advance", adminAdvanceRound);
r.get("/features", getFeatures);
r.post("/features", setFeatures);
r.get("/auth-settings", getAuthSettings);
r.post("/auth-settings", setAuthSettings);
r.get("/users", listUsers);
r.post("/users/active", toggleUserActive);
r.delete("/users/:id", deleteUser);
r.post("/users/resend-verify", resendVerification);
if (process.env.ENABLE_DEBUG_ROUTES === '1'){
	r.get('/debug/email', (req,res)=>{
		res.json({ 
			emailConfigured: isSendGridConfigured(),
			sendgridConfigured: isSendGridConfigured(),
			env: {
				SENDGRID_API_KEY_set: !!process.env.SENDGRID_API_KEY,
				MAIL_FROM: process.env.MAIL_FROM || null
			}
		});
	});
}
export default r;
