import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import fileRoutes from "../routes/fileRoutes.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Base directory for all uploaded files
const BASE_DIR = path.join(process.cwd(), "uploads");

// API routes
app.use("/api/files", fileRoutes);

// Serve uploads statically (for preview)
app.use("/uploads", express.static(BASE_DIR));

app.get(/^\/download\/(.+)/, (req, res) => {
  const relPath = req.params[0]; // capture everything after /download/
  const filePath = path.join(BASE_DIR, relPath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).json({ error: "Failed to download file" });
    }
  });
});


const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
