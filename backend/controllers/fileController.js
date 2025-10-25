
import fs from "fs";
import path from "path";
import File from "../models/File.js"; // MongoDB model

// Base directories
const BASE_DIR = path.join(process.cwd(), "uploads");
const CHUNKS_DIR = path.join(process.cwd(), "chunks");

// Helper to ensure folder existence
const ensure = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};
ensure(BASE_DIR);
ensure(CHUNKS_DIR);

// Helper to get absolute path inside uploads
const getFullPath = (rel = "") => path.join(BASE_DIR, rel);

// -------------------- Get files/folders --------------------
export const getFiles = (req, res) => {
  try {
    const relPath = req.query.path || "";
    const fullPath = getFullPath(relPath);

    if (!fs.existsSync(fullPath)) {
      return res.json([]);
    }

    fs.readdir(fullPath, { withFileTypes: true }, (err, items) => {
      if (err) return res.status(500).json({ error: "Cannot read folder" });

      const files = items.map((i) => ({
        name: i.name,
        type: i.isDirectory() ? "folder" : "file",
        size: i.isFile() ? fs.statSync(path.join(fullPath, i.name)).size : 0,
      }));

      res.json(files);
    });
  } catch (error) {
    console.error("getFiles error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// -------------------- Single-file upload --------------------
export const uploadFile = (req, res) => {
  try {
    const relPath = req.query.path || "";
    const targetDir = getFullPath(relPath);
    ensure(targetDir);

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });

    const targetPath = path.join(targetDir, file.originalname);

    // move from temp to uploads folder
    fs.rename(file.path, targetPath, (err) => {
      if (err) {
        console.error("uploadFile rename error:", err);
        // try to cleanup temp
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(500).json({ error: "Upload failed" });
      }
      res.json({
        message: "File uploaded successfully",
        path: `${relPath}/${file.originalname}`.replace(/^\/+/, ""),
      });
    });
  } catch (err) {
    console.error("uploadFile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// -------------------- Upload chunk (simulated distribution) --------------------
export const uploadChunk = async (req, res) => {
  try {
    console.log("uploadChunk called:", req.body, req.file);
    const { fileId, filename, index, totalChunks, path: relPath = "" } = req.body;
    if (!fileId || filename === undefined || index === undefined || totalChunks === undefined) {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Choose node folder (simulate distributed nodes)
    const nodeDirs = fs.existsSync(CHUNKS_DIR)
      ? fs.readdirSync(CHUNKS_DIR).filter((d) => d.startsWith("node"))
      : [];
    const N = nodeDirs.length || 1;
    const nodeIndex = (parseInt(index, 10) % N) + 1;
    const nodeName = `node${nodeIndex}`;
    const nodeFolder = path.join(CHUNKS_DIR, nodeName);
    ensure(nodeFolder);
    const destFolder = path.join(nodeFolder, fileId);
    ensure(destFolder);

    const chunkName = `chunk_${index}`;
    const destPath = path.join(destFolder, chunkName);

    // move temp chunk to node folder
    fs.renameSync(req.file.path, destPath);

    // Update or insert file metadata in MongoDB
    const fileDoc = await File.findOneAndUpdate(
      { fileId },
      {
        $set: {
          fileId,
          filename,
          totalChunks: parseInt(totalChunks, 10),
          path: relPath,
        },
        $setOnInsert: { createdAt: new Date() },
        $push: {
          chunks: {
            index: parseInt(index, 10),
            node: nodeName,
            path: destPath,
          },
        },
      },
      { upsert: true, new: true }
    );

    const gotAll = fileDoc.chunks.length === fileDoc.totalChunks;
    return res.json({ ok: true, gotAll });
  } catch (err) {
    console.error("uploadChunk error:", err);
    // cleanup temp if present
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch (e) {}
    return res.status(500).json({ error: "Internal server error" });
  }
};

// -------------------- Merge chunks into final file --------------------
export const mergeChunks = async (req, res) => {
  try {
    const { fileId, filename, path: relPath = "" } = req.body;
    if (!fileId || !filename)
      return res.status(400).json({ error: "fileId and filename required" });

    const fileDoc = await File.findOne({ fileId });
    if (!fileDoc) return res.status(404).json({ error: "No metadata for this fileId" });

    const chunkEntries = fileDoc.chunks
      .slice() // copy
      .sort((a, b) => a.index - b.index);

    if (chunkEntries.length !== fileDoc.totalChunks)
      return res.status(400).json({ error: "Not all chunks uploaded yet" });

    const targetDir = path.join(BASE_DIR, relPath || fileDoc.path || "");
    ensure(targetDir);
    const mergedPath = path.join(targetDir, filename);
    const writeStream = fs.createWriteStream(mergedPath);

    const appendChunk = (i) => {
      if (i >= chunkEntries.length) {
        writeStream.end();

        // Cleanup chunk files + remove empty folders if possible
        try {
          chunkEntries.forEach((c) => {
            if (fs.existsSync(c.path)) fs.unlinkSync(c.path);
            const folder = path.dirname(c.path);
            try {
              const items = fs.readdirSync(folder);
              if (items.length === 0) fs.rmdirSync(folder);
            } catch (e) {}
          });
        } catch (e) {
          console.error("cleanup error", e);
        }

        // Remove metadata doc
        // File.deleteOne({ fileId }).catch(console.error);

        return res.json({
          ok: true,
          path: `${path.join(relPath || fileDoc.path || "", filename)}`.replace(/^\/+/, ""),
        });
      }

      const chunkAbs = chunkEntries[i].path;
      if (!fs.existsSync(chunkAbs)) {
        writeStream.close();
        return res.status(500).json({ error: `Missing chunk file: index ${chunkEntries[i].index}` });
      }

      const rs = fs.createReadStream(chunkAbs);
      rs.pipe(writeStream, { end: false });
      rs.on("end", () => appendChunk(i + 1));
      rs.on("error", (err) => {
        console.error("merge error", err);
        writeStream.close();
        return res.status(500).json({ error: "Error merging chunks" });
      });
    };

    appendChunk(0);
  } catch (err) {
    console.error("mergeChunks error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// -------------------- Create folder --------------------
export const createFolder = (req, res) => {
  try {
    const { name, parent } = req.body;
    if (!name) return res.status(400).json({ error: "Folder name required" });
    const folderPath = getFullPath(path.join(parent || "", name));
    ensure(folderPath);
    res.json({ message: "Folder created successfully" });
  } catch (err) {
    console.error("createFolder error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// -------------------- Delete file/folder --------------------
export const deleteFileOrFolder = (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) return res.status(400).json({ error: "Path required" });

    const targetPath = getFullPath(relPath);
    if (!fs.existsSync(targetPath)) return res.status(404).json({ error: "Not found" });

    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true });
    else fs.unlinkSync(targetPath);

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("deleteFileOrFolder error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
