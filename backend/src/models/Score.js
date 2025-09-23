import mongoose from "mongoose";
const scoreSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  game:   { type: String, required: true },
  score:  { type: Number, required: true },
  season: { type: String, required: true } // e.g., "2025-09"
}, { timestamps: true });

scoreSchema.index({ game: 1, score: -1 });
scoreSchema.index({ season: 1, game: 1, score: -1 });
scoreSchema.index({ player: 1, game: 1, season: 1, score: -1 });

export default mongoose.model("Score", scoreSchema);
