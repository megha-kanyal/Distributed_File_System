
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import fileRoutes from "../routes/fileRoutes.js";
import dotenv from "dotenv";
import { connectDB } from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Ensure base folders
const BASE_DIR = path.join(process.cwd(), "uploads");
const CHUNKS_DIR = path.join(process.cwd(), "chunks"); // simulated nodes live under here
const TEMP_DIR = path.join(process.cwd(), "temp");

const ensure = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};
ensure(BASE_DIR);
ensure(CHUNKS_DIR);
ensure(TEMP_DIR);

// Create node folders to simulate different storage nodes
const N_NODES = process.env.SIMULATED_NODES ? parseInt(process.env.SIMULATED_NODES, 10) : 3;
for (let i = 1; i <= N_NODES; i++) ensure(path.join(CHUNKS_DIR, `node${i}`));

// API routes
app.use("/api/files", fileRoutes);

// Serve merged uploads (for preview)
app.use("/uploads", express.static(BASE_DIR));

// Download route - download merged files created by merge endpoint
app.get(/^\/download\/(.+)/, (req, res) => {
  const relPath = req.params[0];
  const filePath = path.join(BASE_DIR, relPath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error("Download error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to download file" });
    }
  });
});

const PORT = process.env.PORT || 5000;

// connect DB then start server
(async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
})();
