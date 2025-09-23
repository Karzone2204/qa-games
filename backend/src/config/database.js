import mongoose from "mongoose";
export async function connectDB(uri) {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err?.message || err);
    throw err;
  }
}
