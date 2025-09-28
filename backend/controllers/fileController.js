import fs from "fs";
import path from "path";

const BASE_DIR = path.join(process.cwd(), "uploads");

// Helper: get full path from query
const getFullPath = (relPath) => path.join(BASE_DIR, relPath || "");

// List files/folders
export const getFiles = (req, res) => {
  const relPath = req.query.path || "";
  const fullPath = getFullPath(relPath);

  fs.readdir(fullPath, { withFileTypes: true }, (err, items) => {
    if (err) return res.status(500).json({ error: "Cannot read folder" });
    const files = items.map(i => ({
      name: i.name,
      type: i.isDirectory() ? "folder" : "file",
      size: i.isFile() ? fs.statSync(path.join(fullPath, i.name)).size : 0
    }));
    res.json(files);
  });
};

// Upload file
export const uploadFile = (req, res) => {
  const relPath = req.query.path || "";
  const targetDir = getFullPath(relPath);

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const file = req.file;
  const targetPath = path.join(targetDir, file.originalname);

  fs.rename(file.path, targetPath, (err) => {
    if (err) return res.status(500).json({ error: "Upload failed" });
    res.json({ message: "File uploaded" });
  });
};

// Create folder
export const createFolder = (req, res) => {
  const { name, parent } = req.body;
  const folderPath = getFullPath(path.join(parent || "", name));

  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  res.json({ message: "Folder created" });
};

// Delete file/folder
export const deleteFileOrFolder = (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: "Path required" });

  const targetPath = getFullPath(relPath);

  if (!fs.existsSync(targetPath)) return res.status(404).json({ error: "Not found" });

  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true });
  else fs.unlinkSync(targetPath);

  res.json({ message: "Deleted" });
};