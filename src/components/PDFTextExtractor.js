// PDFTextExtractor.js - Complete working version
import React, { useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const PDFTextExtractor = ({ onTextExtracted, maxSizeMB = 0 }) => {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [extractionMethod, setExtractionMethod] = useState("auto");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const fileInputRef = useRef(null);

  const validateFile = (selectedFile) => {
    if (selectedFile.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return false;
    }

    if (maxSizeMB > 0) {
      const maxSize = maxSizeMB * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        setError(`File size exceeds ${maxSizeMB}MB limit`);
        return false;
      }
    }

    return true;
  };

  // Extract text from PDF
  const extractText = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setIsProcessing(true);
    setError("");
    setExtractedText("");
    setProgress(0);
    setCurrentPage(0);
    setPageCount(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      setPageCount(totalPages);

      let fullText = "";
      let textPages = 0;
      let ocrPages = 0;

      for (let i = 1; i <= totalPages; i++) {
        setCurrentPage(i);
        setProgress(Math.round((i / totalPages) * 50));

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");

        let extractedPageText = "";

        if (pageText.trim().length > 50) {
          extractedPageText = pageText;
          textPages++;
        } else {
          // OCR for image-based pages
          ocrPages++;
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport }).promise;
          const imageData = canvas.toDataURL("image/png");

          const result = await Tesseract.recognize(
            imageData,
            "eng+spa+fra+deu+rus",
            {
              logger: (m) => {
                if (m.status === "recognizing text") {
                  const pageProgress = ((i - 1) / totalPages) * 50;
                  setProgress(
                    50 +
                      Math.round(pageProgress + (m.progress * 50) / totalPages),
                  );
                }
              },
            },
          );

          extractedPageText = result.data.text || "";
        }

        if (extractedPageText.trim()) {
          fullText += `Page ${i}:\n${extractedPageText}\n\n`;
        }
      }

      setExtractedText(fullText || "No text could be extracted from this PDF.");
      setProgress(100);

      if (onTextExtracted) {
        onTextExtracted(fullText, "auto");
      }
    } catch (error) {
      console.error("Extraction error:", error);
      setError("Extraction failed: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
      setError("");
      setExtractedText("");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
      setError("");
      setExtractedText("");
    }
  };

  const removeFile = () => {
    setFile(null);
    setExtractedText("");
    setError("");
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    alert("Text copied to clipboard!");
  };

  const downloadText = () => {
    const blob = new Blob([extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.name.replace(".pdf", "")}_extracted_text.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="pdf-text-extractor"
      style={{ maxWidth: "600px", margin: "0 auto" }}
    >
      {/* Drop Zone */}
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: "2px dashed #ccc",
          borderRadius: "8px",
          padding: "30px",
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
              Supports both text-based and image-based PDFs
            </p>
            <p style={{ color: "#999", fontSize: "12px" }}>
              {maxSizeMB === 0
                ? "📦 No size limit"
                : `Max size: ${maxSizeMB}MB`}
            </p>
          </>
        ) : (
          <div>
            <div style={{ fontSize: "32px" }}>📄</div>
            <p>
              <strong>{file.name}</strong>
            </p>
            <p style={{ color: "#666" }}>
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
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

      {/* Extraction Method Selector */}
      {file && !isProcessing && !extractedText && (
        <div style={{ marginTop: "15px" }}>
          <select
            value={extractionMethod}
            onChange={(e) => setExtractionMethod(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          >
            <option value="auto">Auto (Recommended)</option>
            <option value="text">Text Extraction (Fast)</option>
            <option value="ocr">OCR (For images)</option>
          </select>

          {/* EXTRACT BUTTON - This is what you're missing! */}
          <button
            onClick={extractText}
            style={{
              marginTop: "12px",
              padding: "12px 24px",
              background: "#4a90d9",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              width: "100%",
              transition: "background 0.3s",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#357abd")}
            onMouseLeave={(e) => (e.target.style.background = "#4a90d9")}
          >
            📝 Extract Text
          </button>
        </div>
      )}

      {/* Progress */}
      {isProcessing && (
        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              width: "100%",
              height: "8px",
              backgroundColor: "#e0e0e0",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                backgroundColor: "#4a90d9",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ textAlign: "center", marginTop: "8px", color: "#666" }}>
            {pageCount > 0 ? (
              <span>
                Processing page {currentPage} of {pageCount}
              </span>
            ) : (
              <span>Processing... {progress}%</span>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c33",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Extracted Text */}
      {extractedText && !isProcessing && (
        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              background: "#f0f7ff",
              borderBottom: "1px solid #e0e0e0",
              borderRadius: "8px 8px 0 0",
            }}
          >
            <h4 style={{ margin: 0 }}>📝 Extracted Text</h4>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={copyToClipboard}
                style={{
                  padding: "4px 12px",
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                📋 Copy
              </button>
              <button
                onClick={downloadText}
                style={{
                  padding: "4px 12px",
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                💾 Download
              </button>
            </div>
          </div>
          <div
            style={{
              maxHeight: "400px",
              overflow: "auto",
              padding: "16px",
              background: "#fafafa",
              borderRadius: "0 0 8px 8px",
              border: "1px solid #e0e0e0",
              borderTop: "none",
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                fontFamily: "monospace",
                fontSize: "14px",
                lineHeight: "1.6",
              }}
            >
              {extractedText.length > 2000
                ? extractedText.substring(0, 2000) + "\n\n... (truncated)"
                : extractedText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFTextExtractor;
