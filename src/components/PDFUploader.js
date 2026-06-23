// PDFUploader.js - Updated with better error handling
import React, { useState, useRef } from "react";

const PDFUploader = ({ onUpload, maxSizeMB = 0 }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setError("");
    setProgress(0);

    const formData = new FormData();
    formData.append("pdf", file);
    const response = await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      body: formData,
    });
    try {
      // Check if backend is reachable first
      const healthCheck = await fetch("http://localhost:5000/api/health", {
        method: "GET",
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });

      if (!healthCheck.ok) {
        throw new Error("Backend server is not responding");
      }

      // Upload the file with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.open("POST", "http://localhost:5000/api/upload");

        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error("Invalid response from server"));
            }
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error - cannot reach server"));
        };

        xhr.ontimeout = () => {
          reject(new Error("Upload timeout - server not responding"));
        };

        xhr.timeout = 300000; // 5 minutes timeout for large files
        xhr.send(formData);
      });

      const result = await uploadPromise;

      if (result.success) {
        setProgress(100);
        if (onUpload) {
          onUpload(result.file);
        }
        // Reset after successful upload
        setTimeout(() => {
          setFile(null);
          setProgress(0);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }, 2000);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "Failed to upload file");
      setUploading(false);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validate file type
    if (selectedFile.type !== "application/pdf") {
      setError("Please select a PDF file");
      return;
    }

    // Check size if maxSizeMB is set
    if (maxSizeMB > 0) {
      const maxSize = maxSizeMB * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        setError(`File size exceeds ${maxSizeMB}MB limit`);
        return;
      }
    }

    setFile(selectedFile);
    setError("");
    setProgress(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Trigger file change handler
      const event = { target: { files: [droppedFile] } };
      handleFileChange(event);
    }
  };

  const removeFile = () => {
    setFile(null);
    setProgress(0);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="pdf-uploader"
      style={{ maxWidth: "600px", margin: "0 auto" }}
    >
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: "2px dashed #ccc",
          borderRadius: "8px",
          padding: "40px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.3s ease",
          background: file ? "#f0f7ff" : "#fafafa",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {!file ? (
          <>
            <div style={{ fontSize: "48px" }}>📄</div>
            <h3>Drop your PDF here or click to browse</h3>
            <p style={{ color: "#666" }}>
              {maxSizeMB === 0 ? "No size limit" : `Max size: ${maxSizeMB}MB`}
            </p>
          </>
        ) : (
          <div>
            <div style={{ fontSize: "32px" }}>📄</div>
            <p>
              <strong>{file.name}</strong>
            </p>
            <p>{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            {uploading && (
              <div style={{ marginTop: "10px" }}>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    background: "#e0e0e0",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: "#4a90d9",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <p>{progress}% uploaded</p>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile();
              }}
              style={{
                marginTop: "10px",
                padding: "5px 15px",
                background: "#ff4444",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c33",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {file && !uploading && (
        <button
          onClick={handleUpload}
          style={{
            marginTop: "16px",
            padding: "12px 24px",
            background: "#4a90d9",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "16px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Upload PDF
        </button>
      )}
    </div>
  );
};

export default PDFUploader;
