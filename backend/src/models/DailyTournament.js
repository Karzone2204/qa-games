import mongoose from "mongoose";

const dailyTournamentSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD (UTC)
  slug: { type: String, required: true }, // 'sprint' | 'brain'
  title: { type: String, required: true },
  game: { type: String, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  locked: { type: Boolean, default: false },
  results: { type: Array, default: [] } // [{ user, name, score }]
}, { timestamps: true });

dailyTournamentSchema.index({ date: 1, slug: 1 }, { unique: true });

export default mongoose.model('DailyTournament', dailyTournamentSchema);
