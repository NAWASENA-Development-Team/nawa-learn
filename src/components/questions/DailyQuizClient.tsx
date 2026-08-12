"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  BrainCircuit, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Flame,
  RotateCcw,
  Trophy
} from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";

interface Question {
  id: string;
  questionText: string;
  options: any;
  answerKey: string;
}

interface DailyQuizClientProps {
  initialQuestions: Question[];
}

export default function DailyQuizClient({ initialQuestions }: DailyQuizClientProps) {
  // Shuffle array utility
  const shuffle = (array: any[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  // Queue of questions to answer
  const [queue, setQueue] = useState<Question[]>([]);
  const [masteredCount, setMasteredCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  
  // Current question state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [streak, setStreak] = useState(0);

  // Initialize queue on mount
  useEffect(() => {
    if (initialQuestions.length > 0) {
      // Limit to 20 questions for a session to not overwhelm
      const sessionQuestions = shuffle(initialQuestions).slice(0, 20);
      setQueue(sessionQuestions);
      setTotalQuestions(sessionQuestions.length);
    }
  }, [initialQuestions]);

  const currentQ = queue[0];
  const isFinished = queue.length === 0 && totalQuestions > 0;
  const progressPercent = totalQuestions > 0 ? (masteredCount / totalQuestions) * 100 : 0;

  const [claimResult, setClaimResult] = useState<{success: boolean, message: string} | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (isFinished) {
      setIsClaiming(true);
      fetch("/api/quiz/daily-claim", { method: "POST" })
        .then(res => res.json())
        .then(data => setClaimResult(data))
        .catch(err => setClaimResult({ success: false, message: "Gagal memproses hadiah." }))
        .finally(() => setIsClaiming(false));
    }
  }, [isFinished]);

  const handleSelect = (key: string) => {
    if (isRevealed) return;
    setSelectedOption(key);
  };

  const handleCheck = () => {
    if (!selectedOption) return;
    setIsRevealed(true);
    
    if (selectedOption === currentQ.answerKey) {
      setStreak(s => s + 1);
      if (streak + 1 > 3 && (streak + 1) % 3 === 0) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#a855f7', '#6366f1', '#3b82f6']
        });
      }
    } else {
      setStreak(0);
    }
  };

  const handleNext = () => {
    const isCorrect = selectedOption === currentQ.answerKey;
    
    setQueue(prev => {
      const newQueue = [...prev.slice(1)];
      if (!isCorrect) {
        // Spaced repetition: if wrong, put it back in the queue
        // Put it at the end or halfway
        const insertIndex = Math.min(newQueue.length, 3);
        newQueue.splice(insertIndex, 0, currentQ);
      } else {
        setMasteredCount(m => m + 1);
      }
      return newQueue;
    });
    
    setSelectedOption(null);
    setIsRevealed(false);
  };

  if (initialQuestions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <BrainCircuit className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">Belum Ada Soal</h2>
        <p className="text-zinc-500 mt-2 mb-6">Tunggu kontributor mengunggah soal latihan terlebih dahulu.</p>
        <Link href="/questions/practice" className="text-indigo-600 font-bold hover:underline">
          Kembali ke Latihan Reguler
        </Link>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center animate-in zoom-in duration-500">
        <Trophy className="h-24 w-24 text-yellow-500 mx-auto mb-6 drop-shadow-xl" />
        <h2 className="text-4xl font-black text-zinc-900 dark:text-white mb-4">Sesi Selesai! 🎉</h2>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6 max-w-lg mx-auto">
          Luar biasa! Kamu telah menguasai {totalQuestions} soal di sesi ini. Otakmu makin tajam!
        </p>
        
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-8 max-w-md mx-auto">
          {isClaiming ? (
            <p className="text-zinc-500 font-bold animate-pulse">Memproses hadiah harian...</p>
          ) : claimResult ? (
            <div>
              <p className={`font-bold text-lg mb-2 ${claimResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {claimResult.message}
              </p>
              {!claimResult.success && <p className="text-sm text-zinc-500">Kerjakan lagi besok untuk mendapatkan hadiah!</p>}
            </div>
          ) : null}
        </div>
        <div className="flex justify-center gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/30"
          >
            <RotateCcw className="h-5 w-5" /> Latihan Lagi
          </button>
          <Link 
            href="/questions/practice"
            className="flex items-center gap-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 px-6 py-3 rounded-2xl font-bold transition-all active:scale-95"
          >
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2 text-zinc-900 dark:text-white">
            <BrainCircuit className="h-8 w-8 text-indigo-500" /> Kuis Adaptif
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-medium">
            Soal yang salah akan terus diulang sampai kamu benar-benar paham.
          </p>
        </div>
        
        {/* Streak counter */}
        {streak > 1 && (
          <div className="bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900 px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-in pop-in">
            <Flame className="h-4 w-4 fill-current" />
            <span className="text-xs font-black">{streak} Streak!</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs font-bold text-zinc-500 mb-2">
          <span>Progres Penguasaan</span>
          <span>{masteredCount} / {totalQuestions} Soal</span>
        </div>
        <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Flashcard / Question Card */}
      {currentQ && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden relative transition-all duration-300">
          {/* Card Top Banner (shows red/green if revealed) */}
          <div className={`h-2 w-full transition-colors duration-300 ${
            !isRevealed ? "bg-indigo-500" :
            selectedOption === currentQ.answerKey ? "bg-emerald-500" : "bg-red-500"
          }`} />

          <div className="p-6 sm:p-8">
            <div className="min-h-[120px] mb-8">
              <h3 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
                {currentQ.questionText}
              </h3>
            </div>

            <div className="space-y-3">
              {Object.entries(currentQ.options).map(([key, text]) => {
                const isSelected = selectedOption === key;
                const isCorrectAnswer = key === currentQ.answerKey;
                
                let btnClass = "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20";
                let checkIcon = null;

                if (isRevealed) {
                  if (isCorrectAnswer) {
                    btnClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500";
                    checkIcon = <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
                  } else if (isSelected && !isCorrectAnswer) {
                    btnClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100 ring-1 ring-red-500";
                    checkIcon = <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
                  } else {
                    btnClass = "border-zinc-200 dark:border-zinc-800 opacity-50";
                  }
                } else if (isSelected) {
                  btnClass = "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500";
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleSelect(key)}
                    disabled={isRevealed}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 ${btnClass}`}
                  >
                    <div className="flex gap-4 items-start">
                      <span className={`font-black mt-0.5 ${
                        isRevealed && isCorrectAnswer ? "text-emerald-600 dark:text-emerald-400" :
                        isRevealed && isSelected && !isCorrectAnswer ? "text-red-600 dark:text-red-400" :
                        isSelected ? "text-indigo-600 dark:text-indigo-400" :
                        "text-zinc-400"
                      }`}>
                        {key}
                      </span>
                      <span className={`font-medium ${
                        isRevealed && isCorrectAnswer ? "text-emerald-900 dark:text-emerald-100" :
                        isRevealed && isSelected && !isCorrectAnswer ? "text-red-900 dark:text-red-100" :
                        "text-zinc-700 dark:text-zinc-300"
                      }`}>
                        {text as string}
                      </span>
                    </div>
                    {checkIcon}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Action Bar */}
          <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Sisa {queue.length} Soal
            </span>
            
            {!isRevealed ? (
              <button
                onClick={handleCheck}
                disabled={!selectedOption}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                Cek Jawaban <CheckCircle2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                Lanjut <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
