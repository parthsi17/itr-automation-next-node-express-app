import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is required");
  await mongoose.connect(uri);
  console.log(JSON.stringify({ level: "INFO", msg: "MongoDB connected" }));
}

export async function closeDB() {
  await mongoose.connection.close();
  console.log(JSON.stringify({ level: "INFO", msg: "MongoDB connection closed" }));
}
