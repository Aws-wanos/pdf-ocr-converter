// UnlimitedPDFProcessor.js - New component with no limits
import React, { useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const UnlimitedPDFProcessor = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ pages: 0, textPages: 0, ocrPages: 0 });
  const fileInputRef = useRef(null);

  const processPDF = async (file) => {
    if (!file) return;

    setProcessing(true);
    setError("");
    setProgress(0);
    setExtractedText("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      let fullText = "";
      let textPages = 0;
      let ocrPages = 0;

      for (let i = 1; i <= totalPages; i++) {
        setProgress((i / totalPages) * 100);

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");

        let extractedPageText = "";

        if (pageText.trim().length > 50) {
          // Text-based page
          extractedPageText = pageText;
          textPages++;
        } else {
          // Image-based page - need OCR
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
                  const pageProgress = ((i - 1) / totalPages) * 100;
                  setProgress(pageProgress + (m.progress * 100) / totalPages);
                }
              },
            },
          );

          extractedPageText = result.data.text || "";
        }

        fullText += `Page ${i}:\n${extractedPageText}\n\n`;
      }

      setExtractedText(fullText);
      setStats({
        pages: totalPages,
        textPages,
        ocrPages,
      });
    } catch (err) {
      setError("Failed to process PDF: " + err.message);
    } finally {
      setProcessing(false);
      setProgress(100);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        setError("Please select a PDF file");
        return;
      }
      setFile(selectedFile);
      processPDF(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.type !== "application/pdf") {
        setError("Please drop a PDF file");
        return;
      }
      setFile(droppedFile);
      processPDF(droppedFile);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div
      className="unlimited-processor"
      style={{ maxWidth: "800px", margin: "0 auto" }}
    >
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: "2px dashed #ccc",
          borderRadius: "12px",
          padding: "40px",
          textAlign: "center",
          cursor: "pointer",
          background: file ? "#f0f7ff" : "#fafafa",
          transition: "all 0.3s ease",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {!file ? (
          <>
            <div style={{ fontSize: "48px" }}>📄</div>
            <h3 style={{ margin: "10px 0" }}>
              Drop your PDF here or click to browse
            </h3>
            <p style={{ color: "#666" }}>
              No size limit - supports files of any size
            </p>
            <p style={{ color: "#999", fontSize: "12px" }}>
              Both text-based and image-based PDFs supported
            </p>
          </>
        ) : (
          <div>
            <div style={{ fontSize: "32px" }}>📄</div>
            <p style={{ fontWeight: "bold", margin: "10px 0" }}>{file.name}</p>
            <p style={{ color: "#666" }}>{formatFileSize(file.size)}</p>
          </div>
        )}
      </div>

      {processing && (
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
          <p style={{ textAlign: "center", color: "#666", marginTop: "8px" }}>
            Processing... {Math.round(progress)}%
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "6px",
            color: "#c33",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {extractedText && !processing && (
        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              backgroundColor: "#f0f7ff",
              borderRadius: "8px 8px 0 0",
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            <h4 style={{ margin: 0 }}>📝 Extracted Text</h4>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {stats.pages} pages · {stats.textPages} text · {stats.ocrPages}{" "}
              OCR
            </div>
          </div>
          <div
            style={{
              maxHeight: "400px",
              overflow: "auto",
              padding: "16px",
              backgroundColor: "#fafafa",
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
              {extractedText.substring(0, 2000)}
              {extractedText.length > 2000 && "... (truncated)"}
            </pre>
          </div>
          <button
            onClick={() => {
              const blob = new Blob([extractedText], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${file.name.replace(".pdf", "")}_extracted_text.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{
              marginTop: "12px",
              padding: "10px 20px",
              backgroundColor: "#4a90d9",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              width: "100%",
              fontSize: "16px",
            }}
          >
            💾 Download Text
          </button>
        </div>
      )}
    </div>
  );
};

export default UnlimitedPDFProcessor;
