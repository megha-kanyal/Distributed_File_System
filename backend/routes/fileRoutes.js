import express from "express";
import {
  getFiles,
  uploadFile,
  createFolder,
  deleteFileOrFolder
} from "../controllers/fileController.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/", getFiles);
router.post("/upload", upload.single("file"), uploadFile);
router.post("/folder", createFolder);
router.delete("/delete", deleteFileOrFolder);

export default router;
