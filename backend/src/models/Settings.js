import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // always 'global'
  autoSeason: { type: Boolean, default: true },
  currentSeasonOverride: { type: String, default: null },
  enableQATools: { type: Boolean, default: false },
  enableChatbot: { type: Boolean, default: false },
  emailVerifyOnSignup: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Settings', settingsSchema);
