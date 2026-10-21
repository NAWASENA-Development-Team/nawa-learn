"use client";

import { useState, useEffect } from "react";
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
import { LatexRenderer } from "@/components/ui/LatexRenderer";

interface Question {
  id: string;
  questionText: string;
  // The options object is `{ A: "...", B: "...", ... }` (jsonb in the database).
  // Typing it as `Record<string, string>` rather than `any` is what lets
  // `Object.entries` below hand back `string` keys and values instead of `any`.
  options: Record<string, string>;
  // No `answerKey` here on purpose: the server grades every answer and hands
  // back the correct key only after the answer has been committed.
}

interface DailyQuizClientProps {
  initialQuestions: Question[];
}

export default function DailyQuizClient({ initialQuestions }: DailyQuizClientProps) {
  // Queue of questions to answer.
  //
  // `initialQuestions` arrives **already shuffled and already capped at 20** by
  // the page. It used to arrive whole, and this component shuffled it in a
  // `useEffect` on mount. That had three costs: the browser downloaded every
  // question in the category to throw most of them away, the first paint showed
  // no question at all, and the effect was a setState-during-effect that React
  // flags as a cascading render. Randomness does not need to happen on the
  // client at all — it only needs to happen *somewhere*, and the server is
  // cheaper and hydration-safe.
  const [queue, setQueue] = useState<Question[]>(initialQuestions);
  const [masteredCount, setMasteredCount] = useState(0);
  // Derived, not state: it can never change for a given session, and a
  // `useState` whose setter is never called is just a constant with extra
  // bookkeeping.
  const totalQuestions = initialQuestions.length;

  // Current question state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  // Verdict returned by the server after "Cek Jawaban": correctness + the key.
  const [revealed, setRevealed] = useState<{ correct: boolean; correctKey: string } | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [streak, setStreak] = useState(0);

  const currentQ = queue[0];
  const isFinished = queue.length === 0 && totalQuestions > 0;
  const progressPercent = totalQuestions > 0 ? (masteredCount / totalQuestions) * 100 : 0;

  const [claimResult, setClaimResult] = useState<{success: boolean, message: string} | null>(null);
  // Derived, not stored: "still claiming" is exactly "the session just finished
  // and no answer has come back yet". A separate `isClaiming` state had to be
  // set true synchronously inside the effect and false in `.finally` — two
  // writes that could disagree with `claimResult`, for a value that is a pure
  // function of it.
  const isClaiming = isFinished && claimResult === null;

  useEffect(() => {
    if (!isFinished) return;
    fetch("/api/quiz/daily-claim", { method: "POST" })
      .then(res => res.json())
      .then(data => setClaimResult(data))
      .catch(() => setClaimResult({ success: false, message: "Gagal memproses hadiah." }));
  }, [isFinished]);

  const handleSelect = (key: string) => {
    if (revealed) return;
    setSelectedOption(key);
  };

  const handleCheck = async () => {
    if (!selectedOption || !currentQ || isChecking) return;

    setIsChecking(true);
    try {
      // The answer key lives on the server. We submit the single answer and get
      // the verdict back — the browser never holds the correct answer.
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { [currentQ.id]: selectedOption } }),
      });
      const data = await res.json();
      const graded = data?.results?.[0] as { correct: boolean; correctKey: string } | undefined;
      if (!data?.success || !graded) return;

      setRevealed({ correct: graded.correct, correctKey: graded.correctKey });

      if (graded.correct) {
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
    } catch (err) {
      console.error("Quiz check error:", err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleNext = () => {
    const isCorrect = revealed?.correct ?? false;

    setQueue(prev => {
      const newQueue = [...prev.slice(1)];
      if (!isCorrect) {
        // Spaced repetition: if wrong, put it back in the queue
        // Put it at the end or halfway
        const insertIndex = Math.min(newQueue.length, 3);
        newQueue.splice(insertIndex, 0, currentQ);
      }
      return newQueue;
    });

    // Outside the updater on purpose: a state updater must be pure, and React
    // calls it twice in development StrictMode to prove it. Incrementing the
    // mastered count from inside meant every correct answer counted twice.
    if (isCorrect) setMasteredCount(m => m + 1);

    setSelectedOption(null);
    setRevealed(null);
  };

  if (initialQuestions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <BrainCircuit className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">Belum Ada Soal</h2>
        <p className="text-zinc-500 mt-2 mb-6">Tunggu kontributor mengunggah soal latihan terlebih dahulu.</p>
        <Link href="/questions/practice" className="text-nawa-primary font-bold hover:underline">
          Kembali ke Latihan Reguler
        </Link>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center animate-in zoom-in duration-500">
        <Trophy className="h-24 w-24 text-nawa-warning mx-auto mb-6 drop-shadow-xl" />
        <h2 className="text-4xl font-black text-zinc-900 dark:text-white mb-4">Sesi Kuis Selesai!</h2>
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
            className="flex items-center gap-2 bg-nawa-primary hover:bg-nawa-primary-hover text-white px-6 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/30"
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
            !revealed ? "bg-indigo-500" :
            revealed.correct ? "bg-nawa-success" : "bg-red-500"
          }`} />

          <div className="p-6 sm:p-8">
            <div className="min-h-[120px] mb-8">
              <h3 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-zinc-100 leading-relaxed">
                <LatexRenderer text={currentQ.questionText} />
              </h3>
            </div>

            <div className="space-y-3">
              {Object.entries(currentQ.options).map(([key, text]) => {
                const isSelected = selectedOption === key;
                const isCorrectAnswer = key === revealed?.correctKey;
                
                let btnClass = "border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50";
                let checkIcon = null;

                if (revealed) {
                  if (isCorrectAnswer) {
                    btnClass = "border-nawa-success bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 ring-1 ring-nawa-success";
                    checkIcon = <CheckCircle2 className="h-5 w-5 text-nawa-success shrink-0" />;
                  } else if (isSelected && !isCorrectAnswer) {
                    btnClass = "border-red-500 bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-100 ring-1 ring-red-500";
                    checkIcon = <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
                  } else {
                    btnClass = "border-zinc-200 dark:border-zinc-800 opacity-40";
                  }
                } else if (isSelected) {
                  btnClass = "border-nawa-primary bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-nawa-primary";
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleSelect(key)}
                    disabled={revealed !== null}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] ${btnClass}`}
                  >
                    <div className="flex gap-3.5 items-start">
                      <span className={`h-6 w-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                        revealed && isCorrectAnswer ? "bg-emerald-600 text-white" :
                        revealed && isSelected && !isCorrectAnswer ? "bg-red-600 text-white" :
                        isSelected ? "bg-nawa-primary text-white" :
                        "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}>
                        {key}
                      </span>
                      <span className={`text-sm font-medium ${
                        revealed && isCorrectAnswer ? "text-emerald-950 dark:text-emerald-100 font-semibold" :
                        revealed && isSelected && !isCorrectAnswer ? "text-red-950 dark:text-red-100 font-semibold" :
                        "text-zinc-800 dark:text-zinc-200"
                      }`}>
                        <LatexRenderer text={text as string} />
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
            
            {!revealed ? (
              <button
                onClick={handleCheck}
                disabled={!selectedOption || isChecking}
                className="bg-nawa-primary hover:bg-nawa-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                {isChecking ? "Memeriksa..." : "Cek Jawaban"} <CheckCircle2 className="h-4 w-4" />
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
