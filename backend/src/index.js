import express from "express";
import cors from "cors";
import fileRoutes from "../routes/fileRoutes.js";
import path from "path";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/files", fileRoutes);

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
