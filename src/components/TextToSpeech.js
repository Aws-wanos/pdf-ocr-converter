// src/components/TextToSpeech.js - Fixed with Pronunciation Improvements
import React, { useState, useEffect, useCallback, useRef } from "react";

const TextToSpeech = ({ text, fileName }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [speechRate, setSpeechRate] = useState(1);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [showContinue, setShowContinue] = useState(false);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [processedText, setProcessedText] = useState("");
  const [audioInitialized, setAudioInitialized] = useState(false);

  const isMountedRef = useRef(true);
  const isSpeakingRef = useRef(false);
  const speechQueueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const audioContextRef = useRef(null);
  const currentVoiceRef = useRef(null);
  const timeoutRef = useRef(null);
  const utteranceRef = useRef(null);

  const MAX_CHUNK = 1500; // Balanced for performance
  const DELAY_BETWEEN_CHUNKS = 300;

  // Available languages
  const languages = [
    { code: "en-US", name: "English (US)" },
    { code: "en-GB", name: "English (UK)" },
    { code: "es-ES", name: "Spanish" },
    { code: "fr-FR", name: "French" },
    { code: "de-DE", name: "German" },
    { code: "it-IT", name: "Italian" },
    { code: "pt-PT", name: "Portuguese" },
    { code: "ru-RU", name: "Russian" },
    { code: "ja-JP", name: "Japanese" },
    { code: "ko-KR", name: "Korean" },
    { code: "zh-CN", name: "Chinese (Simplified)" },
    { code: "ar-SA", name: "Arabic" },
    { code: "hi-IN", name: "Hindi" },
    { code: "nl-NL", name: "Dutch" },
    { code: "pl-PL", name: "Polish" },
    { code: "tr-TR", name: "Turkish" },
    { code: "vi-VN", name: "Vietnamese" },
    { code: "th-TH", name: "Thai" },
    { code: "id-ID", name: "Indonesian" },
    { code: "ms-MY", name: "Malay" },
  ];

  // ====== PRONUNCIATION FIXES ======
  const pronunciationFixes = {
    // Silent letters - Psychology words
    psychology: "sy-kol-uh-jee",
    psycho: "sy-ko",
    psychic: "sy-kik",
    psychologist: "sy-kol-uh-jist",
    psychiatry: "sy-ky-uh-tree",
    psychiatric: "sy-ky-at-rik",
    psychoanalysis: "sy-ko-uh-nal-uh-sis",

    // Silent P
    pneumonia: "noo-moh-nyuh",
    pneumatic: "noo-mat-ik",
    pterodactyl: "ter-uh-dak-til",
    ptolemy: "tol-uh-mee",
    ptomaine: "toh-mayn",

    // Silent G
    gnome: "nome",
    gnat: "nat",
    gnu: "noo",
    gnash: "nash",
    gneiss: "nice",
    gnostic: "nos-tik",

    // Silent K
    knight: "nite",
    knife: "nife",
    know: "no",
    knee: "nee",
    kneel: "neel",
    knew: "noo",
    knit: "nit",
    knob: "nob",
    knock: "nok",
    knot: "not",
    knowledge: "nol-ij",
    knuckle: "nuk-uhl",

    // Silent W
    write: "rite",
    wrong: "rong",
    wrist: "rist",
    wrap: "rap",
    wreck: "rek",
    wrestle: "res-uhl",
    wriggle: "rig-uhl",
    wrinkle: "rink-uhl",
    wrath: "rath",
    wreath: "reeth",

    // Contractions - Common
    "we're": "weer",
    "you're": "yoor",
    "they're": "thair",
    "we'll": "weel",
    "you'll": "yool",
    "they'll": "thail",
    "we've": "weev",
    "you've": "yoov",
    "they've": "thaiv",
    "i'm": "ahym",
    "i'll": "ahyl",
    "i've": "ahyv",
    "i'd": "ahyd",
    "he's": "heez",
    "she's": "sheez",
    "it's": "its",
    "that's": "thats",
    "what's": "wuts",
    "who's": "hooz",
    "where's": "wairz",
    "when's": "wenz",
    "why's": "wyz",
    "how's": "houz",

    // Common words - Correct pronunciation
    the: "thuh",
    a: "uh",
    an: "un",
    and: "and",
    for: "for",
    are: "ar",
    with: "with",
    has: "haz",
    have: "hav",
    does: "duz",
    was: "wuz",
    were: "wur",
    been: "bin",
    one: "wun",
    two: "too",
    four: "for",
    your: "yor",
    our: "owr",
    their: "thair",
    there: "thair",
    they: "thay",
    them: "them",
    these: "theez",
    those: "thoz",
    because: "buh-kawz",
    enough: "ih-nuhf",
    through: "throo",
    though: "tho",
    thought: "thawt",
    throughout: "throo-out",
    country: "kuhn-tree",
    couple: "kuhp-uhl",
    young: "yung",
    rough: "ruhf",
    tough: "tuhf",
    cough: "kawf",
    thorough: "thur-oh",
    bough: "bow",
    colonel: "kernel",
    comfortable: "kuhmf-tuh-bul",
    interesting: "in-tres-ting",
    literally: "lit-er-uh-lee",
    probably: "prob-uh-blee",
    necessarily: "nes-uh-sair-uh-lee",
    particularly: "par-tik-yuh-ler-lee",
    regularly: "reg-yuh-ler-lee",
    usually: "yoo-zhoo-uh-lee",
    eventually: "ih-ven-choo-uh-lee",
    actually: "ak-choo-uh-lee",
    naturally: "nach-er-uh-lee",
    obviously: "ob-vee-uhs-lee",

    // Numbers
    0: "zero",
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
    11: "eleven",
    12: "twelve",
    13: "thirteen",
    14: "fourteen",
    15: "fifteen",
    16: "sixteen",
    17: "seventeen",
    18: "eighteen",
    19: "nineteen",
    20: "twenty",
    30: "thirty",
    40: "forty",
    50: "fifty",
    60: "sixty",
    70: "seventy",
    80: "eighty",
    90: "ninety",
    100: "one hundred",
    1000: "one thousand",
  };

  // ====== PREPROCESS TEXT FOR PRONUNCIATION ======
  const preprocessText = useCallback((text) => {
    if (!text) return "";

    let processed = text;

    // Replace words with pronunciation fixes (case insensitive, whole word only)
    for (const [word, replacement] of Object.entries(pronunciationFixes)) {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      processed = processed.replace(regex, replacement);
    }

    // Fix abbreviations
    processed = processed
      .replace(/\bDr\.?\b/gi, "Doctor")
      .replace(/\bMr\.?\b/gi, "Mister")
      .replace(/\bMrs\.?\b/gi, "Missus")
      .replace(/\bMs\.?\b/gi, "Miss")
      .replace(/\bSt\.?\b/gi, "Saint")
      .replace(/\bAve\.?\b/gi, "Avenue")
      .replace(/\bRd\.?\b/gi, "Road")
      .replace(/\bBlvd\.?\b/gi, "Boulevard")
      .replace(/\bJr\.?\b/gi, "Junior")
      .replace(/\bSr\.?\b/gi, "Senior")
      .replace(/\bvs\.?\b/gi, "versus")
      .replace(/\betc\.?\b/gi, "et cetera")
      .replace(/\bapprox\.?\b/gi, "approximately");

    // Fix common acronyms
    processed = processed
      .replace(/\bUSA\b/g, "U S A")
      .replace(/\bUK\b/g, "U K")
      .replace(/\bAI\b/g, "A I")
      .replace(/\bPDF\b/g, "P D F")
      .replace(/\bHTML\b/g, "H T M L")
      .replace(/\bCSS\b/g, "C S S")
      .replace(/\bAPI\b/g, "A P I")
      .replace(/\bURL\b/g, "U R L")
      .replace(/\bHTTP\b/g, "H T T P")
      .replace(/\bHTTPS\b/g, "H T T P S");

    return processed;
  }, []);

  // ====== GET BEST VOICE ======
  const getBestVoice = useCallback(() => {
    const availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length === 0) return null;

    // Priority order for best voices
    const preferredVoices = [
      "Google UK English Female",
      "Google US English Female",
      "Google UK English Male",
      "Google US English Male",
      "Microsoft Zira Desktop",
      "Microsoft David Desktop",
      "Microsoft Hazel Desktop",
      "Samantha", // Mac
      "Alex", // Mac
      "Victoria", // Mac
      "Daniel", // Mac
      "Google español",
      "Google français",
      "Google Deutsch",
      "Google italiano",
      "Google português",
      "Google русский",
    ];

    // Try to find a preferred voice
    for (const preferred of preferredVoices) {
      const voice = availableVoices.find((v) => v.name.includes(preferred));
      if (voice) {
        console.log("🎤 Using voice:", voice.name);
        return voice;
      }
    }

    // Fallback to any voice matching the selected language
    const langVoice = availableVoices.find((v) => v.lang === selectedLanguage);
    if (langVoice) {
      console.log("🎤 Using language voice:", langVoice.name);
      return langVoice;
    }

    // Fallback to any English voice
    const englishVoice = availableVoices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) {
      console.log("🎤 Using English voice:", englishVoice.name);
      return englishVoice;
    }

    // Last resort
    console.log("🎤 Using default voice:", availableVoices[0]?.name);
    return availableVoices[0];
  }, [selectedLanguage]);

  // Parse text into pages
  useEffect(() => {
    if (text) {
      const pageRegex = /Page (\d+):/g;
      const matches = [...text.matchAll(pageRegex)];

      if (matches.length > 0) {
        const pageData = [];
        for (let i = 0; i < matches.length; i++) {
          const startIdx = matches[i].index;
          const endIdx =
            i < matches.length - 1 ? matches[i + 1].index : text.length;
          const pageContent = text.substring(startIdx, endIdx);
          pageData.push({
            pageNum: parseInt(matches[i][1]),
            content: pageContent,
          });
        }
        setPages(pageData);
        setTotalPages(pageData.length);
        setEndPage(pageData.length);
      } else {
        setPages([{ pageNum: 1, content: text }]);
        setTotalPages(1);
        setEndPage(1);
      }
    }
  }, [text]);

  // Get text for selected pages
  const getSelectedText = useCallback(() => {
    if (pages.length === 0) return text || "";

    const selectedPages = pages.filter(
      (p) => p.pageNum >= startPage && p.pageNum <= endPage,
    );

    return selectedPages.map((p) => p.content).join("\n\n");
  }, [pages, startPage, endPage, text]);

  // Clean text for speech
  const cleanTextForSpeech = useCallback((text) => {
    if (!text) return "";
    return text
      .replace(/Page \d+:/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  // Update processed text when selection changes
  useEffect(() => {
    const selected = getSelectedText();
    const cleaned = cleanTextForSpeech(selected);
    const preprocessed = preprocessText(cleaned);
    setProcessedText(preprocessed);
  }, [getSelectedText, cleanTextForSpeech, preprocessText]);

  // ====== SAVE PROGRESS TO LOCAL STORAGE ======
  const saveProgress = useCallback(
    (chunkIndex, progressPercent, total) => {
      try {
        const textHash = text ? text.substring(0, 200) : "";
        localStorage.setItem(
          "audioProgress",
          JSON.stringify({
            chunkIndex,
            progress: progressPercent,
            totalChunks: total,
            textHash: textHash,
            timestamp: Date.now(),
          }),
        );
      } catch (e) {
        console.warn("Failed to save audio progress:", e);
      }
    },
    [text],
  );

  // ====== LOAD PROGRESS FROM LOCAL STORAGE ======
  const loadProgress = useCallback(() => {
    try {
      const saved = localStorage.getItem("audioProgress");
      if (saved) {
        const data = JSON.parse(saved);
        const textHash = text ? text.substring(0, 200) : "";
        if (data.textHash === textHash) {
          setCurrentChunkIndex(data.chunkIndex || 0);
          setProgress(data.progress || 0);
          setTotalChunks(data.totalChunks || 0);
          if (data.chunkIndex > 0 && data.chunkIndex < data.totalChunks) {
            setShowContinue(true);
          }
          return data.chunkIndex || 0;
        } else {
          localStorage.removeItem("audioProgress");
        }
      }
    } catch (e) {
      console.warn("Failed to load audio progress:", e);
    }
    return 0;
  }, [text]);

  // ====== RESET PROGRESS ======
  const resetProgress = useCallback(() => {
    localStorage.removeItem("audioProgress");
    setCurrentChunkIndex(0);
    setProgress(0);
    setTotalChunks(0);
    setShowContinue(false);
  }, []);

  // ====== LOAD PROGRESS ON MOUNT ======
  useEffect(() => {
    if (processedText && isReady) {
      loadProgress();
    }
  }, [processedText, isReady, loadProgress]);

  // ====== LOAD VOICES ======
  useEffect(() => {
    const loadVoices = () => {
      try {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        if (availableVoices.length > 0) {
          const bestVoice = getBestVoice();
          if (bestVoice) {
            setSelectedVoice(bestVoice);
            currentVoiceRef.current = bestVoice;
          }
          setIsReady(true);
        }
      } catch (e) {
        console.error("Error loading voices:", e);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Fallback: try loading voices again after 2 seconds
    const fallbackTimeout = setTimeout(() => {
      if (!isReady) {
        loadVoices();
      }
    }, 2000);

    try {
      audioContextRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
    } catch (e) {
      console.warn("AudioContext not available");
    }

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      clearTimeout(fallbackTimeout);
      isMountedRef.current = false;
      window.speechSynthesis.cancel();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [getBestVoice, isReady]);

  const handleVoiceChange = useCallback((voice) => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    isProcessingRef.current = false;
    speechQueueRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setSelectedVoice(voice);
    currentVoiceRef.current = voice;
    setError(null);

    setTimeout(() => {
      try {
        if (
          audioContextRef.current &&
          audioContextRef.current.state === "suspended"
        ) {
          audioContextRef.current.resume();
        }
      } catch (e) {
        // Ignore
      }
    }, 100);
  }, []);

  const ensureAudioContext = useCallback(() => {
    try {
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "suspended"
      ) {
        audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn("Could not resume AudioContext:", e);
    }
  }, []);

  // ====== PROCESS QUEUE ======
  const processQueue = useCallback(() => {
    if (isProcessingRef.current) return;
    if (speechQueueRef.current.length === 0) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      isProcessingRef.current = false;
      setProgress(100);
      saveProgress(totalChunks, 100, totalChunks);
      return;
    }

    ensureAudioContext();
    isProcessingRef.current = true;
    const chunk = speechQueueRef.current.shift();

    if (!chunk || chunk.trim().length === 0) {
      isProcessingRef.current = false;
      setTimeout(() => processQueue(), 100);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.rate = Math.min(Math.max(speechRate, 0.5), 2);
    utterance.pitch = Math.min(Math.max(speechPitch, 0.5), 2);
    utterance.volume = 1;

    // Use best voice
    const voiceToUse = currentVoiceRef.current || getBestVoice();
    if (voiceToUse) {
      utterance.voice = voiceToUse;
      utterance.lang = voiceToUse.lang;
    } else {
      utterance.lang = selectedLanguage || "en-US";
    }

    utteranceRef.current = utterance;

    utterance.onstart = () => {
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      setError(null);
      setShowContinue(false);
    };

    utterance.onend = () => {
      if (!isMountedRef.current) return;

      const total = totalChunks || speechQueueRef.current.length + 1;
      const done = total - speechQueueRef.current.length;
      const progressPercent = Math.min(Math.round((done / total) * 100), 100);

      setProgress(progressPercent);
      setCurrentChunkIndex(done);
      saveProgress(done, progressPercent, total);

      isProcessingRef.current = false;

      if (speechQueueRef.current.length > 0) {
        timeoutRef.current = setTimeout(() => {
          processQueue();
        }, DELAY_BETWEEN_CHUNKS);
      } else {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setProgress(100);
        saveProgress(total, 100, total);
      }
    };

    utterance.onerror = (event) => {
      if (event.error === "interrupted" || event.error === "canceled") {
        speechQueueRef.current = [];
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        isProcessingRef.current = false;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        return;
      }

      isProcessingRef.current = false;
      if (speechQueueRef.current.length > 0) {
        setTimeout(() => processQueue(), 500);
      } else {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setError("Speech synthesis error. Please try again.");
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Failed to speak:", e);
      isProcessingRef.current = false;
      setError("Failed to start speech synthesis.");
    }
  }, [
    speechRate,
    speechPitch,
    totalChunks,
    saveProgress,
    ensureAudioContext,
    selectedLanguage,
    getBestVoice,
  ]);

  // ====== INITIALIZE AUDIO ======
  const initializeAudio = useCallback(() => {
    if (audioInitialized) return;

    try {
      if (
        audioContextRef.current &&
        audioContextRef.current.state === "suspended"
      ) {
        audioContextRef.current.resume();
      }

      const testUtterance = new SpeechSynthesisUtterance(" ");
      testUtterance.volume = 0;
      testUtterance.onend = () => {
        setAudioInitialized(true);
        window.speechSynthesis.cancel();
      };
      window.speechSynthesis.speak(testUtterance);

      setTimeout(() => {
        if (!audioInitialized) {
          setAudioInitialized(true);
          window.speechSynthesis.cancel();
        }
      }, 1000);
    } catch (e) {
      console.warn("Audio initialization failed:", e);
      setAudioInitialized(true);
    }
  }, [audioInitialized]);

  // ====== SPEAK FUNCTION ======
  const speak = useCallback(() => {
    if (!audioInitialized) {
      initializeAudio();
      setTimeout(() => {
        speak();
      }, 500);
      return;
    }

    let textToSpeak =
      processedText || preprocessText(cleanTextForSpeech(getSelectedText()));

    if (!textToSpeak || textToSpeak.length === 0) {
      textToSpeak = preprocessText(cleanTextForSpeech(text));
    }

    if (!textToSpeak || textToSpeak.length === 0) {
      setError("No text to speak. Please check your page selection.");
      return;
    }

    if (!isReady) {
      setError("TTS engine is not ready. Please wait.");
      return;
    }

    window.speechSynthesis.cancel();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsSpeaking(false);
    isSpeakingRef.current = false;
    isProcessingRef.current = false;
    speechQueueRef.current = [];

    const cleanText = textToSpeak.replace(/\s+/g, " ").trim();

    if (cleanText.length === 0) {
      setError("No readable text found");
      return;
    }

    const chunks = [];
    for (let i = 0; i < cleanText.length; i += MAX_CHUNK) {
      let chunk = cleanText.substring(i, i + MAX_CHUNK);
      const lastPeriod = chunk.lastIndexOf(".");
      const lastQuestion = chunk.lastIndexOf("?");
      const lastExclamation = chunk.lastIndexOf("!");
      const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclamation);

      if (
        lastBreak > chunk.length * 0.7 &&
        i + lastBreak < cleanText.length - 50
      ) {
        chunk = chunk.substring(0, lastBreak + 1);
        i = i + lastBreak;
      }

      chunks.push(chunk);
    }

    setTotalChunks(chunks.length);

    const savedIndex = loadProgress();
    if (savedIndex > 0 && savedIndex < chunks.length) {
      speechQueueRef.current = chunks.slice(savedIndex);
      setCurrentChunkIndex(savedIndex);
      const progressPercent = Math.round((savedIndex / chunks.length) * 100);
      setProgress(progressPercent);
    } else {
      speechQueueRef.current = chunks;
      setCurrentChunkIndex(0);
      setProgress(0);
      if (savedIndex === 0) {
        localStorage.removeItem("audioProgress");
      }
    }

    ensureAudioContext();

    setTimeout(() => {
      processQueue();
    }, 300);
  }, [
    processedText,
    getSelectedText,
    cleanTextForSpeech,
    preprocessText,
    isReady,
    processQueue,
    ensureAudioContext,
    loadProgress,
    audioInitialized,
    initializeAudio,
    text,
  ]);

  // ====== STOP FUNCTION ======
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const total = totalChunks || 1;
    const done = currentChunkIndex || 0;
    const progressPercent = Math.round((done / total) * 100);
    saveProgress(done, progressPercent, total);

    speechQueueRef.current = [];
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    isProcessingRef.current = false;
    setIsPaused(false);
    utteranceRef.current = null;
  }, [totalChunks, currentChunkIndex, saveProgress]);

  // ====== PAUSE ======
  const pause = useCallback(() => {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsSpeaking(false);
    }
  }, []);

  // ====== RESUME ======
  const resume = useCallback(() => {
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
    }
  }, []);

  // Get language flag
  const getLanguageFlag = (langCode) => {
    const code = langCode.substring(0, 2);
    const flags = {
      en: "🇬🇧",
      de: "🇩🇪",
      es: "🇪🇸",
      fr: "🇫🇷",
      ru: "🇷🇺",
      it: "🇮🇹",
      pt: "🇵🇹",
      ja: "🇯🇵",
      ko: "🇰🇷",
      zh: "🇨🇳",
      ar: "🇸🇦",
      hi: "🇮🇳",
      nl: "🇳🇱",
      pl: "🇵🇱",
      tr: "🇹🇷",
      vi: "🇻🇳",
      th: "🇹🇭",
      id: "🇮🇩",
      ms: "🇲🇾",
    };
    return flags[code] || "🌐";
  };

  // Format page range
  const getPageRangeText = () => {
    if (startPage === endPage) {
      return `Page ${startPage}`;
    }
    return `Pages ${startPage} - ${endPage}`;
  };

  // Get selected text length
  const getSelectedTextLength = () => {
    const selectedText = getSelectedText();
    const cleanText = cleanTextForSpeech(selectedText);
    return cleanText.length;
  };

  const estimatedMinutes = processedText
    ? Math.round(((processedText.length / 1000) * 1.5) / 60)
    : 0;

  return (
    <div className="text-to-speech">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="font-semibold text-gray-700 mb-3">🔊 Text Reader</h3>

        {/* File info */}
        {fileName && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              📄 <span className="font-medium">{fileName}</span>
            </p>
            {totalPages > 0 && (
              <p className="text-sm text-gray-500">
                Total pages: {totalPages} • Characters:{" "}
                {getSelectedTextLength().toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Page Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Page
            </label>
            <select
              value={startPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setStartPage(val);
                if (val > endPage) setEndPage(val);
                if (isSpeaking || isPaused) stop();
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isSpeaking}
            >
              {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map(
                (num) => (
                  <option key={num} value={num}>
                    Page {num}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Page
            </label>
            <select
              value={endPage}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setEndPage(val);
                if (val < startPage) setStartPage(val);
                if (isSpeaking || isPaused) stop();
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isSpeaking}
            >
              {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map(
                (num) => (
                  <option key={num} value={num}>
                    Page {num}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reading Range
            </label>
            <div className="w-full p-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 text-sm font-medium text-center">
              {getPageRangeText()}
            </div>
          </div>
        </div>

        {/* Audio Initialization Button */}
        {!audioInitialized && (
          <button
            onClick={initializeAudio}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mb-4"
          >
            🎧 Click to Enable Audio
          </button>
        )}

        {/* Status */}
        <div
          className={`mb-4 px-4 py-2 rounded ${
            isReady
              ? "bg-green-50 border border-green-300 text-green-700"
              : "bg-yellow-50 border border-yellow-300 text-yellow-700"
          }`}
        >
          <span className="text-sm">
            {isReady
              ? `✅ TTS ready (${voices.length} voices)`
              : "⏳ Loading voices..."}
          </span>
          {selectedVoice && (
            <span className="text-xs block text-blue-500 mt-1">
              🎤 Voice: {selectedVoice.name}{" "}
              {getLanguageFlag(selectedVoice.lang)}
            </span>
          )}
          <span className="text-xs block text-gray-500 mt-1">
            📄 {getSelectedTextLength().toLocaleString()} chars • ~
            {estimatedMinutes} min
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded mb-4">
            <strong>Error:</strong> {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Progress Bar */}
        {(isSpeaking || progress > 0) && totalChunks > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Continue Button */}
        {showContinue && !isSpeaking && !isPaused && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-sm text-yellow-700">
              ⏸️ You left off at {progress}%
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  setShowContinue(false);
                  speak();
                }}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
              >
                ▶️ Continue
              </button>
              <button
                onClick={resetProgress}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm"
              >
                🔄 Start Over
              </button>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-3 mb-4">
          {!isSpeaking && !isPaused && (
            <button
              onClick={speak}
              disabled={!processedText || !isReady || !audioInitialized}
              className={`flex-1 min-w-[120px] py-3 rounded-lg font-medium transition-colors ${
                processedText && isReady && audioInitialized
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-300 cursor-not-allowed text-gray-500"
              }`}
            >
              ▶️ Read
            </button>
          )}

          {isSpeaking && !isPaused && (
            <>
              <button
                onClick={pause}
                className="flex-1 min-w-[120px] py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
              >
                ⏸️ Pause
              </button>
              <button
                onClick={stop}
                className="flex-1 min-w-[120px] py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                ⏹️ Stop
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={resume}
                className="flex-1 min-w-[120px] py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                ▶️ Resume
              </button>
              <button
                onClick={stop}
                className="flex-1 min-w-[120px] py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                ⏹️ Stop
              </button>
            </>
          )}
        </div>

        {/* Voice Settings */}
        <div className="border rounded-lg p-3 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Voice Settings</h4>

          <div>
            <label className="text-sm text-gray-600 block mb-1">
              🌐 Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                const voice = voices.find((v) => v.lang === e.target.value);
                if (voice) {
                  handleVoiceChange(voice);
                }
                if (isSpeaking || isPaused) stop();
              }}
              className="w-full border rounded px-2 py-1 text-sm"
              disabled={isSpeaking}
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {getLanguageFlag(lang.code)} {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1">Voice</label>
            <select
              value={selectedVoice?.name || ""}
              onChange={(e) => {
                const voice = voices.find((v) => v.name === e.target.value);
                if (voice) {
                  handleVoiceChange(voice);
                }
              }}
              className="w-full border rounded px-2 py-1 text-sm"
              disabled={voices.length === 0 || isSpeaking}
            >
              {voices.length === 0 && <option value="">No voices found</option>}
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {getLanguageFlag(voice.lang)} {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1">
              Speed: {speechRate}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1">
              Pitch: {speechPitch}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={speechPitch}
              onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="text-xs text-gray-400 text-center mt-3 space-y-1">
          <span className="block text-green-600 font-medium">
            ✅ 100% Free - No API Keys!
          </span>
          <span className="block text-blue-500 text-xs">
            💡 1500 characters per chunk
          </span>
          <span className="block text-yellow-500 text-xs">
            ⏸️ Progress is saved automatically!
          </span>
        </div>
      </div>
    </div>
  );
};

export default TextToSpeech;
