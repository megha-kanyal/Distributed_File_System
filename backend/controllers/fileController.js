// backend/controllers/fileController.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// base locations (relative to project root)
const BASE_DIR = path.join(process.cwd(), "uploads");
const CHUNKS_DIR = path.join(process.cwd(), "chunks"); // contains node1, node2, ...
const METADATA_PATH = path.join(process.cwd(), "metadata.json");

// helper ensures
const ensure = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };
ensure(BASE_DIR);
ensure(CHUNKS_DIR);
if (!fs.existsSync(METADATA_PATH)) fs.writeFileSync(METADATA_PATH, JSON.stringify({}), "utf8");

// read/write metadata (synchronous for simplicity)
const readMetadata = () => {
  try { return JSON.parse(fs.readFileSync(METADATA_PATH, "utf8") || "{}"); }
  catch (e) { return {}; }
};
const writeMetadata = (m) => fs.writeFileSync(METADATA_PATH, JSON.stringify(m, null, 2), "utf8");

// -------------------- Helpers --------------------
const getFullPath = (rel = "") => path.join(BASE_DIR, rel);

// -------------------- List files/folders --------------------
export const getFiles = (req, res) => {
  const relPath = req.query.path || "";
  const fullPath = getFullPath(relPath);

  if (!fs.existsSync(fullPath)) {
    return res.json([]); // empty when folder not present
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
};

// -------------------- Single file upload --------------------
export const uploadFile = (req, res) => {
  const relPath = req.query.path || "";
  const targetDir = getFullPath(relPath);
  ensure(targetDir);

  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file provided" });

  const targetPath = path.join(targetDir, file.originalname);
  fs.rename(file.path, targetPath, (err) => {
    if (err) return res.status(500).json({ error: "Upload failed" });
    res.json({ message: "File uploaded successfully", path: `${relPath}/${file.originalname}`.replace(/^\/+/, "") });
  });
};

// -------------------- Upload chunk (simulated distribution) --------------------
// expects multipart/form-data with fields:
// - chunk (file)
// - fileId (string) - client-generated unique id for file
// - filename (string) - original filename
// - index (number) - chunk index 0-based
// - totalChunks (number)
// - path (optional) - relative path where merged file should go
export const uploadChunk = (req, res) => {
  try {
    const { fileId, filename, index, totalChunks, path: relPath = "" } = req.body;
    if (!fileId || filename === undefined || index === undefined || totalChunks === undefined) {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Missing required fields" });
    }

    // determine N nodes available
    const nodeDirs = fs.readdirSync(CHUNKS_DIR).filter(d => d.startsWith("node"));
    const N = nodeDirs.length || 1;
    // choose node by round-robin based on index
    const nodeIndex = (parseInt(index, 10) % N) + 1;
    const nodeName = `node${nodeIndex}`;
    const nodeFolder = path.join(CHUNKS_DIR, nodeName);

    // ensure per-file folder under node
    const destFolder = path.join(nodeFolder, fileId);
    ensure(destFolder);

    // move uploaded temp to chunk file named chunk_<index>
    const chunkName = `chunk_${index}`;
    const destPath = path.join(destFolder, chunkName);
    fs.renameSync(req.file.path, destPath);

    // update metadata: record that fileId's chunk index is stored at nodeName/destFolder
    const meta = readMetadata();
    if (!meta[fileId]) {
      meta[fileId] = {
        filename,
        totalChunks: parseInt(totalChunks, 10),
        path: relPath, // intended final folder path
        createdAt: Date.now(),
        chunks: {} // index => { node: nodeName, path: relative path on disk }
      };
    }
    meta[fileId].chunks[index] = { node: nodeName, path: path.relative(process.cwd(), destPath) };
    writeMetadata(meta);

    // check if all present
    const present = Object.keys(meta[fileId].chunks).length;
    const gotAll = present === parseInt(totalChunks, 10);

    return res.json({ ok: true, gotAll });
  } catch (err) {
    console.error("uploadChunk error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// -------------------- Merge chunks into final file --------------------
// POST body: { fileId, filename, path }  (path optional)
export const mergeChunks = (req, res) => {
  try {
    const { fileId, filename, path: relPath = "" } = req.body;
    if (!fileId || !filename) return res.status(400).json({ error: "fileId and filename required" });

    const meta = readMetadata();
    const fileMeta = meta[fileId];
    if (!fileMeta) return res.status(404).json({ error: "No metadata for this fileId" });

    // validate chunk count
    const chunkEntries = Object.keys(fileMeta.chunks)
      .map(i => parseInt(i, 10))
      .sort((a, b) => a - b);

    if (chunkEntries.length === 0) return res.status(400).json({ error: "No chunk files to merge" });
    if (chunkEntries.length !== fileMeta.totalChunks) {
      return res.status(400).json({ error: "Not all chunks uploaded yet", got: chunkEntries.length, expected: fileMeta.totalChunks });
    }

    // ensure target directory exists
    const targetDir = getFullPath(relPath || fileMeta.path || "");
    ensure(targetDir);

    const mergedPath = path.join(targetDir, filename);
    const writeStream = fs.createWriteStream(mergedPath);

    // function to append chunk by index sequentially
    const appendChunk = (i) => {
      if (i >= chunkEntries.length) {
        writeStream.end();
        // cleanup chunk files and metadata
        try {
          chunkEntries.forEach(ci => {
            const cinfo = fileMeta.chunks[ci];
            const absolute = path.join(process.cwd(), cinfo.path);
            if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
            // remove fileId folder if empty
            const folder = path.dirname(absolute);
            try {
              const items = fs.readdirSync(folder);
              if (items.length === 0) fs.rmdirSync(folder);
            } catch (e) { /* ignore */ }
          });
        } catch (e) { console.error("cleanup error", e); }

        // remove metadata entry
        delete meta[fileId];
        writeMetadata(meta);

        return res.json({ ok: true, path: `${path.join(relPath || fileMeta.path || "", filename)}`.replace(/^\/+/, "") });
      }

      const idx = chunkEntries[i];
      const cinfo = fileMeta.chunks[idx];
      const chunkAbs = path.join(process.cwd(), cinfo.path);
      if (!fs.existsSync(chunkAbs)) {
        writeStream.close();
        return res.status(500).json({ error: `Missing chunk file: index ${idx}` });
      }

      const rs = fs.createReadStream(chunkAbs);
      rs.pipe(writeStream, { end: false });
      rs.on("end", () => appendChunk(i + 1));
      rs.on("error", (err) => {
        console.error("Error reading chunk", err);
        writeStream.close();
        return res.status(500).json({ error: "Error merging chunks" });
      });
    };

    appendChunk(0);
  } catch (err) {
    console.error("mergeChunks error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// -------------------- Create folder --------------------
export const createFolder = (req, res) => {
  const { name, parent } = req.body;
  const folderPath = getFullPath(path.join(parent || "", name));
  ensure(folderPath);
  res.json({ message: "Folder created successfully" });
};

// -------------------- Delete file/folder --------------------
export const deleteFileOrFolder = (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: "Path required" });

  const targetPath = getFullPath(relPath);

  if (!fs.existsSync(targetPath)) return res.status(404).json({ error: "Not found" });

  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true });
  else fs.unlinkSync(targetPath);

  res.json({ message: "Deleted successfully" });
};
