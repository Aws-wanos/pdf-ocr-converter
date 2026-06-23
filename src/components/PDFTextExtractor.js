// PDFTextExtractor.js - Complete fixed version with proper text extraction and quality detection
import React, { useState, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { createWorker } from "tesseract.js";

// Dynamic version matching to prevent crashes
const PDFJS_VERSION = pdfjsLib.version || "3.11.174";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

const PDFTextExtractor = ({ onTextExtracted, maxSizeMB = 0 }) => {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [extractionMethod, setExtractionMethod] = useState("auto");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [debugInfo, setDebugInfo] = useState("");
  const [qualityWarning, setQualityWarning] = useState(null);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const validateFile = (selectedFile) => {
    if (!selectedFile) {
      setError("No file selected");
      return false;
    }

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

  // ====== CHECK TEXT QUALITY ======
  const checkTextQuality = (text) => {
    if (!text || text.length < 50) {
      return {
        isPoor: true,
        message:
          "⚠️ Very little text was extracted. This might be a scanned image.",
        suggestion: "Try using the 'OCR' method for image-based PDFs.",
      };
    }

    // Check for common OCR artifacts
    const splitWordPattern = /[a-zA-Z]\s+[a-zA-Z]/g;
    const splitWordMatches = text.match(splitWordPattern) || [];

    // Check for excessive spaces
    const excessiveSpaces = (text.match(/\s{2,}/g) || []).length;

    // Check for weird punctuation
    const weirdPunctuation = (text.match(/['"]\s+[a-zA-Z]/g) || []).length;

    // Calculate quality score (lower = worse)
    let qualityScore = 100;

    // Each split word reduces quality
    qualityScore -= splitWordMatches.length * 2;

    // Excessive spaces reduce quality
    qualityScore -= excessiveSpaces * 0.5;

    // Weird punctuation reduces quality
    qualityScore -= weirdPunctuation * 1;

    // Check if text looks like gibberish (too many random characters)
    const gibberishPattern = /[^a-zA-Z0-9\s.,!?;:'"]/g;
    const gibberishMatches = (text.match(gibberishPattern) || []).length;
    qualityScore -= gibberishMatches * 0.5;

    // Check for too many single letters (OCR artifact)
    const singleLetters = (text.match(/\s[a-zA-Z]\s/g) || []).length;
    qualityScore -= singleLetters * 1;

    // Determine quality level
    if (qualityScore > 70) {
      return {
        isPoor: false,
        message: null,
        suggestion: null,
        score: qualityScore,
      };
    } else if (qualityScore > 40) {
      return {
        isPoor: true,
        message:
          "⚠️ The extracted text has some quality issues. It might not be a standard text-based PDF.",
        suggestion: "Try using the 'OCR' method for better results.",
        score: qualityScore,
      };
    } else {
      return {
        isPoor: true,
        message:
          "⚠️ Poor text quality detected. Your PDF may be scanned or contain images instead of text.",
        suggestion:
          "Switch to 'OCR' method which works better for scanned documents.",
        score: qualityScore,
      };
    }
  };

  // ====== ENHANCED OCR TEXT CLEANUP WITH RECURSIVE FIXES ======
  const cleanOcrText = useCallback((text, method = "native") => {
    if (!text) return "";

    let cleaned = text;

    // 1. Fix single letters trapped between spaces (e.g., "p sychology" -> "psychology")
    cleaned = cleaned.replace(/(\b[a-zA-Z])\s+(?=[a-zA-Z]\b)/g, "$1");

    // 2. Fix letter pairs that got split
    cleaned = cleaned.replace(/([a-zA-Z])\s+([a-zA-Z])/g, (match, p1, p2) => {
      const combined = p1 + p2;
      const commonFragments = [
        "ps",
        "de",
        "re",
        "co",
        "en",
        "ab",
        "th",
        "st",
        "tr",
        "pr",
        "ph",
        "ch",
        "sh",
        "wh",
        "qu",
        "br",
        "cr",
        "dr",
        "fr",
        "gr",
        "kl",
        "pl",
        "sc",
        "sk",
        "sm",
        "sn",
        "sp",
        "sq",
        "sw",
        "tw",
      ];
      if (commonFragments.includes(combined.toLowerCase())) {
        return combined;
      }
      return match;
    });

    // 2.5 Fix letter pairs that got split (repeated pass)
    for (let i = 0; i < 3; i++) {
      cleaned = cleaned.replace(/([a-zA-Z])\s+([a-zA-Z])/g, (match, p1, p2) => {
        const combined = p1 + p2;
        // If the combined word looks like a real word fragment
        if (combined.length === 2 && /[aeiou]/i.test(combined) === false) {
          return combined;
        }
        return match;
      });
    }

    // 3. Comprehensive dictionary of split word fixes
    const splitWordFixes = {
      // Psychology terms
      "p sychology": "psychology",
      "p sycho": "psycho",
      "p sychic": "psychic",
      "p sychologist": "psychologist",
      "p sychiatry": "psychiatry",
      "p sychological": "psychological",
      "p sychologically": "psychologically",
      "p sychoanalysis": "psychoanalysis",

      // Common OCR errors - letters with spaces
      "r ecogni": "recogni",
      "r ecognis": "recognis",
      "r ecogniz": "recogniz",
      "r ecognised": "recognised",
      "r ecognized": "recognized",
      "r ecognising": "recognising",
      "r ecognizing": "recognizing",
      "d evelop": "develop",
      "d eveloped": "developed",
      "d eveloping": "developing",
      "u sual": "usual",
      "u sually": "usually",
      "s ituat": "situat",
      "s ituation": "situation",
      "s ituations": "situations",
      "b odies": "bodies",
      "b ody": "body",
      "r eleas": "releas",
      "r eleasing": "releasing",
      "a nd": "and",
      "c ortisol": "cortisol",
      "e nhance": "enhance",
      "a bilities": "abilities",
      "a bility": "ability",
      "t hink": "think",
      "t hinking": "thinking",
      "s trength": "strength",
      "w ell": "well",
      "s tart": "start",
      "m ixing": "mixing",
      "a nimal": "animal",
      "a nimals": "animals",
      "i nterview": "interview",
      "a nxiety": "anxiety",
      "l earn": "learn",
      "l earned": "learned",
      "l earning": "learning",
      "r egulate": "regulate",
      "r egulating": "regulating",
      "d aily": "daily",
      "l osing": "losing",
      "r ealize": "realize",
      "r ealizing": "realizing",
      "m editation": "meditation",
      "a drenaline": "adrenaline",
      "s urvival": "survival",
      "a ssociated": "associated",
      "e xists": "exists",
      "p rotect": "protect",
      "p rotecting": "protecting",
      "r eact": "react",
      "r eacting": "reacting",
      "d ifferently": "differently",
      "c reating": "creating",
      "e motions": "emotions",
      "e motion": "emotion",
      "e volution": "evolution",
      "p hobia": "phobia",
      "i rrational": "irrational",
      "t hreatening": "threatening",
      "r esponse": "response",
      "r eaction": "reaction",
      "f eeling": "feeling",
      "f eelings": "feelings",
      "p atterns": "patterns",
      "e volved": "evolved",
      "t housands": "thousands",
      "e xample": "example",
      "e xamples": "examples",
      "h eights": "heights",
      "s cares": "scares",
      "s cared": "scared",
      "a ffects": "affects",
      "e ffect": "effect",
      "e ffects": "effects",
      "r eally": "really",
      "c ertain": "certain",
      "c ertainly": "certainly",
      "d ecide": "decide",
      "d ecided": "decided",
      "d ecision": "decision",
      "r esult": "result",
      "r esults": "results",
      "b ecause": "because",
      "b ecome": "become",
      "b ecoming": "becoming",
      "k now": "know",
      "k nowledge": "knowledge",
      "p eople": "people",
      "a nother": "another",
      "t ogether": "together",
      "t oday": "today",
      "t omorrow": "tomorrow",
      "y esterday": "yesterday",
      "m oment": "moment",
      "m oments": "moments",
      "s omething": "something",
      "s omeone": "someone",
      "s omebody": "somebody",
      "e very": "every",
      "e veryone": "everyone",
      "e verybody": "everybody",
      "e verything": "everything",
      "t hrough": "through",
      "t hough": "though",
      "t hought": "thought",
      "b elieve": "believe",
      "b elieved": "believed",
      "b elief": "belief",
      "regu late": "regulate",
      "cortiso l": "cortisol",
      "enhan ce": "enhance",
      "fe el": "feel",
      "thi nk": "think",
      "stre ngth": "strength",
      "anxi ety": "anxiety",
      "medi tation": "meditation",
      "real ize": "realize",
      "los ing": "losing",
      withing: "within",
      "bo dies": "bodies",
      "re leasing": "releasing",
      "te chniques": "techniques",
      "mind fulness": "mindfulness",
      "pani c": "panic",
      "attac k": "attack",
    };

    // Apply split word fixes
    Object.entries(splitWordFixes).forEach(([errorWord, correctWord]) => {
      const safeRegexStr = errorWord.replace(/ /g, "\\s+");
      const regex = new RegExp(safeRegexStr, "gi");
      cleaned = cleaned.replace(regex, correctWord);
    });

    // 4. Fix common two-letter split words
    const twoLetterFixes = {
      "i t": "it",
      "i s": "is",
      "a re": "are",
      "w as": "was",
      "w ere": "were",
      "h as": "has",
      "h ave": "have",
      "d oes": "does",
      "d id": "did",
      "c an": "can",
      "m ay": "may",
      "m ust": "must",
      "w ould": "would",
      "c ould": "could",
      "s hould": "should",
      "m ight": "might",
      "w ill": "will",
      "s hall": "shall",
      "t hat": "that",
      "t his": "this",
      "t hese": "these",
      "t hose": "those",
      "t here": "there",
      "t hey": "they",
      "t hem": "them",
      "t heir": "their",
      "t he": "the",
      "y ou": "you",
      "y our": "your",
      "w e": "we",
      "o ur": "our",
      "m e": "me",
      "h er": "her",
      "h im": "him",
      "u s": "us",
      "t hen": "then",
      "t han": "than",
      "s o": "so",
      "b ut": "but",
      "f or": "for",
      "f rom": "from",
      "w ith": "with",
      "w ithout": "without",
      "a bout": "about",
      "a cross": "across",
      "a long": "along",
      "a mong": "among",
      "a round": "around",
      "b ehind": "behind",
      "b elow": "below",
      "b eside": "beside",
      "b eyond": "beyond",
      "i nside": "inside",
      "o utside": "outside",
      "u nder": "under",
      "u pon": "upon",
      "t oward": "toward",
      "u ntil": "until",
      "w here": "where",
      "w hen": "when",
      "w hy": "why",
      "w ho": "who",
      "w hom": "whom",
      "w hich": "which",
      "w hat": "what",
    };

    Object.entries(twoLetterFixes).forEach(([errorWord, correctWord]) => {
      const safeRegexStr = errorWord.replace(/ /g, "\\s+");
      const regex = new RegExp(safeRegexStr, "gi");
      cleaned = cleaned.replace(regex, correctWord);
    });

    // 5. Fix punctuation spacing
    cleaned = cleaned
      .replace(/\s+\./g, ".")
      .replace(/\s+,/g, ",")
      .replace(/\s+\?/g, "?")
      .replace(/\s+\!/g, "!")
      .replace(/\s+;/g, ";")
      .replace(/\s+:/g, ":")
      .replace(/\s+’/g, "’")
      .replace(/\s+"/g, '"')
      .replace(/\s+'/g, "'")
      .replace(/\s+—/g, " —")
      .replace(/—\s+/g, "— ");

    // 6. Fix apostrophes and quotes
    cleaned = cleaned
      .replace(/‘/g, "'")
      .replace(/’/g, "'")
      .replace(/“/g, '"')
      .replace(/”/g, '"')
      .replace(/``/g, '"')
      .replace(/''/g, '"');

    // 7. Remove extra spaces
    cleaned = cleaned.replace(/\s+/g, " ");

    // 8. Final cleanup
    cleaned = cleaned.replace(/  +/g, " ").trim();

    return cleaned;
  }, []);

  // ====== EXTRACT TEXT WITH COORDINATE-AWARE PROCESSING ======
  const extractText = useCallback(async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    abortControllerRef.current = new AbortController();
    setIsProcessing(true);
    setError("");
    setExtractedText("");
    setProgress(0);
    setCurrentPage(0);
    setPageCount(0);
    setDebugInfo("");
    setQualityWarning(null);

    let worker = null;

    try {
      if (extractionMethod === "auto" || extractionMethod === "ocr") {
        worker = await createWorker("eng+spa+fra+deu+rus");
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      setPageCount(totalPages);

      let fullText = "";
      let textPages = 0;
      let ocrPages = 0;
      let extractionMode = "native";

      for (let i = 1; i <= totalPages; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error("Extraction cancelled");
        }

        setCurrentPage(i);
        setProgress(Math.round((i / totalPages) * 50));

        const page = await pdf.getPage(i);

        // Coordinate-aware text extraction
        const textContent = await page.getTextContent();
        let pageText = "";
        let lastX = 0;
        let lastY = 0;
        let lineY = 0;

        const lines = {};
        textContent.items.forEach((item) => {
          const y = Math.round(item.transform[5]);
          if (!lines[y]) lines[y] = [];
          lines[y].push(item);
        });

        Object.keys(lines)
          .sort((a, b) => a - b)
          .forEach((y) => {
            const items = lines[y].sort(
              (a, b) => a.transform[4] - b.transform[4],
            );
            let lineText = "";
            let lastX = 0;

            items.forEach((item) => {
              const currentX = item.transform[4];
              const gap = currentX - lastX;

              if (lastX === 0) {
                lineText += item.str;
              } else if (gap < 2) {
                lineText += item.str;
              } else if (gap < 10) {
                lineText += " " + item.str;
              } else {
                lineText += " " + item.str;
              }

              lastX = currentX + (item.width || 0);
            });

            pageText += lineText + "\n";
          });

        const nativeText = pageText.trim();
        let extractedPageText = "";

        if (nativeText.length > 50 || extractionMethod === "native") {
          extractedPageText = nativeText;
          textPages++;
          extractionMode = "native";
        } else if (extractionMethod === "auto" || extractionMethod === "ocr") {
          ocrPages++;
          extractionMode = "ocr";

          const viewport = page.getViewport({ scale: 3.0 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          context.fillStyle = "white";
          context.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({ canvasContext: context, viewport }).promise;

          if (worker) {
            const result = await worker.recognize(canvas);
            extractedPageText = result.data.text || "";
          }
        }

        const cleanedPageText = cleanOcrText(
          extractedPageText || nativeText,
          extractionMode,
        );

        if (cleanedPageText.trim()) {
          fullText += `Page ${i}:\n${cleanedPageText}\n\n`;
        }
      }

      const finalCleanedText = cleanOcrText(fullText, extractionMode);

      setExtractedText(
        finalCleanedText || "No text could be extracted from this PDF.",
      );
      setProgress(100);
      setDebugInfo(
        `Extracted using: ${extractionMode} | Text pages: ${textPages} | OCR pages: ${ocrPages}`,
      );

      // ====== CHECK QUALITY AND SHOW WARNING ======
      const qualityResult = checkTextQuality(finalCleanedText);
      if (qualityResult.isPoor) {
        setQualityWarning({
          message: qualityResult.message,
          suggestion: qualityResult.suggestion,
        });
      }

      if (onTextExtracted) {
        onTextExtracted(finalCleanedText, extractionMethod);
      }
    } catch (error) {
      console.error("Extraction error:", error);
      if (error.message === "Extraction cancelled") {
        setError("Extraction was cancelled");
      } else {
        setError("Extraction failed: " + error.message);
      }
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          console.warn("Error terminating worker:", e);
        }
      }
      setIsProcessing(false);
    }
  }, [file, extractionMethod, cleanOcrText, onTextExtracted]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
      setError("");
      setExtractedText("");
      setDebugInfo("");
      setQualityWarning(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
      setError("");
      setExtractedText("");
      setDebugInfo("");
      setQualityWarning(null);
    }
  };

  const removeFile = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setFile(null);
    setExtractedText("");
    setError("");
    setProgress(0);
    setCurrentPage(0);
    setPageCount(0);
    setDebugInfo("");
    setQualityWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(extractedText)
      .then(() => alert("Text copied to clipboard!"))
      .catch(() => alert("Failed to copy text"));
  };

  const downloadText = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file ? file.name.replace(".pdf", "") : "extracted"}_text.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
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
            <p style={{ color: "#666" }}>{formatFileSize(file.size)}</p>
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

      {/* Controls */}
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
            <option value="native">Native Text Only (Fast)</option>
            <option value="ocr">OCR (For images)</option>
          </select>

          <button
            onClick={extractText}
            disabled={isProcessing}
            style={{
              marginTop: "12px",
              padding: "12px 24px",
              background: isProcessing ? "#ccc" : "#4a90d9",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: isProcessing ? "not-allowed" : "pointer",
              width: "100%",
              transition: "background 0.3s",
            }}
          >
            {isProcessing ? "Processing..." : "📝 Extract Text"}
          </button>
        </div>
      )}

      {/* Cancel Button */}
      {isProcessing && (
        <button
          onClick={() => {
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
          }}
          style={{
            marginTop: "10px",
            padding: "8px 16px",
            background: "#ff6b6b",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Cancel Extraction
        </button>
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
                Processing page {currentPage} of {pageCount} ({progress}%)
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

      {/* ====== QUALITY WARNING ====== */}
      {qualityWarning && (
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "8px",
            color: "#856404",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}
          >
            <span style={{ fontSize: "24px" }}>⚠️</span>
            <div>
              <p style={{ margin: "0 0 8px 0", fontWeight: "bold" }}>
                {qualityWarning.message}
              </p>
              <p style={{ margin: "0", fontSize: "14px" }}>
                💡 {qualityWarning.suggestion}
              </p>
              <div style={{ marginTop: "12px" }}>
                <button
                  onClick={() => {
                    setExtractionMethod("ocr");
                    setQualityWarning(null);
                    extractText();
                  }}
                  style={{
                    padding: "6px 16px",
                    background: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  🔄 Retry with OCR
                </button>
                <button
                  onClick={() => setQualityWarning(null)}
                  style={{
                    marginLeft: "8px",
                    padding: "6px 16px",
                    background: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {debugInfo && (
        <div
          style={{
            marginTop: "8px",
            padding: "8px",
            backgroundColor: "#f0f7ff",
            borderRadius: "4px",
            fontSize: "12px",
            color: "#666",
          }}
        >
          🔍 {debugInfo}
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
