import React, { useState, useEffect } from "react";
import { generateUnits, detectLanguage } from "../services/aiService";
import ConfirmModal from "./ConfirmModal";

const LanguageTeacher = ({ text }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [language, setLanguage] = useState("English");
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [course, setCourse] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState(0);
  const [error, setError] = useState(null);
  const [quizMode, setQuizMode] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [completedLessons, setCompletedLessons] = useState([]);
  const [quizScores, setQuizScores] = useState([]);
  const [processedChars, setProcessedChars] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [isProcessingChunk, setIsProcessingChunk] = useState(false);
  const [chunkProgress, setChunkProgress] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [chunkNumber, setChunkNumber] = useState(0);
  const [bookHash, setBookHash] = useState("");
  const [allChunksProcessed, setAllChunksProcessed] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalAction, setModalAction] = useState(null);

  const CHUNK_SIZE = 3000;
  const languages = [
    "English",
    "Spanish",
    "French",
    "German",
    "Italian",
    "Japanese",
    "Chinese",
    "Russian",
    "Arabic",
    "Portuguese",
    "Dutch",
    "Korean",
    "Turkish",
    "Vietnamese",
    "Thai",
    "Indonesian",
  ];

  // ====== DETECT LANGUAGE ON MOUNT ======
  useEffect(() => {
    const detectBookLanguage = async () => {
      if (text && text.length > 200) {
        setIsDetecting(true);
        try {
          const detected = await detectLanguage(text);
          if (detected) {
            setDetectedLanguage(detected);
            setLanguage(detected);
            console.log(`🌐 Detected language: ${detected}`);
          }
        } catch (error) {
          console.warn("Language detection failed:", error);
        } finally {
          setIsDetecting(false);
        }
      }
    };
    detectBookLanguage();
  }, [text]);

  // ====== GENERATE UNIQUE BOOK HASH ======
  const generateBookHash = (text) => {
    const prefix = text.substring(0, 200).replace(/\s+/g, " ");
    return `${prefix.length}-${text.length}-${prefix.substring(0, 50)}`;
  };

  // ====== GET STORAGE KEY ======
  const getStorageKey = () => {
    const hash = generateBookHash(text);
    return `languageTeacherProgress_${hash}`;
  };

  // ====== CALCULATE TOTAL CHARACTERS ======
  useEffect(() => {
    if (text) {
      setTotalChars(text.length);
      const hash = generateBookHash(text);
      setBookHash(hash);
    }
  }, [text]);

  // ====== LOAD SAVED PROGRESS ======
  useEffect(() => {
    if (text && text.length > 0) {
      const storageKey = getStorageKey();
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setCourse(data.course);
          setSelectedUnit(data.selectedUnit || 0);
          setSelectedLesson(data.selectedLesson || 0);
          setCompletedLessons(data.completedLessons || []);
          setQuizScores(data.quizScores || []);
          setLanguage(data.language || "English");
          setProcessedChars(data.processedChars || 0);
          setChunkNumber(data.chunkNumber || 0);

          if (data.processedChars >= text.length) {
            setAllChunksProcessed(true);
          }

          console.log("✅ Progress loaded for this book");
        } catch (e) {
          console.warn("Failed to load progress:", e);
        }
      } else {
        setCourse(null);
        setCompletedLessons([]);
        setQuizScores([]);
        setSelectedUnit(0);
        setSelectedLesson(0);
        setProcessedChars(0);
        setChunkNumber(0);
        setAllChunksProcessed(false);
        console.log("📖 New book detected - no saved progress");
      }
    }
    setIsInitialLoad(false);
  }, [text]);

  // ====== SAVE PROGRESS ======
  const saveProgress = (data) => {
    try {
      const storageKey = getStorageKey();
      const progress = {
        course,
        selectedUnit,
        selectedLesson,
        completedLessons,
        quizScores,
        language,
        processedChars,
        chunkNumber,
        ...data,
      };
      localStorage.setItem(storageKey, JSON.stringify(progress));
      console.log("✅ Progress saved for this book");
    } catch (e) {
      console.warn("Failed to save progress:", e);
    }
  };

  // ====== RESET CURRENT BOOK PROGRESS ======
  const resetCurrentBookProgress = () => {
    setModalMessage("Are you sure you want to delete progress for this book?");
    setModalAction(() => () => {
      const storageKey = getStorageKey();
      localStorage.removeItem(storageKey);
      setCourse(null);
      setCompletedLessons([]);
      setQuizScores([]);
      setSelectedUnit(0);
      setSelectedLesson(0);
      setProcessedChars(0);
      setChunkNumber(0);
      setAllChunksProcessed(false);
      setQuizAnswers({});
      setShowResults(false);
      console.log("🗑️ Progress cleared for this book");
    });
    setModalOpen(true);
  };

  // ====== RESET ALL PROGRESS ======
  const resetAllProgress = () => {
    setModalMessage(
      "Are you sure you want to delete ALL progress for ALL books?",
    );
    setModalAction(() => () => {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith("languageTeacherProgress_")) {
          localStorage.removeItem(key);
        }
      });
      setCourse(null);
      setCompletedLessons([]);
      setQuizScores([]);
      setSelectedUnit(0);
      setSelectedLesson(0);
      setProcessedChars(0);
      setChunkNumber(0);
      setAllChunksProcessed(false);
      setQuizAnswers({});
      setShowResults(false);
      console.log("🗑️ ALL progress cleared");
    });
    setModalOpen(true);
  };

  // ====== CHECK IF UNIT IS COMPLETED ======
  const isUnitCompleted = (unitIndex) => {
    const unit = course?.units[unitIndex];
    if (!unit) return false;
    return unit.lessons.every((_, i) =>
      completedLessons.includes(`${unitIndex}-${i}`),
    );
  };

  // ====== CHECK IF ALL UNITS ARE COMPLETED ======
  const areAllUnitsCompleted = () => {
    if (!course) return false;
    return course.units.every((_, i) => isUnitCompleted(i));
  };

  // ====== PROCESS NEXT CHUNK ======
  const processNextChunk = async () => {
    if (!text || text.length === 0) {
      setError("No text to process. Please upload a book first.");
      return;
    }

    if (processedChars >= totalChars) {
      setAllChunksProcessed(true);
      setError("🎉 All text has been processed!");
      return;
    }

    const startChar = processedChars;
    const endChar = Math.min(processedChars + CHUNK_SIZE, totalChars);
    const chunkText = text.substring(startChar, endChar);
    const currentChunkNumber = chunkNumber + 1;

    setIsProcessingChunk(true);
    setChunkProgress(0);
    setError(null);

    try {
      console.log(
        `📖 Processing chunk ${currentChunkNumber}: characters ${startChar}-${endChar} (${chunkText.length} chars)`,
      );
      setChunkProgress(20);

      const result = await generateUnits(chunkText, language);
      setChunkProgress(80);

      let updatedCourse = course || {
        courseTitle: result.courseTitle || `${language} Course from Book`,
        language: language,
        totalUnits: 0,
        units: [],
      };

      const offset = updatedCourse.units.length;
      const newUnits = result.units.map((unit, index) => ({
        ...unit,
        id: offset + index + 1,
        title: unit.title || `Unit ${offset + index + 1}`,
        chunkInfo: {
          startChar,
          endChar,
          chunkNumber: currentChunkNumber,
          charRange: `${startChar}-${endChar}`,
        },
      }));

      updatedCourse.units = [...updatedCourse.units, ...newUnits];
      updatedCourse.totalUnits = updatedCourse.units.length;
      updatedCourse.courseTitle =
        result.courseTitle || updatedCourse.courseTitle;

      setCourse(updatedCourse);
      setProcessedChars(endChar);
      setChunkNumber(currentChunkNumber);
      setChunkProgress(100);

      if (endChar >= totalChars) {
        setAllChunksProcessed(true);
      }

      saveProgress({
        course: updatedCourse,
        processedChars: endChar,
        chunkNumber: currentChunkNumber,
      });

      console.log(
        `✅ Processed chunk ${currentChunkNumber}: ${newUnits.length} new units`,
      );
    } catch (err) {
      console.error("❌ Error processing chunk:", err);
      setError("Failed to process chunk: " + err.message);
    } finally {
      setIsProcessingChunk(false);
      setChunkProgress(0);
    }
  };

  // ====== MARK LESSON COMPLETE ======
  const markLessonComplete = (unitIndex, lessonIndex) => {
    const key = `${unitIndex}-${lessonIndex}`;
    if (!completedLessons.includes(key)) {
      const newCompleted = [...completedLessons, key];
      setCompletedLessons(newCompleted);
      saveProgress({ completedLessons: newCompleted });

      const updatedCourse = { ...course };
      const allLessonsDone = updatedCourse.units.every((unit, uIdx) =>
        unit.lessons.every((_, lIdx) =>
          newCompleted.includes(`${uIdx}-${lIdx}`),
        ),
      );

      if (allLessonsDone && processedChars < totalChars && !isProcessingChunk) {
        setTimeout(() => {
          processNextChunk();
        }, 1000);
      }
    }
  };

  // ====== QUIZ HANDLING ======
  const handleQuizAnswer = (questionIndex, answerIndex) => {
    setQuizAnswers({
      ...quizAnswers,
      [questionIndex]: answerIndex,
    });
  };

  const calculateQuizScore = () => {
    const currentUnit = course?.units[selectedUnit];
    if (!currentUnit?.quiz) return { correct: 0, total: 0 };

    const questions = currentUnit.quiz.questions;
    let correct = 0;
    questions.forEach((q, i) => {
      if (quizAnswers[i] === q.answer) correct++;
    });
    return { correct, total: questions.length };
  };

  const saveQuizScore = (unitIndex, score, total) => {
    const existing = quizScores.findIndex((q) => q.unitIndex === unitIndex);
    const newScore = {
      unitIndex,
      score,
      total,
      date: new Date().toISOString(),
    };

    const newScores =
      existing >= 0
        ? [
            ...quizScores.slice(0, existing),
            newScore,
            ...quizScores.slice(existing + 1),
          ]
        : [...quizScores, newScore];

    setQuizScores(newScores);
    saveProgress({ quizScores: newScores });
  };

  const handleQuizComplete = () => {
    const score = calculateQuizScore();
    saveQuizScore(selectedUnit, score.correct, score.total);
    setShowResults(true);
  };

  // ====== STATS ======
  const getStats = () => {
    if (!course)
      return { units: 0, lessons: 0, completed: 0, vocab: 0, progress: 0 };

    let totalLessons = 0;
    let vocabCount = 0;
    course.units.forEach((u) => {
      totalLessons += u.lessons.length;
      u.lessons.forEach((l) => {
        vocabCount += l.vocabulary?.length || 0;
      });
    });

    return {
      units: course.units.length,
      lessons: totalLessons,
      completed: completedLessons.length,
      vocab: vocabCount,
      progress:
        totalLessons > 0
          ? Math.round((completedLessons.length / totalLessons) * 100)
          : 0,
    };
  };

  const stats = getStats();
  const remainingChars = totalChars - processedChars;
  const percentComplete =
    totalChars > 0 ? Math.round((processedChars / totalChars) * 100) : 0;
  const allUnitsCompleted = areAllUnitsCompleted();

  // ====== RENDER ======
  if (!text || text.length < 50) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-700 mb-3">
          📚 Language Teacher
        </h3>
        <p className="text-gray-500 text-sm">
          Upload a book first to generate lessons!
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-700 mb-3">
          📚 Language Teacher
        </h3>
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded">
          <strong>Error:</strong> {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // ====== NO COURSE YET ======
  if (!course) {
    const nextChunkSize = Math.min(CHUNK_SIZE, remainingChars);

    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <h3 className="font-semibold text-gray-700 mb-3">
          📚 Language Teacher
        </h3>

        {/* Language Detection Status */}
        {isDetecting ? (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              🔍 Detecting book language...
            </p>
          </div>
        ) : detectedLanguage ? (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              ✅ Detected language: <strong>{detectedLanguage}</strong>
            </p>
          </div>
        ) : null}

        <div className="mb-4">
          <label className="text-sm text-gray-600 block mb-1">
            Target Language for Learning
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            disabled={isProcessingChunk}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          {detectedLanguage && (
            <p className="text-xs text-gray-400 mt-1">
              💡 Book appears to be in <strong>{detectedLanguage}</strong>.
              {language !== detectedLanguage &&
                ` You're learning ${language}. This will create a bilingual learning experience.`}
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>📄 Total Characters</span>
            <span className="font-medium">{totalChars.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>✅ Processed</span>
            <span className="font-medium">
              {processedChars.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>📖 Remaining</span>
            <span className="font-medium">
              {remainingChars.toLocaleString()}
            </span>
          </div>
          {processedChars > 0 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentComplete}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-700">
          ⏱️ Each chunk processes ~3,000 characters. The AI will create
          structured lessons with vocabulary, grammar, and quizzes.
          {chunkNumber > 0 && ` You've processed ${chunkNumber} chunks so far.`}
        </div>

        {remainingChars > 0 ? (
          <button
            onClick={processNextChunk}
            disabled={isProcessingChunk}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              isProcessingChunk
                ? "bg-gray-300 cursor-not-allowed text-gray-500"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {isProcessingChunk ? (
              <span>
                ⏳ Processing{" "}
                {Math.min(CHUNK_SIZE, remainingChars).toLocaleString()}{" "}
                characters...
              </span>
            ) : (
              <span>
                📖 Generate Lessons (
                {Math.min(CHUNK_SIZE, remainingChars).toLocaleString()} chars)
              </span>
            )}
          </button>
        ) : (
          <div className="text-center text-green-600 font-medium py-2">
            ✅ All text processed! Scroll to see your course.
          </div>
        )}

        {isProcessingChunk && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Processing...</span>
              <span>{chunkProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${chunkProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-2">
          ⏱️ ~3,000 characters per chunk • AI creates structured lessons
        </p>
      </div>
    );
  }

  // ====== COURSE EXISTS - SHOW UNITS ======
  const currentUnit = course.units[selectedUnit];

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <ConfirmModal
        isOpen={modalOpen}
        message={modalMessage}
        onConfirm={() => {
          setModalOpen(false);
          if (modalAction) {
            modalAction();
            setModalAction(null);
          }
        }}
        onCancel={() => {
          setModalOpen(false);
          setModalAction(null);
        }}
      />

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-700">📚 {course.courseTitle}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            {percentComplete}% of book
          </span>
          {detectedLanguage && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
              🌐 {detectedLanguage}
            </span>
          )}
          <button
            onClick={resetCurrentBookProgress}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Reset Book
          </button>
          <button
            onClick={resetAllProgress}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Course Progress</span>
          <span>
            {stats.progress}% ({stats.completed}/{stats.lessons} lessons)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${stats.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Next Chunk Button */}
      {remainingChars > 0 && allUnitsCompleted && !isProcessingChunk && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 mb-2">
            🎉 You've completed all lessons! Load the next chunk to continue.
          </p>
          <button
            onClick={processNextChunk}
            className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            📖 Load Next {Math.min(CHUNK_SIZE, remainingChars).toLocaleString()}{" "}
            Characters
          </button>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessingChunk && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">⏳ Processing next chunk...</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Generating lessons...</span>
              <span>{chunkProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
              <div
                className="bg-yellow-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${chunkProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* All done message */}
      {allChunksProcessed && allUnitsCompleted && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-medium">
            🎉 Congratulations! You've completed the entire book!
          </p>
          <p className="text-xs text-green-600 mt-1">
            All {stats.units} units and {stats.lessons} lessons are complete.
          </p>
        </div>
      )}

      {/* Unit Selector */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
        {course.units.map((unit, idx) => {
          const unitCompleted = isUnitCompleted(idx);
          return (
            <button
              key={unit.id}
              onClick={() => {
                setSelectedUnit(idx);
                setSelectedLesson(0);
                setQuizMode(false);
                setQuizAnswers({});
                setShowResults(false);
              }}
              className={`px-3 py-1 text-sm rounded-full whitespace-nowrap flex items-center gap-1 ${
                selectedUnit === idx
                  ? "bg-blue-500 text-white"
                  : unitCompleted
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              }`}
            >
              {unitCompleted && "✅"} Unit {idx + 1}
              {unit.chunkInfo && (
                <span className="text-[10px] opacity-70">
                  (chunk {unit.chunkInfo.chunkNumber})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Unit Content */}
      {currentUnit && (
        <div className="border rounded-lg p-3">
          <h4 className="font-medium text-gray-800">{currentUnit.title}</h4>
          <p className="text-sm text-gray-600 mt-1">
            {currentUnit.description}
          </p>

          {/* Lessons */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {currentUnit.lessons.map((lesson, idx) => {
              const isDone = completedLessons.includes(
                `${selectedUnit}-${idx}`,
              );
              return (
                <button
                  key={lesson.id}
                  onClick={() => {
                    setSelectedLesson(idx);
                    setQuizMode(false);
                    setQuizAnswers({});
                    setShowResults(false);
                  }}
                  className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${
                    selectedLesson === idx && !quizMode
                      ? "bg-blue-500 text-white"
                      : isDone
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  {isDone && "✅"} Lesson {idx + 1}
                </button>
              );
            })}
            {currentUnit.quiz && (
              <button
                onClick={() => {
                  setQuizMode(true);
                  setQuizAnswers({});
                  setShowResults(false);
                }}
                className={`px-2 py-0.5 text-xs rounded ${
                  quizMode
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                📝 Quiz
              </button>
            )}
          </div>

          {/* Lesson Content */}
          {!quizMode && currentUnit.lessons[selectedLesson] && (
            <div className="mt-3">
              <div className="flex justify-between items-center">
                <h5 className="font-medium text-blue-600">
                  📖 {currentUnit.lessons[selectedLesson].title}
                </h5>
                {!completedLessons.includes(
                  `${selectedUnit}-${selectedLesson}`,
                ) && (
                  <button
                    onClick={() =>
                      markLessonComplete(selectedUnit, selectedLesson)
                    }
                    className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                  >
                    Mark Complete ✅
                  </button>
                )}
                {completedLessons.includes(
                  `${selectedUnit}-${selectedLesson}`,
                ) && (
                  <span className="text-xs text-green-600">✅ Completed</span>
                )}
              </div>

              {/* Structured Content */}
              <div className="mt-2 space-y-3">
                {/* Main Content */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">
                    {currentUnit.lessons[selectedLesson].content}
                  </p>
                </div>

                {/* Vocabulary Section */}
                {currentUnit.lessons[selectedLesson].vocabulary?.length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <h6 className="font-medium text-sm text-blue-700 mb-2">
                      📖 Vocabulary
                    </h6>
                    <div className="grid grid-cols-2 gap-2">
                      {currentUnit.lessons[selectedLesson].vocabulary.map(
                        (item, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2 rounded shadow-sm flex justify-between items-center"
                          >
                            <span className="font-medium text-blue-600">
                              {item.word}
                            </span>
                            <span className="text-sm text-gray-600">
                              {item.meaning}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Grammar Section */}
                {currentUnit.lessons[selectedLesson].grammar?.length > 0 && (
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <h6 className="font-medium text-sm text-yellow-700 mb-2">
                      📐 Grammar
                    </h6>
                    {currentUnit.lessons[selectedLesson].grammar.map(
                      (item, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-2 rounded shadow-sm mb-2"
                        >
                          <p className="font-medium text-yellow-700 text-sm">
                            {item.rule}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.explanation}
                          </p>
                          {item.example && (
                            <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200">
                              <span className="text-sm italic text-gray-500">
                                Example: {item.example}
                              </span>
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* Practice Section */}
                {currentUnit.lessons[selectedLesson].practice?.length > 0 && (
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <h6 className="font-medium text-sm text-purple-700 mb-2">
                      ✍️ Practice
                    </h6>
                    {currentUnit.lessons[selectedLesson].practice.map(
                      (item, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-2 rounded shadow-sm mb-2"
                        >
                          <p className="text-sm text-gray-700">
                            {item.exercise}
                          </p>
                          {item.answer && (
                            <div className="mt-1 p-2 bg-green-50 rounded border border-green-200">
                              <span className="text-sm text-green-700">
                                ✅ Answer: {item.answer}
                              </span>
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* Fun Fact */}
                {currentUnit.funFact && (
                  <div className="bg-purple-50 p-2 rounded border border-purple-200">
                    <span className="text-sm">💡 {currentUnit.funFact}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quiz */}
          {quizMode && currentUnit.quiz && (
            <div className="mt-3">
              <h5 className="font-medium text-green-600">📝 Quiz</h5>

              {currentUnit.quiz.questions.map((q, idx) => (
                <div key={idx} className="mt-3 bg-gray-50 p-3 rounded">
                  <p className="text-sm font-medium">{q.question}</p>
                  <div className="space-y-1 mt-2">
                    {q.options.map((option, optIdx) => (
                      <label
                        key={optIdx}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name={`question_${idx}`}
                          value={optIdx}
                          checked={quizAnswers[idx] === optIdx}
                          onChange={() => handleQuizAnswer(idx, optIdx)}
                          disabled={showResults}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                  {showResults && (
                    <div
                      className={`mt-2 text-sm ${
                        quizAnswers[idx] === q.answer
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {quizAnswers[idx] === q.answer
                        ? "✅ Correct!"
                        : `❌ Incorrect. The answer is: ${q.options[q.answer]}`}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleQuizComplete}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                  disabled={
                    Object.keys(quizAnswers).length !==
                    currentUnit.quiz.questions.length
                  }
                >
                  Check Answers
                </button>
                <button
                  onClick={() => {
                    setQuizAnswers({});
                    setShowResults(false);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
                >
                  Reset
                </button>
              </div>

              {showResults && (
                <div className="mt-3 p-3 bg-blue-50 rounded">
                  <p className="font-medium">
                    Score: {calculateQuizScore().correct}/
                    {calculateQuizScore().total}
                    {calculateQuizScore().correct ===
                      calculateQuizScore().total && " 🎉 Perfect!"}
                  </p>
                  {calculateQuizScore().correct ===
                    calculateQuizScore().total && (
                    <button
                      onClick={() =>
                        markLessonComplete(selectedUnit, selectedLesson)
                      }
                      className="mt-2 text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                    >
                      Mark Lesson Complete ✅
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats Footer */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-center text-gray-500">
        <div>
          <span className="block font-medium text-gray-700">{stats.units}</span>
          Units
        </div>
        <div>
          <span className="block font-medium text-gray-700">
            {stats.lessons}
          </span>
          Lessons
        </div>
        <div>
          <span className="block font-medium text-gray-700">{stats.vocab}</span>
          Words
        </div>
        <div>
          <span className="block font-medium text-gray-700">
            {stats.progress}%
          </span>
          Done
        </div>
      </div>
    </div>
  );
};

export default LanguageTeacher;
