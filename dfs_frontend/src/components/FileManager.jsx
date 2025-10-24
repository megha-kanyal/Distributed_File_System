// dfs_frontend/src/components/FileManager.jsx
import React, { useState, useEffect } from "react";
import {
  Upload, File, Folder, Download, Trash2, CheckCircle, AlertCircle, X, HardDrive, Search
} from "lucide-react";

const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB fixed
const API_URL = "http://localhost:5000/api/files";

const formatFileSize = (bytes) => {
  if (!bytes) return "0 Bytes";
  const k = 1024, sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
};

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [chunksInfo, setChunksInfo] = useState(null);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadFiles = async () => {
    try {
      const res = await fetch(`${API_URL}?path=${encodeURIComponent(currentPath.join("/"))}`);
      const data = await res.json();
      setFiles(data);
    } catch (e) {
      showNotification("Failed to load files", "error");
    }
  };

  useEffect(() => { loadFiles(); }, [currentPath]);

  // prepare chunk metadata
  const prepareChunks = (file) => {
    const total = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const chunks = new Array(total).fill(0).map((_, i) => {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      return { index: i, start, end, size: end - start, uploaded: false };
    });
    return { fileId, chunks, total };
  };

  const splitAndPreview = (file) => {
    const info = prepareChunks(file);
    setChunksInfo({ ...info, filename: file.name });
    setSelectedFile(file);
    setIsUploadModalOpen(true);
  };

  const handleSelectFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) splitAndPreview(file);
    };
    input.click();
  };

  // upload a single chunk
  const uploadChunk = async (file, fileId, chunkMeta, relPath) => {
    const blob = file.slice(chunkMeta.start, chunkMeta.end);
    const fd = new FormData();
    fd.append("chunk", blob, `${fileId}_part_${chunkMeta.index}`);
    fd.append("fileId", fileId);
    fd.append("filename", file.name);
    fd.append("index", chunkMeta.index);
    fd.append("totalChunks", Math.ceil(file.size / CHUNK_SIZE));
    if (relPath) fd.append("path", relPath);

    const resp = await fetch(`${API_URL}/upload-chunk`, {
      method: "POST",
      body: fd
    });
    return resp.json();
  };

  // orchestrate uploads (simple concurrency naive approach)
  const uploadAllChunks = async (file, fileId, chunks, relPath) => {
    // simple parallel uploads with limited concurrency
    const concurrency = 3;
    let pointer = 0;

    const updated = [...chunks];
    const workers = new Array(concurrency).fill(0).map(async () => {
      while (pointer < updated.length) {
        const idx = pointer++;
        try {
          await uploadChunk(file, fileId, updated[idx], relPath);
          updated[idx].uploaded = true;
          setChunksInfo(prev => prev ? ({ ...prev, chunks: updated.slice() }) : prev);
        } catch (e) {
          console.error("Chunk upload error", e);
        }
      }
    });

    await Promise.all(workers);
    return updated;
  };

  const handleChunkedUpload = async () => {
    if (!selectedFile || !chunksInfo) return;
    setIsUploading(true);
    const relPath = currentPath.join("/");

    try {
      await uploadAllChunks(selectedFile, chunksInfo.fileId, chunksInfo.chunks, relPath);

      // request merge
      const mergeResp = await fetch(`${API_URL}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: chunksInfo.fileId, filename: chunksInfo.filename, path: relPath })
      });
      const mergeJson = await mergeResp.json();
      if (mergeJson.ok || mergeJson.path) {
        showNotification("Uploaded & merged successfully");
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        setChunksInfo(null);
        setTimeout(loadFiles, 600);
      } else {
        showNotification("Merge failed: " + (mergeJson.error || "unknown"), "error");
      }
    } catch (e) {
      console.error(e);
      showNotification("Upload failed", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt("Enter folder name:");
    if (!name) return;
    try {
      await fetch(`${API_URL}/folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parent: currentPath.join("/") }),
      });
      showNotification("Folder created!");
      loadFiles();
    } catch {
      showNotification("Failed to create folder", "error");
    }
  };

  const handleDelete = async (name, type) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await fetch(`${API_URL}/delete?path=${[...currentPath, name].join("/")}`, { method: "DELETE" });
      showNotification(`${type} deleted`);
      loadFiles();
    } catch {
      showNotification("Delete failed", "error");
    }
  };

  const filteredFiles = files.filter(f =>
    f.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#D1E1D7]">
      {/* Header */}
      <div className="bg-green-100 border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <HardDrive size={32} className="text-blue-500" />
          <h1 className="text-2xl font-semibold">Drive</h1>
        </div>
        <div className="relative bg-white">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search"
            className="pl-10 pr-4 py-2 w-80 border rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg flex items-center gap-2 ${
          notification.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
        }`}>
          {notification.type === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {notification.message}
        </div>
      )}

      <div className="flex">
        <div className="w-64 bg-green-100 border-r p-4 flex flex-col gap-2">
          <button
            onClick={() => handleSelectFile()}
            className="flex items-center gap-2 bg-blue-900 text-white px-4 py-2 rounded"
          >
            <Upload size={18} /> Upload File
          </button>
          <button
            onClick={handleCreateFolder}
            className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded"
          >
            <Folder size={18} /> New Folder
          </button>
        </div>

        <div className="flex-1 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="cursor-pointer text-blue-900" onClick={() => setCurrentPath([])}>Root</span>
            {currentPath.map((f, i) => (
              <React.Fragment key={i}>
                <span>/</span>
                <span
                  className="cursor-pointer text-blue-900"
                  onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                >
                  {f}
                </span>
              </React.Fragment>
            ))}
          </div>

          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <HardDrive size={64} className="mx-auto text-gray-300" />
              <p className="text-gray-500">No files here</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-4">
              {filteredFiles.map(file => (
                <div key={file.name} className="p-4 bg-white rounded-lg shadow cursor-pointer">
                  {file.type === "folder" ? (
                    <>
                      <Folder
                        size={32}
                        className="text-yellow-500 mx-auto"
                        onClick={() => setCurrentPath([...currentPath, file.name])}
                      />
                      <p className="text-center truncate mt-2">{file.name}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.name, "Folder"); }}
                        className="text-red-500 mx-auto mt-1 flex justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <File size={32} className="text-gray-500 mx-auto" />
                      <p className="text-center truncate mt-2">{file.name}</p>
                      <p className="text-center text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      <div className="flex justify-center gap-2 mt-2">
                        <a
                          href={`http://localhost:5000/download/${[...currentPath, file.name].join("/")}`}
                          className="text-blue-500"
                          download
                        >
                          <Download size={16} />
                        </a>
                        <button onClick={() => handleDelete(file.name, "File")} className="text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal / Chunk Preview */}
      {isUploadModalOpen && selectedFile && chunksInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-green-500 rounded-lg p-6 w-96">
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold">Upload File in Chunks (1 MB)</h3>
              <button onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); setChunksInfo(null); }}>
                <X size={20} />
              </button>
            </div>

            <div className="mb-3">
              <div className="flex items-center gap-3">
                <File size={36} />
                <div>
                  <div className="font-medium">{chunksInfo.filename}</div>
                  <div className="text-sm text-gray-700">{formatFileSize(selectedFile.size)}</div>
                </div>
              </div>
            </div>

            <div className="max-h-48 overflow-auto bg-white p-2 rounded mb-3">
              {chunksInfo.chunks.map(c => (
                <div key={c.index} className="mb-2">
                  <div className="flex justify-between text-xs">
                    <div>Chunk {c.index + 1} / {chunksInfo.total}</div>
                    <div>{formatFileSize(c.size)}</div>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded mt-1">
                    <div style={{ width: `${c.uploaded ? 100 : 2}%` }} className="h-2 rounded bg-green-500" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); setChunksInfo(null); }}
                className="flex-1 border rounded py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleChunkedUpload}
                disabled={isUploading}
                className="flex-1 bg-blue-500 text-white rounded py-2"
              >
                {isUploading ? "Uploading..." : `Upload (${chunksInfo.total} chunks)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
