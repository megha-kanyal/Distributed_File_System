
import mongoose from "mongoose";

const ChunkSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    node: { type: String },
    path: { type: String }, // absolute path on disk
  },
  { _id: false }
);

const FileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  totalChunks: { type: Number, required: true },
  path: { type: String, default: "" }, // target relative folder in uploads
  createdAt: { type: Date, default: Date.now },
  chunks: { type: [ChunkSchema], default: [] },
});

export default mongoose.model("File", FileSchema);