import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  name:  { type: String, required: true },
  role:  { type: String, enum: ["user", "admin"], default: "user" },
  active: { type: Boolean, default: true },
  passwordHash: { type: String, required: true },
  // Email verification
  emailVerified: { type: Boolean, default: true },
  verifyToken: { type: String, default: null },
  verifyTokenExp: { type: Date, default: null },
  // Password reset
  resetToken: { type: String, default: null },
  resetTokenExp: { type: Date, default: null }
}, { timestamps: true });
export default mongoose.model("User", userSchema);
