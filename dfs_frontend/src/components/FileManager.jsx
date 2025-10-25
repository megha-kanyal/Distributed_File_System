import React, { useState, useEffect } from "react";
import {
  Upload, File, Folder, Download, Trash2, CheckCircle, AlertCircle, X, HardDrive, Search, FolderPlus, Cloud
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

  const uploadAllChunks = async (file, fileId, chunks, relPath) => {
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
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800">
      {/* Header */}
      <div className="bg-teal-800/40 backdrop-blur-xl border-b border-teal-600/30 px-8 py-5 shadow-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-2xl shadow-xl transform hover:scale-110 transition-transform">
              <Cloud size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent">
                Impact Drive
              </h1>
              <p className="text-teal-200 text-sm">Professional Cloud Storage</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-300" size={20} />
            <input
              type="text"
              placeholder="Search your files..."
              className="pl-12 pr-6 py-3 w-96 bg-teal-700/50 border border-teal-500/30 rounded-2xl text-white placeholder-teal-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all shadow-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-8 right-8 p-5 rounded-2xl flex items-center gap-3 shadow-2xl backdrop-blur-xl z-50 transform transition-all duration-300 animate-slide-in ${
          notification.type === "success" 
            ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white border border-emerald-400/30" 
            : "bg-gradient-to-r from-red-500 via-rose-500 to-red-600 text-white border border-red-400/30"
        }`}>
          {notification.type === "success" ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
          <span className="font-semibold text-lg">{notification.message}</span>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-88px)]">
        {/* Sidebar */}
        <div className="w-72 bg-teal-800/20 backdrop-blur-sm border-r border-teal-600/30 p-6">
          <div className="space-y-3">
            <button
              onClick={handleSelectFile}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500 text-white px-6 py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 border border-amber-400/30"
            >
              <Upload size={22} strokeWidth={2.5} /> Upload File
            </button>
            <button
              onClick={handleCreateFolder}
              className="w-full flex items-center justify-center gap-3 bg-teal-700/50 hover:bg-teal-600/60 text-teal-100 px-6 py-4 rounded-2xl font-bold border border-teal-500/40 hover:border-teal-400/60 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
            >
              <FolderPlus size={22} strokeWidth={2.5} /> New Folder
            </button>
          </div>


        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 bg-gradient-to-br from-slate-50 via-white to-slate-100">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-8 text-slate-700 bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-lg">
            <HardDrive size={20} className="text-amber-500" />
            <span 
              className="cursor-pointer hover:text-amber-500 transition-colors font-semibold hover:scale-105 inline-block" 
              onClick={() => setCurrentPath([])}
            >
              Root
            </span>
            {currentPath.map((f, i) => (
              <React.Fragment key={i}>
                <span className="text-slate-400">/</span>
                <span
                  className="cursor-pointer hover:text-amber-500 transition-colors font-semibold hover:scale-105 inline-block"
                  onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                >
                  {f}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Files Grid */}
          {filteredFiles.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-block p-8 bg-white rounded-3xl mb-6 border border-slate-200 shadow-xl">
                <HardDrive size={80} className="text-slate-300" />
              </div>
              <p className="text-slate-700 text-xl font-semibold">No files found</p>
              <p className="text-slate-500 text-sm mt-2">Upload your first file to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-5">
              {filteredFiles.map(file => (
                <div 
                  key={file.name} 
                  className="group p-5 bg-white rounded-2xl shadow-lg hover:shadow-2xl border border-slate-200 hover:border-amber-400 cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-2"
                >
                  {file.type === "folder" ? (
                    <>
                      <div className="mb-4 flex justify-center">
                        <div 
                          className="p-4 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-2xl group-hover:from-amber-300 group-hover:via-yellow-400 group-hover:to-amber-500 transition-all shadow-xl transform group-hover:scale-110"
                          onClick={() => setCurrentPath([...currentPath, file.name])}
                        >
                          <Folder size={40} className="text-white" strokeWidth={2} />
                        </div>
                      </div>
                      <p className="text-center truncate text-slate-800 font-bold mb-2">{file.name}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(file.name, "Folder"); }}
                        className="text-red-500 hover:text-red-600 mx-auto flex justify-center opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                      >
                        <Trash2 size={20} strokeWidth={2.5} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex justify-center">
                        <div className="p-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl group-hover:from-teal-400 group-hover:to-teal-500 transition-all shadow-xl transform group-hover:scale-110">
                          <File size={40} className="text-white" strokeWidth={2} />
                        </div>
                      </div>
                      <p className="text-center truncate text-slate-800 font-bold mb-1">{file.name}</p>
                      <p className="text-center text-xs text-slate-500 mb-3">{formatFileSize(file.size)}</p>
                      <div className="flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-all">
                        <a
                          href={`http://localhost:5000/download/${[...currentPath, file.name].join("/")}`}
                          className="text-amber-500 hover:text-amber-600 transition-all transform hover:scale-125"
                          download
                        >
                          <Download size={20} strokeWidth={2.5} />
                        </a>
                        <button 
                          onClick={() => handleDelete(file.name, "File")} 
                          className="text-red-500 hover:text-red-600 transition-all transform hover:scale-125"
                        >
                          <Trash2 size={20} strokeWidth={2.5} />
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

      {/* Upload Modal */}
      {isUploadModalOpen && selectedFile && chunksInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-teal-800 to-teal-900 rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-teal-600/40">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-2xl text-white flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl">
                  <Upload size={24} className="text-white" />
                </div>
                Upload in Chunks
              </h3>
              <button 
                onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); setChunksInfo(null); }}
                className="p-2 hover:bg-teal-700 rounded-xl transition-all transform hover:scale-110"
              >
                <X size={24} className="text-teal-300" />
              </button>
            </div>

            <div className="mb-6 p-6 bg-gradient-to-r from-teal-700/50 to-teal-800/50 rounded-2xl border border-teal-600/40 backdrop-blur-sm">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-2xl shadow-xl">
                  <File size={48} className="text-white" strokeWidth={2} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-xl text-white mb-2">{chunksInfo.filename}</div>
                  <div className="text-teal-200 mb-1">{formatFileSize(selectedFile.size)}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-400/30 font-semibold">
                      {chunksInfo.total} chunks
                    </span>
                    <span className="text-xs px-3 py-1 bg-teal-600/30 text-teal-300 rounded-full border border-teal-500/30 font-semibold">
                      1 MB each
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-auto bg-teal-900/30 p-4 rounded-2xl border border-teal-700/40 mb-6 space-y-3">
              {chunksInfo.chunks.map(c => (
                <div key={c.index} className="p-4 bg-teal-800/40 backdrop-blur-sm rounded-xl border border-teal-700/40 hover:border-teal-600/60 transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-semibold text-white">Chunk {c.index + 1} of {chunksInfo.total}</div>
                    <div className="text-teal-300 text-sm font-medium">{formatFileSize(c.size)}</div>
                  </div>
                  <div className="w-full bg-teal-900/50 h-3 rounded-full overflow-hidden shadow-inner">
                    <div 
                      style={{ width: `${c.uploaded ? 100 : 2}%` }} 
                      className="h-3 rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 transition-all duration-500 shadow-lg"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); setChunksInfo(null); }}
                className="flex-1 border-2 border-teal-600 hover:bg-teal-700/50 text-teal-100 rounded-2xl py-4 font-bold text-lg transition-all hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleChunkedUpload}
                disabled={isUploading}
                className="flex-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-500 disabled:from-teal-700 disabled:to-teal-800 text-white rounded-2xl py-4 font-bold text-lg shadow-xl transition-all disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-amber-400/30"
              >
                {isUploading ? "⏳ Uploading..." : `🚀 Upload ${chunksInfo.total} chunks`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;