import mongoose from "mongoose";

const MatchSchema = new mongoose.Schema({
  p1: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  p2: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  p1Score: { type: Number, default: 0 },
  p2Score: { type: Number, default: 0 }
}, { _id: false });

const RoundSchema = new mongoose.Schema({
  matches: { type: [MatchSchema], default: [] }
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  season: { type: Number },
  status: { type: String, enum: ["upcoming","running","completed"], default: "upcoming" },
  game: { type: String, enum: ["bugSmasher", "memory", "sudoku", "tictactoe"], required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  rounds: { type: [RoundSchema], default: [] },
  currentRound: { type: Number, default: 0 },
  bracketSize: { type: Number, default: 0 },
  results: { type: Object, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

export default mongoose.model("Tournament", tournamentSchema);
