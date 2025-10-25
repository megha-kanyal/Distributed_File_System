
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getFiles,
  uploadFile,
  createFolder,
  deleteFileOrFolder,
  uploadChunk,
  mergeChunks,
} from "../controllers/fileController.js";

const router = express.Router();

// Ensure temp dir exists for multer destination
const TEMP_DIR = path.join(process.cwd(), "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const upload = multer({ dest: TEMP_DIR });

// list files/folders
router.get("/", getFiles);

// single-file upload (backwards compat)
router.post("/upload", upload.single("file"), uploadFile);

// chunk upload
router.post("/upload-chunk", upload.single("chunk"), uploadChunk);

// merge chunks (after all chunk uploads)
router.post("/merge", express.json(), mergeChunks);

// create folder
router.post("/folder", express.json(), createFolder);

// delete
router.delete("/delete", deleteFileOrFolder);

export default router;
