// src/services/aiService.js
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ====== DETECT LANGUAGE ======
export const detectLanguage = async (text) => {
  try {
    console.log("🔍 Detecting language...");
    const sample = text.substring(0, 1000);

    // First try to use the backend
    try {
      const response = await axios.post(
        `${API_URL}/detect-language`,
        { text: sample },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        },
      );
      return response.data.language || "English";
    } catch (backendError) {
      console.warn(
        "Backend language detection failed, using client-side detection:",
        backendError.message,
      );
      // Fallback to client-side detection
      return detectLanguageClientSide(sample);
    }
  } catch (error) {
    console.warn("Language detection failed:", error);
    return "English";
  }
};

// ====== CLIENT-SIDE LANGUAGE DETECTION (Fallback) ======
const detectLanguageClientSide = (text) => {
  // Common language patterns
  const patterns = {
    English: /[a-zA-Z]/,
    Spanish: /[áéíóúñ¿¡]/i,
    French: /[àâçéèêëîïôûùüÿñæœ]/i,
    German: /[äöüß]/i,
    Russian: /[а-яА-Я]/,
    Japanese: /[ぁ-ゟ゠-ヿ]/,
    Chinese: /[\u4e00-\u9fa5]/,
    Korean: /[가-힣]/,
    Arabic: /[\u0600-\u06FF]/,
    Italian: /[àèéìíîòóùú]/i,
    Portuguese: /[ãõáéíóúâêîôûàç]/i,
    Dutch: /[ij]/i,
  };

  // Count matches for each language
  const scores = {};
  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern);
    if (matches) {
      scores[lang] = matches.length;
    }
  }

  // Find the language with the most matches
  let bestLang = "English";
  let bestScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  console.log(`🌐 Detected language: ${bestLang} (${bestScore} matches)`);
  return bestLang;
};

// ====== GENERATE UNITS ======
export const generateUnits = async (text, language) => {
  try {
    console.log(`📚 Sending request to: ${API_URL}/generate`);
    console.log(`📄 Text length: ${text.length} characters`);
    console.log(`🌐 Target language: ${language}`);

    const response = await axios.post(
      `${API_URL}/generate`,
      {
        text,
        language,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 120000,
      },
    );

    console.log("✅ Response received:", response.data);

    if (!response.data.success) {
      throw new Error(response.data.error || "Failed to generate course");
    }

    return response.data.data;
  } catch (error) {
    console.error("❌ API Error Details:");
    console.error("  Message:", error.message);
    console.error("  Code:", error.code);

    if (error.response) {
      console.error("  Response Status:", error.response.status);
      console.error("  Response Data:", error.response.data);
      throw new Error(
        error.response.data?.error || `Server error: ${error.response.status}`,
      );
    }

    if (error.request) {
      console.error("  No response received from server");
      throw new Error(
        "Cannot reach server. Please make sure the backend is running on port 5000.",
      );
    }

    throw new Error(error.message || "Failed to generate course");
  }
};

// ====== TEST BACKEND CONNECTION ======
export const testBackendConnection = async () => {
  try {
    const response = await axios.get(`${API_URL}/health`, {
      timeout: 5000,
    });
    console.log("✅ Backend connection test successful:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Backend connection test failed:", error.message);
    return {
      status: "error",
      error: error.message,
      details: error.code || "Unknown error",
    };
  }
};
