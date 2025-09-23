import mongoose from "mongoose";

const ResourceLinkSchema = new mongoose.Schema({
  name: { type: String, required: true },
  env:  { type: String, enum: ["dev","test","stage","prod"], default: "dev" },
  url:  { type: String, required: true },
  tags: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export default mongoose.model("ResourceLink", ResourceLinkSchema);
