import React, { useState, useEffect } from "react";
import {
  Upload, File, Folder, Download, Trash2, CheckCircle, AlertCircle, X, HardDrive, Search
} from "lucide-react";

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const API_URL = "http://localhost:5000/api/files";

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadFiles = async () => {
    try {
      const res = await fetch(`${API_URL}?path=${currentPath.join("/")}`);
      const data = await res.json();
      setFiles(data);
    } catch {
      showNotification("Failed to load files", "error");
    }
  };

  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  // ✅ Fixed Upload Function
  const handleUpload = async () => {
    if (!selectedFile) return showNotification("Please choose a file first", "error");
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      await fetch(`${API_URL}/upload?path=${encodeURIComponent(currentPath.join("/"))}`, {
        method: "POST",
        body: formData,
      });
      showNotification("File uploaded successfully!");
      setSelectedFile(null);
      setIsUploadModalOpen(false);
      loadFiles();
    } catch {
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

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const filteredFiles = files.filter(f =>
    f.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024, sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
  };

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

      {/* Sidebar + Main */}
      <div className="flex">
        <div className="w-64 bg-green-100 border-r p-4 flex flex-col gap-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
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

        {/* Files */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file.name, "Folder");
                        }}
                        className="text-red-500 mx-auto mt-1 flex justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <File size={32} className="text-gray-500 mx-auto" />
                      <p className="text-center truncate mt-2">{file.name}</p>
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

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-green-500 rounded-lg p-6 w-96">
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold">Upload File</h3>
              <button onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); }}>
                <X size={20} />
              </button>
            </div>
            <div
              className={`border-2 border-dashed p-6 text-center ${
                isDragging ? "border-blue-400 bg-blue-50" :
                selectedFile ? "border-green-400 bg-green-50" :
                "border-gray-300"
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <>
                  <File size={48} className="mx-auto text-green-500" />
                  <p>{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </>
              ) : (
                <>
                  <Upload size={48} className="mx-auto text-gray-400" />
                  <p>
                    Drag file or{" "}
                    <label className="text-blue-500 underline cursor-pointer">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                      />
                    </label>
                  </p>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setIsUploadModalOpen(false); setSelectedFile(null); }}
                className="flex-1 border rounded py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex-1 bg-blue-500 text-white rounded py-2"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
