// app/(dashboard)/questions/practice/page.tsx
// ─── Halaman latihan CBT ──────────────────────────────────────────────────────
//
// Dulu 1700+ baris: empat layar (daftar, persiapan, pengerjaan, hasil) dan
// modal pembuatan ujian dalam satu komponen dengan 25 state. Sekarang halaman
// ini hanya mengelola **session**: kuis mana yang dipilih, jawaban apa yang
// sudah diisi, berapa detik tersisa, dan apa jawaban server. Setiap layar
// menjadi komponen presentasional yang menerima data lewat props.
//
// Yang tetap di sini dengan alasan: efek pengambilan kuis (gabungan soal
// contoh + `/api/questions/approved` + `/api/exams/list`), timer, dan efek
// penilaian server — ketiganya menyentuh banyak state sekaligus sehingga
// tidak masuk ke satu layar pun.
"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { QuizListScreen } from "@/components/practice/QuizListScreen";
import { QuizPreparationScreen } from "@/components/practice/QuizPreparationScreen";
import { QuizSessionScreen } from "@/components/practice/QuizSessionScreen";
import { QuizResultsScreen } from "@/components/practice/QuizResultsScreen";
import { CreateExamModal } from "@/components/practice/CreateExamModal";
import { BASE_QUESTIONS } from "@/components/practice/baseQuestions";
import type {
  Quiz, Question, ApprovedQuestionPayload, ExamListItemPayload,
} from "@/components/practice/types";

export default function PracticeMode() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(1200);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [penaltyPoints, setPenaltyPoints] = useState<number | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [levelRewardsGranted, setLevelRewardsGranted] = useState<string[]>([]);
  const [blockedByAntiCheat, setBlockedByAntiCheat] = useState(false);
  // Server-graded truth for the finished quiz: questionId → correctness + key.
  const [gradedResults, setGradedResults] = useState<Record<string, { correct: boolean; correctKey: string }>>({});
  // True when the finished quiz contains no database-backed questions at all.
  const [notRewardable, setNotRewardable] = useState(false);

  // ── Exam creation modal ────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Load quizzes: approved questions from the DB + custom exams from /api/exams/list ──
  useEffect(() => {
    async function loadQuizzes() {
      // Fetch approved questions from real DB API (includes isOwnQuestion flag)
      let parsedContributedQuestions: Question[] = [];
      try {
        const res = await fetch("/api/questions/approved");
        if (res.ok) {
          const { data } = await res.json();
          parsedContributedQuestions = (data as ApprovedQuestionPayload[]).map((q, index) => ({
            id: q.id || `cq-${index}`,
            text: q.questionText,
            options: {
              A: (q.options as Record<string,string>)?.A || "",
              B: (q.options as Record<string,string>)?.B || "",
              C: (q.options as Record<string,string>)?.C || "",
              D: (q.options as Record<string,string>)?.D || "",
              E: (q.options as Record<string,string>)?.E || "",
            },
            answerKey: "", // never sent to the browser any more; grading is server-side
            subject: q.subject || "Umum",
            category: q.category || "UTBK",
            uploaderId: q.uploaderId,
            isOwnQuestion: q.isOwnQuestion ?? false,
          }));
        }
      } catch {
        // Silently fall back to empty if API unavailable
      }

      const allQuizzes: Quiz[] = [
        {
          id: "quiz_mixed",
          title: "CBT Campuran Utama (UTBK & OSN)",
          subject: "Campuran",
          category: "UTBK & OSN",
          questionsCount: BASE_QUESTIONS.length,
          durationMinutes: 20,
          difficulty: "Sedang",
          icon: "📚",
          questions: BASE_QUESTIONS
        },
        {
          id: "quiz_math",
          title: "Kuis Matematika Aljabar & Trigonometri",
          subject: "Matematika",
          category: "UTBK-SNBT",
          questionsCount: BASE_QUESTIONS.filter(q => q.subject === "Matematika").length,
          durationMinutes: 10,
          difficulty: "Sulit",
          icon: "📐",
          questions: BASE_QUESTIONS.filter(q => q.subject === "Matematika")
        },
        {
          id: "quiz_physics",
          title: "Kuis Fisika Mekanika Melingkar",
          subject: "Fisika",
          category: "Olimpiade",
          questionsCount: BASE_QUESTIONS.filter(q => q.subject === "Fisika").length,
          durationMinutes: 5,
          difficulty: "Sangat Sulit",
          icon: "⚛️",
          questions: BASE_QUESTIONS.filter(q => q.subject === "Fisika")
        },
        {
          id: "quiz_biology",
          title: "Kuis Biologi Seluler & Organel Sel",
          subject: "Biologi",
          category: "Reguler",
          questionsCount: BASE_QUESTIONS.filter(q => q.subject === "Biologi").length,
          durationMinutes: 5,
          difficulty: "Mudah",
          icon: "🧬",
          questions: BASE_QUESTIONS.filter(q => q.subject === "Biologi")
        },
        {
          id: "quiz_chemistry",
          title: "Kuis Kimia Senyawa Anhidrat & Hidrat",
          subject: "Kimia",
          category: "Olimpiade",
          questionsCount: BASE_QUESTIONS.filter(q => q.subject === "Kimia").length,
          durationMinutes: 5,
          difficulty: "Sedang",
          icon: "🧪",
          questions: BASE_QUESTIONS.filter(q => q.subject === "Kimia")
        }
      ];

      if (parsedContributedQuestions.length > 0) {
        allQuizzes.unshift({
          id: "quiz_contributed",
          title: "Kuis Hasil Kontribusi Siswa SMAN 2",
          subject: "Kolaborasi",
          category: "Kontribusi CBT",
          questionsCount: parsedContributedQuestions.length,
          durationMinutes: Math.max(5, parsedContributedQuestions.length * 4),
          difficulty: "Bervariasi",
          icon: "🏆",
          questions: parsedContributedQuestions,
          author: "Siswa SMAN 2 Jonggol"
        });
      }

      // Load student-created custom exams from DB (visible to all users)
      try {
        const examRes = await fetch("/api/exams/list");
        if (examRes.ok) {
          const { data: dbExams } = await examRes.json();
          (dbExams as ExamListItemPayload[]).forEach((exam) => {
            const qs: Question[] = (exam.questions ?? []).map((q) => ({
              id: q.id,
              text: q.text,
              options: q.options,
              // /api/exams/list strips the key server-side. A blank key here is not
              // a fallback — it is the promise that grading happens in
              // /api/exams/submit, where the browser cannot see the answers.
              answerKey: "",
              explanation: q.explanation ?? null,
              subject: exam.subject,
              category: exam.category,
            }));
            allQuizzes.push({
              id: exam.id,
              title: exam.title,
              subject: exam.subject,
              category: exam.category,
              questionsCount: qs.length,
              durationMinutes: exam.durationMinutes,
              difficulty: exam.difficulty,
              icon: "✏️",
              questions: qs,
              author: exam.authorName || "Siswa SMAN 2",
              isCustom: true,
            });
          });
        }
      } catch {
        // Silently ignore if API unavailable
      }

      setQuizzes(allQuizzes);
    }
    loadQuizzes();
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isStarted || timeLeft <= 0 || isFinished || questions.length === 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isStarted, timeLeft, isFinished, questions]);

  // ── Auto-finish on timer end ──────────────────────────────────────────────
  useEffect(() => {
    if (isStarted && timeLeft === 0 && !isFinished) setTimeout(() => setIsFinished(true), 0);
  }, [isStarted, timeLeft, isFinished]);

  const handleSelectQuiz = (quiz: Quiz) => {
    // Anti-cheat: for the contributed quiz, filter out questions created by current user
    let quizQuestions = quiz.questions;
    let blocked = false;
    if (quiz.id === "quiz_contributed") {
      const available = quiz.questions.filter((q) => !q.isOwnQuestion);
      if (available.length === 0 && quiz.questions.length > 0) {
        // All questions were created by this user
        blocked = true;
      } else {
        quizQuestions = available;
      }
    }

    setBlockedByAntiCheat(blocked);
    setSelectedQuiz(quiz);
    setQuestions(quizQuestions);
    setTimeLeft(quiz.durationMinutes * 60);
    setAnswers({});
    setCurrentIndex(0);
    setIsStarted(false);
    setIsFinished(false);
    setPointsAwarded(null);
    setPenaltyPoints(null);
  };

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
  };

  const calculateCorrectCount = () => {
    let correct = 0;
    questions.forEach((q) => {
      // The server's verdict wins; the local key is only a fallback for the
      // sample/demo quizzes that are not stored in the database.
      const graded = gradedResults[q.id];
      if (graded) {
        if (graded.correct) correct++;
        return;
      }
      if (q.answerKey && answers[q.id] === q.answerKey) correct++;
    });
    return correct;
  };

  // ── Grade the quiz on the server when it is finished ──────────────────────
  // The browser sends only the answers it collected. The score, the reward and
  // the anti-replay key are all decided by the server from the stored keys.
  //
  // Custom exams are a jsonb blob rather than rows in `questions`, so they have
  // their own grader. Both endpoints answer with the same shape, so everything
  // below is shared — and neither trusts a score from the client.
  useEffect(() => {
    if (!isFinished || !selectedQuiz) return;

    setTimeout(() => setPointsLoading(true), 0);
    const isCustom = selectedQuiz.isCustom === true;
    fetch(isCustom ? "/api/exams/submit" : "/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isCustom ? { examId: selectedQuiz.id, answers } : { answers }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) return;

        if (Array.isArray(data.results)) {
          const map: Record<string, { correct: boolean; correctKey: string }> = {};
          for (const r of data.results as { questionId: string; correct: boolean; correctKey: string }[]) {
            map[r.questionId] = { correct: r.correct, correctKey: r.correctKey };
          }
          setGradedResults(map);
        }

        setNotRewardable(data.rewardable === false);
        setPointsAwarded(data.pointsAwarded ?? 0);
        setPenaltyPoints(data.penaltyPoints ?? 0);
        setAlreadyCompleted(data.alreadyCompleted ?? false);
        setLevelRewardsGranted(data.levelRewards ?? []);
      })
      .catch((err) => console.error("Quiz grading error:", err))
      .finally(() => setPointsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  const handleRestart = () => {
    setAnswers({});
    setCurrentIndex(0);
    setTimeLeft(selectedQuiz ? selectedQuiz.durationMinutes * 60 : 1200);
    setIsStarted(false);
    setIsFinished(false);
    setPointsAwarded(null);
    setPenaltyPoints(null);
    setAlreadyCompleted(false);
    setLevelRewardsGranted([]);
    setBlockedByAntiCheat(false);
    setGradedResults({});
    setNotRewardable(false);
  };

  // ── Delete custom exam (removes from UI only; DB deletion not exposed)  ───
  const handleDeleteCustomExam = (examId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Sembunyikan ujian ini dari daftar lokal? (Ujian tetap tersimpan di server dan masih terlihat pengguna lain)")) return;
    setQuizzes((prev) => prev.filter((q) => q.id !== examId));
  };

  // ── Computed values ───────────────────────────────────────────────────────
  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;
  const correctCount = calculateCorrectCount();
  const finalScore = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
  const wrongCount = questions.length - correctCount;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Quiz selection list
  // ══════════════════════════════════════════════════════════════════════════
  if (!selectedQuiz) {
    return (
      <>
        <QuizListScreen
          quizzes={quizzes}
          onSelectQuiz={handleSelectQuiz}
          onOpenCreateModal={() => setShowCreateModal(true)}
          onDeleteCustomExam={handleDeleteCustomExam}
        />
        {showCreateModal && (
          <CreateExamModal
            onClose={() => setShowCreateModal(false)}
            onExamCreated={(quiz) => {
              setQuizzes((prev) => [...prev, quiz]);
              setShowCreateModal(false);
            }}
          />
        )}
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Loading state (quiz selected but questions somehow empty)
  // ══════════════════════════════════════════════════════════════════════════
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center gap-4">
        <AlertTriangle className="h-12 w-12 text-nawa-warning" />
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Paket Ini Belum Memiliki Soal</h3>
        <p className="text-xs text-zinc-500 max-w-xs">
          Ujian ini belum diisi pertanyaan. Tambahkan soal melalui fitur Buat Ujian Baru atau pilih paket lain.
        </p>
        <button
          onClick={() => setSelectedQuiz(null)}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nawa-primary text-white text-sm font-bold hover:bg-nawa-primary-hover transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Quiz preparation screen
  // ══════════════════════════════════════════════════════════════════════════
  if (!isStarted) {
    return (
      <QuizPreparationScreen
        quiz={selectedQuiz}
        blockedByAntiCheat={blockedByAntiCheat}
        onBack={() => setSelectedQuiz(null)}
        onStart={() => setIsStarted(true)}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Results screen
  // ══════════════════════════════════════════════════════════════════════════
  if (isFinished) {
    return (
      <QuizResultsScreen
        questions={questions}
        answers={answers}
        gradedResults={gradedResults}
        timeLeft={timeLeft}
        correctCount={correctCount}
        wrongCount={wrongCount}
        finalScore={finalScore}
        pointsLoading={pointsLoading}
        pointsAwarded={pointsAwarded}
        penaltyPoints={penaltyPoints}
        alreadyCompleted={alreadyCompleted}
        notRewardable={notRewardable}
        levelRewardsGranted={levelRewardsGranted}
        onRestart={handleRestart}
        onBackToList={() => setSelectedQuiz(null)}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Active quiz session
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <QuizSessionScreen
      quiz={selectedQuiz}
      questions={questions}
      currentIndex={currentIndex}
      answers={answers}
      timeLeft={timeLeft}
      answeredCount={answeredCount}
      progressPercent={progressPercent}
      onSelectOption={handleSelectOption}
      onPrev={() => setCurrentIndex((p) => Math.max(0, p - 1))}
      onNext={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))}
      onJumpTo={setCurrentIndex}
      onFinish={() => setIsFinished(true)}
    />
  );
}
