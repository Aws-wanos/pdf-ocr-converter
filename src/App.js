// ============================================================
// ⚠️ IMPORTANT: This app works best with Google Chrome
// ============================================================
// For the best experience with Text-to-Speech and PDF processing:
//
// ✅ RECOMMENDED: Google Chrome (latest version)
//    - Full TTS support with all voices
//    - Best performance for PDF processing
//    - Smooth chunk-based audio playback
//
// ⚠️ PARTIAL SUPPORT: Microsoft Edge, Brave, Opera
//    - TTS works but may have limited voices
//    - Some features may work differently
//
// ❌ NOT RECOMMENDED: Firefox, Safari
//    - Limited TTS support
//    - May experience issues with speech synthesis
//    - Some PDF features may not work correctly
//
// 💡 If you're having issues:
//    1. Switch to Google Chrome
//    2. Make sure your browser is up to date
//    3. Check that your browser supports Web Speech API
// ============================================================

import React, { useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";
import Tesseract from "tesseract.js";
import TextToSpeech from "./components/TextToSpeech";
import LanguageTeacher from "./components/LanguageTeacher";

// ============================================================
// PDF.js Worker Configuration
// ============================================================
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

function App() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [ocrMode, setOcrMode] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [error, setError] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [stats, setStats] = useState({
    textPages: 0,
    ocrPages: 0,
    totalChars: 0,
  });
  const [activeTab, setActiveTab] = useState("ocr");
  const fileInputRef = useRef(null);

  // ============================================================
  // PROCESS PDF (OCR + Create New PDF)
  // ============================================================
  const processPDF = async (fileInput) => {
    let fileToProcess = fileInput;

    if (
      fileToProcess &&
      typeof fileToProcess === "object" &&
      !(fileToProcess instanceof File)
    ) {
      if (fileToProcess.file) {
        fileToProcess = fileToProcess.file;
      } else if (fileToProcess.originalName) {
        setError("Please upload the file again");
        return;
      }
    }

    if (!(fileToProcess instanceof File)) {
      if (file instanceof File) {
        fileToProcess = file;
      } else {
        setError("Invalid file object. Please upload again.");
        return;
      }
    }

    setIsProcessing(true);
    setError(null);
    setDownloadReady(false);
    setProgress(0);
    setCurrentPage(0);
    setExtractedText("");
    setStats({ textPages: 0, ocrPages: 0, totalChars: 0 });

    try {
      const arrayBuffer = await fileToProcess.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      setTotalPages(totalPages);

      const newPdf = new jsPDF({
        unit: "pt",
        format: "a4",
        compress: true,
      });

      let textPages = 0;
      let ocrPages = 0;
      let totalChars = 0;
      let fullText = "";

      for (let i = 1; i <= totalPages; i++) {
        setCurrentPage(i);
        setProgress(Math.round((i / totalPages) * 100));

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");

        let extractedText = "";

        if (pageText.trim().length > 50) {
          extractedText = pageText;
          textPages++;
        } else {
          setOcrMode(true);
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport }).promise;
          const imageData = canvas.toDataURL("image/png");

          const result = await Tesseract.recognize(
            imageData,
            "eng+rus+deu+spa+fra",
            {
              logger: (m) => {
                if (m.status === "recognizing text") {
                  const pageProgress = ((i - 1) / totalPages) * 100;
                  setProgress(
                    Math.round(pageProgress + (m.progress * 100) / totalPages),
                  );
                }
              },
            },
          );

          extractedText = result.data.text || "";
          ocrPages++;
        }

        totalChars += extractedText.length;
        fullText += `Page ${i}:\n${extractedText}\n\n`;

        if (i > 1) newPdf.addPage();

        const lines = extractedText.split("\n").filter((line) => line.trim());
        let y = 40;
        const margin = 40;
        const maxWidth = viewport.width - margin * 2;
        const lineHeight = 14;

        newPdf.setFontSize(11);
        newPdf.setTextColor(0, 0, 0);

        for (const line of lines) {
          const wrapped = newPdf.splitTextToSize(line, maxWidth);
          for (const segment of wrapped) {
            if (y > viewport.height - 40) {
              newPdf.addPage();
              y = 40;
            }
            newPdf.text(segment, margin, y);
            y += lineHeight;
          }
        }

        setProgress(Math.round((i / totalPages) * 100));
        setOcrMode(false);
      }

      const pdfOutput = newPdf.output("blob");
      setPdfBlob(pdfOutput);
      setDownloadReady(true);
      setExtractedText(fullText);
      setStats({ textPages, ocrPages, totalChars });

      console.log(
        `✅ PDF created: ${totalPages} pages, ${textPages} text, ${ocrPages} OCR`,
      );
    } catch (err) {
      console.error("❌ Error:", err);
      setError("Failed to process PDF: " + err.message);
    } finally {
      setIsProcessing(false);
      setOcrMode(false);
    }
  };

  // ============================================================
  // EXTRACT TEXT ONLY
  // ============================================================
  const extractTextOnly = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setIsProcessing(true);
    setError("");
    setExtractedText("");
    setProgress(0);
    setCurrentPage(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      setTotalPages(totalPages);

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
      setStats({ textPages, ocrPages, totalChars: fullText.length });
    } catch (error) {
      console.error("Extraction error:", error);
      setError("Extraction failed: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================
  // HANDLER FUNCTIONS
  // ============================================================
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFile(file);
    setFileName(file.name);
    setError(null);
    setExtractedText("");
    setDownloadReady(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setFile(file);
    setFileName(file.name);
    setError(null);
    setExtractedText("");
    setDownloadReady(false);
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `text_${fileName}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const resetAll = () => {
    setFile(null);
    setFileName("");
    setDownloadReady(false);
    setPdfBlob(null);
    setError(null);
    setProgress(0);
    setExtractedText("");
    setStats({ textPages: 0, ocrPages: 0, totalChars: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    a.download = `${fileName.replace(".pdf", "")}_extracted_text.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ============================================================
          HEADER
          ============================================================ */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-3xl font-bold">📄 PDF OCR & Reader</h1>
              <p className="text-sm opacity-90">
                Convert scanned PDFs to searchable text and read aloud
              </p>
            </div>
            {/* Browser Compatibility Badge */}
            <div className="hidden sm:block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <span>🌐 Best on</span>
                <span className="font-bold text-yellow-300">Chrome</span>
                <span className="text-xs opacity-75">|</span>
                <span className="text-xs opacity-75">
                  ⚠️ Firefox/Safari limited
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================
          STATUS BANNERS
          ============================================================ */}

      {/* AI Teacher Status Banner */}
      <div className="container mx-auto max-w-4xl px-4 mt-4">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-2xl">🤖</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 font-medium">
                👨‍🏫 AI Language Teacher: Coming Soon!
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                The AI Teacher feature is currently being upgraded. We're
                working on making it even better! In the meantime, you can still
                use OCR, Extract Text, and Read Aloud features.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                  🚀 New AI models coming soon
                </span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                  ⚡ Faster lesson generation
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OCR Processing Info Banner */}
      <div className="container mx-auto max-w-4xl px-4 mt-4">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-2xl">📖</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700 font-medium">
                ⏱️ Image-Based PDF Processing
              </p>
              <p className="text-xs text-blue-600 mt-1">
                If your PDF contains images (scanned pages), OCR processing may
                take 30-60 seconds per page. Please be patient while we extract
                the text.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  🖼️ Scanned PDFs take longer
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  📄 Text PDFs process quickly
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  💡 Progress bar shows status
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          BROWSER WARNING BANNER
          ============================================================ */}
      {!window.chrome && (
        <div className="container mx-auto max-w-4xl px-4 mt-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 font-medium">
                  For the best experience, please use Google Chrome
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  You're currently using a browser with limited Text-to-Speech
                  support. Some features may not work correctly.
                </p>
                <div className="mt-2 flex gap-2">
                  <a
                    href="https://www.google.com/chrome/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded transition-colors"
                  >
                    Download Chrome
                  </a>
                  <button
                    onClick={() =>
                      document.querySelector(".browser-warning")?.remove()
                    }
                    className="text-xs text-yellow-600 hover:text-yellow-800 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MAIN CONTENT
          ============================================================ */}
      <main className="container mx-auto max-w-4xl p-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* File Upload Area */}
          {!file ? (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-purple-500 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-gray-600 mt-4">
                Drag & drop a PDF here, or click to browse
              </p>
              <p className="text-sm text-gray-400">
                Supports scanned PDFs, images, and text PDFs • No size limit
              </p>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
                <span>✅ Chrome (Best)</span>
                <span>⚠️ Firefox (Limited)</span>
                <span>⚠️ Safari (Limited)</span>
              </div>
            </div>
          ) : (
            /* File Info & Actions */
            <div className="mt-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📄</span>
                  <div>
                    <p className="font-medium text-gray-800">{fileName}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetAll}
                  className="text-red-500 hover:text-red-700 font-medium"
                  disabled={isProcessing}
                >
                  Remove
                </button>
              </div>

              {/* Tab Selection */}
              <div className="mt-4 flex gap-2 border-b border-gray-200 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("ocr")}
                  className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                    activeTab === "ocr"
                      ? "text-purple-600 border-b-2 border-purple-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🔄 OCR & Create PDF
                </button>
                <button
                  onClick={() => setActiveTab("extract")}
                  className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                    activeTab === "extract"
                      ? "text-purple-600 border-b-2 border-purple-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  📝 Extract Text
                </button>
                <button
                  onClick={() => setActiveTab("read")}
                  className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                    activeTab === "read"
                      ? "text-purple-600 border-b-2 border-purple-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🔊 Read Aloud
                </button>
                <button
                  onClick={() => setActiveTab("teacher")}
                  className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                    activeTab === "teacher"
                      ? "text-purple-600 border-b-2 border-purple-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  👨‍🏫 Language Teacher
                </button>
              </div>

              {/* Action Buttons based on tab */}
              <div className="mt-4">
                {activeTab === "ocr" && !isProcessing && !downloadReady && (
                  <button
                    onClick={() => processPDF(file)}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  >
                    🔄 Convert to Text PDF
                  </button>
                )}

                {activeTab === "extract" && !isProcessing && !extractedText && (
                  <button
                    onClick={extractTextOnly}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    📝 Extract Text
                  </button>
                )}

                {activeTab === "read" && extractedText && (
                  <TextToSpeech text={extractedText} fileName={fileName} />
                )}

                {activeTab === "read" && !extractedText && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-lg">📖 No text to read</p>
                    <p className="text-sm">
                      Please extract text first using the "Extract Text" tab
                    </p>
                    <button
                      onClick={() => setActiveTab("extract")}
                      className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Go to Extract Text
                    </button>
                  </div>
                )}

                {activeTab === "teacher" && (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">👨‍🏫</div>
                    <p className="text-xl font-medium text-gray-700">
                      AI Language Teacher
                    </p>
                    <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                      🚀 We're upgrading our AI to bring you better lessons!
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      The AI Teacher feature will be available soon with
                      improved lesson generation.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                        📚 Coming soon
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                        ⚡ Faster & smarter
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                        🎯 Better lessons
                      </span>
                    </div>
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg max-w-md mx-auto">
                      <p className="text-xs text-gray-500">
                        💡 Tip: You can still use <strong>Read Aloud</strong> to
                        listen to your text and <strong>OCR</strong> to convert
                        scanned PDFs!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Processing Status */}
          {isProcessing && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>
                  {ocrMode
                    ? `🔍 OCR Page ${currentPage}/${totalPages}`
                    : `📄 Processing ${currentPage}/${totalPages}`}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              {ocrMode && (
                <p className="text-xs text-yellow-500 mt-1">
                  ⚠️ OCR mode: Converting image to text on page {currentPage}
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error}
              <button onClick={resetAll} className="ml-2 text-sm underline">
                Try Again
              </button>
            </div>
          )}

          {/* OCR Results - Download PDF */}
          {!isProcessing && file && !error && downloadReady && (
            <div className="mt-6">
              <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="font-medium text-gray-800">{fileName}</p>
                    <p className="text-sm text-gray-600">
                      {stats.textPages} text pages · {stats.ocrPages} OCR pages
                      · {stats.totalChars.toLocaleString()} characters
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownload}
                  className="mt-4 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  ⬇️ Download Text PDF
                </button>

                <button
                  onClick={() => {
                    setDownloadReady(false);
                    setActiveTab("read");
                  }}
                  className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  🔊 Read Aloud
                </button>

                <button
                  onClick={resetAll}
                  className="mt-2 w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition-colors"
                >
                  📄 Process Another PDF
                </button>
              </div>
            </div>
          )}

          {/* Extract Text Results */}
          {!isProcessing &&
            file &&
            !error &&
            extractedText &&
            !downloadReady &&
            activeTab === "extract" && (
              <div className="mt-6">
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-800">
                        📝 Extracted Text
                      </p>
                      <p className="text-sm text-gray-600">
                        {stats.textPages} text pages · {stats.ocrPages} OCR
                        pages · {stats.totalChars.toLocaleString()} characters
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={copyToClipboard}
                        className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={downloadText}
                        className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        💾 Download
                      </button>
                      <button
                        onClick={() => setActiveTab("read")}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                      >
                        🔊 Read Aloud
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {extractedText.length > 3000
                        ? extractedText.substring(0, 3000) +
                          "\n\n... (truncated)"
                        : extractedText}
                    </pre>
                  </div>
                  <button
                    onClick={resetAll}
                    className="mt-4 w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition-colors"
                  >
                    📄 Process Another PDF
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* ============================================================
            INFO SECTION
            ============================================================ */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-600">
          <p className="font-medium text-blue-800">💡 How it works:</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
            <div>
              <p className="font-medium">🔄 OCR & Create PDF</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Extracts text from PDF</li>
                <li>Runs OCR on image-based pages</li>
                <li>Creates a new searchable PDF</li>
                <li>Download the text-based PDF</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">📝 Extract Text Only</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Extracts text from PDF</li>
                <li>Runs OCR on image-based pages</li>
                <li>Shows extracted text preview</li>
                <li>Copy or download as .txt file</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">🔊 Read Aloud</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Select page range to read</li>
                <li>Choose from 20+ languages</li>
                <li>Adjust speed, pitch, volume</li>
                <li>⚠️ Best on Google Chrome</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">👨‍🏫 Language Teacher</p>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>🚀 Coming soon with new AI</li>
                <li>📚 Better lesson generation</li>
                <li>⚡ Faster processing</li>
                <li>🎯 More accurate vocabulary</li>
              </ul>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-gray-400 flex items-center justify-between">
            <span>🌐 Built with Web Speech API & Tesseract OCR</span>
            <span>✅ Chrome recommended • ⚠️ Firefox/Safari limited</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
