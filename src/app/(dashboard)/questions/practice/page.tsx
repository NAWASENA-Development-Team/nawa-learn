// app/(dashboard)/questions/practice/page.tsx
"use client";

import { useState, useEffect } from "react";

// Mock type for the example. In production, fetch this from the API/DB.
type Question = {
  id: string;
  text: string;
  options: Record<string, string>;
  answerKey: string;
};

export default function PracticeMode() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(1200); // 20 minutes
  const [isFinished, setIsFinished] = useState(false);

  // Timer logic
  useEffect(() => {
    if (timeLeft <= 0 || isFinished) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isFinished]);

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.answerKey) correct++;
    });
    return Math.round((correct / questions.length) * 100);
  };

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">Practice Complete!</h2>
        <div className="text-6xl font-black text-indigo-600">{calculateScore()}%</div>
        <p className="text-zinc-500">Review your mistakes and keep practicing.</p>
      </div>
    );
  }

  // Placeholder render for when questions are loading or empty
  if (!questions.length) return <div className="p-8 text-center text-zinc-500">Loading questions...</div>;

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-3xl mx-auto p-6 mt-8 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-500">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="text-indigo-600 font-mono font-semibold">
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
        </span>
      </div>

      <p className="text-lg text-zinc-900 dark:text-zinc-100 mb-8">{currentQ.text}</p>

      <div className="space-y-3">
        {Object.entries(currentQ.options).map(([key, value]) => (
          <button
            key={key}
            onClick={() => handleSelectOption(currentQ.id, key)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              answers[currentQ.id] === key 
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300" 
                : "border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700"
            }`}
          >
            <span className="font-semibold uppercase mr-3">{key}.</span> {value}
          </button>
        ))}
      </div>

      <div className="flex justify-between mt-8 pt-6">
        <button 
          onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 text-sm text-zinc-600 disabled:opacity-50"
        >
          Previous
        </button>
        
        {currentIndex === questions.length - 1 ? (
          <button 
            onClick={() => setIsFinished(true)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-500 font-medium"
          >
            Submit Test
          </button>
        ) : (
          <button 
            onClick={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-500 font-medium"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}