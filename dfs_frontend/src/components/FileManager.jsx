import React, { useState, useEffect } from 'react';
import { Upload, File, Download, Trash2, AlertCircle, CheckCircle, Loader } from 'lucide-react';

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Load all files from backend
  const loadFiles = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/files/');
      const data = await res.json();
      setFiles(data);
    } catch (error) {
      showNotification('Failed to load files', 'error');
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) {
      showNotification('Please choose a file first', 'error');
      return;
    }
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('http://localhost:5000/api/files/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      showNotification(data.message, 'success');
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      loadFiles();
    } catch (error) {
      showNotification('Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete a file
  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    
    try {
      await fetch(`http://localhost:5000/api/files/${filename}`, { method: 'DELETE' });
      showNotification(`${filename} deleted successfully`, 'success');
      loadFiles();
    } catch (error) {
      showNotification('Failed to delete file', 'error');
    }
  };

  // Handle drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setSelectedFile(droppedFile);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file extension
  const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
  };

  // Get file icon color based on extension
  const getFileIconColor = (extension) => {
    const colors = {
      'pdf': 'text-red-500',
      'doc': 'text-blue-500',
      'docx': 'text-blue-500',
      'txt': 'text-gray-500',
      'jpg': 'text-green-500',
      'jpeg': 'text-green-500',
      'png': 'text-green-500',
      'gif': 'text-green-500',
      'mp4': 'text-purple-500',
      'mp3': 'text-yellow-500',
      'zip': 'text-orange-500',
      'rar': 'text-orange-500'
    };
    return colors[extension] || 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">File Manager</h1>
          <p className="text-gray-600">Upload, manage, and download your files</p>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-2 ${
            notification.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {notification.message}
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="text-blue-500" size={24} />
            <h2 className="text-2xl font-semibold text-gray-800">Upload File</h2>
          </div>
          
          <div className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : selectedFile
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <File className="mx-auto text-green-500" size={48} />
                  <p className="text-lg font-medium text-gray-700">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto text-gray-400" size={48} />
                  <p className="text-lg text-gray-600">
                    Drag and drop a file here, or{' '}
                    <label className="text-blue-500 hover:text-blue-600 cursor-pointer underline">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setSelectedFile(e.target.files[0])}
                      />
                    </label>
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className={`w-full py-3 px-6 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                !selectedFile || isUploading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Upload File
                </>
              )}
            </button>
          </div>
        </div>

        {/* Files List */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <File className="text-blue-500" size={24} />
              <h2 className="text-2xl font-semibold text-gray-800">Your Files</h2>
            </div>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {files.length} files
            </span>
          </div>

          {files.length === 0 ? (
            <div className="text-center py-12">
              <File className="mx-auto text-gray-300 mb-4" size={64} />
              <p className="text-gray-500 text-lg">No files uploaded yet</p>
              <p className="text-gray-400">Upload your first file to get started</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {files.map((filename, index) => (
                <div
                  key={filename}
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className={`flex-shrink-0 ${getFileIconColor(getFileExtension(filename))}`} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 truncate">{filename}</p>
                      <p className="text-sm text-gray-500 uppercase">{getFileExtension(filename)} file</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`http://localhost:5000/api/files/download/${filename}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Download file"
                    >
                      <Download size={18} />
                    </a>
                    <button
                      onClick={() => handleDelete(filename)}
                      className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete file"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileManager;