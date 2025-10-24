// backend/routes/fileRoutes.js
import express from "express";
import multer from "multer";
import {
  getFiles,
  uploadFile,
  createFolder,
  deleteFileOrFolder,
  uploadChunk,
  mergeChunks
} from "../controllers/fileController.js";

const router = express.Router();
const upload = multer({ dest: "temp/" }); // temp storage for incoming multipart

// list files/folders
router.get("/", getFiles);

// single-file upload (backwards compat)
router.post("/upload", upload.single("file"), uploadFile);

// chunk upload
router.post("/upload-chunk", upload.single("chunk"), uploadChunk);

// merge chunks (after all chunk uploads)
router.post("/merge", mergeChunks);

// create folder
router.post("/folder", createFolder);

// delete
router.delete("/delete", deleteFileOrFolder);

export default router;
