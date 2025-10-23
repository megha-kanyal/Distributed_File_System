import express from "express";
import multer from "multer";
import {
  getFiles,
  uploadFile,
  createFolder,
  deleteFileOrFolder,
} from "../controllers/fileController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Routes
router.get("/", getFiles);
router.post("/upload", upload.single("file"), uploadFile);
router.post("/folder", createFolder);
router.delete("/delete", deleteFileOrFolder);

export default router;
