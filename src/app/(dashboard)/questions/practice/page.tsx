// app/(dashboard)/questions/practice/page.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  BookOpen, 
  RotateCcw, 
  Award, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  User,
  GraduationCap,
  FileText,
  PlusCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Minus
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Question = {
  id: string;
  text: string;
  options: Record<string, string>;
  answerKey: string;
  subject: string;
  category: string;
};

type Quiz = {
  id: string;
  title: string;
  subject: string;
  category: string;
  questionsCount: number;
  durationMinutes: number;
  difficulty: string;
  icon: string;
  questions: Question[];
  author?: string;
  isCustom?: boolean;
};

type QuestionDraft = {
  text: string;
  optA: string; optB: string; optC: string; optD: string; optE: string;
  answerKey: string;
};

// ─── Constants & helpers ──────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS = ["Mudah", "Sedang", "Sulit", "Sangat Sulit"];
const CATEGORY_OPTIONS = ["UTBK-SNBT", "Olimpiade (OSN)", "Ujian Harian", "Reguler", "Campuran"];
const EMPTY_DRAFT: QuestionDraft = {
  text: "", optA: "", optB: "", optC: "", optD: "", optE: "", answerKey: "A",
};

function getDifficultyStyle(difficulty: string): string {
  const d = difficulty.toLowerCase();
  if (d === "mudah")
    return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30";
  if (d === "sedang" || d === "bervariasi")
    return "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30";
  if (d === "sulit")
    return "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30";
  if (d === "sangat sulit")
    return "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30";
  return "bg-zinc-50 dark:bg-zinc-950/30 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-900/30";
}

// ─── Base question bank ───────────────────────────────────────────────────────

const BASE_QUESTIONS: Question[] = [
  {
    id: "q1",
    subject: "Fisika",
    category: "Olimpiade",
    text: "Sebuah partikel bergerak melingkar beraturan dengan jari-jari lintasan 2 meter. Jika partikel tersebut melakukan 120 putaran per menit, maka percepatan sentripetal partikel tersebut adalah...",
    options: {
      A: "8π² m/s²",
      B: "16π² m/s²",
      C: "32π² m/s²",
      D: "64π² m/s²",
      E: "128π² m/s²"
    },
    answerKey: "C"
  },
  {
    id: "q2",
    subject: "Matematika",
    category: "UTBK",
    text: "Tentukan nilai limit x mendekati 0 untuk fungsi aljabar trigonometri berikut: (cos(4x) - 1) / (x · tan(2x)) adalah...",
    options: {
      A: "-4",
      B: "-2",
      C: "0",
      D: "2",
      E: "4"
    },
    answerKey: "A"
  },
  {
    id: "q3",
    subject: "Biologi",
    category: "Reguler",
    text: "Organel sel eukariotik ganda yang berperan aktif dalam proses sintesis lipid, metabolisme karbohidrat, detoksifikasi racun, serta menyimpan ion kalsium di dalam sel adalah...",
    options: {
      A: "Mitokondria",
      B: "Ribosom",
      C: "Retikulum Endoplasma Kasar",
      D: "Retikulum Endoplasma Halus",
      E: "Aparatus Golgi"
    },
    answerKey: "D"
  },
  {
    id: "q4",
    subject: "Kimia",
    category: "Olimpiade",
    text: "Sebanyak 10 gram senyawa hidrat tembaga(II) sulfat (CuSO₄·xH₂O) dipanaskan hingga semua air kristalnya menguap. Jika massa zat anhidrat yang tersisa adalah 6,4 gram, maka nilai x dalam rumus hidrat tersebut adalah... (Ar Cu=64, S=32, O=16, H=1)",
    options: {
      A: "1",
      B: "2",
      C: "3",
      D: "4",
      E: "5"
    },
    answerKey: "E"
  },
  {
    id: "q5",
    subject: "Matematika",
    category: "UTBK",
    text: "Dalam sebuah kotak terdapat 5 bola merah dan 3 bola putih. Jika diambil 2 bola secara acak sekaligus, peluang terambilnya minimal 1 bola merah adalah...",
    options: {
      A: "15/28",
      B: "20/28",
      C: "22/28",
      D: "25/28",
      E: "27/28"
    },
    answerKey: "D"
  }
];

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ── Exam creation modal ────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<"meta" | "questions">("meta");
  const [examMeta, setExamMeta] = useState({
    title: "",
    subject: "",
    category: "UTBK-SNBT",
    difficulty: "Sedang",
    durationMinutes: 30,
    questionCount: 5,
  });
  const [examDrafts, setExamDrafts] = useState<QuestionDraft[]>([]);
  const [examQIdx, setExamQIdx] = useState(0);

  // ── Load quizzes + custom exams from localStorage ─────────────────────────
  useEffect(() => {
    const approvedRaw = localStorage.getItem("approved_questions");
    const approvedList = approvedRaw ? JSON.parse(approvedRaw) : [];

    const parsedContributedQuestions = approvedList.map((q: any, index: number) => ({
      id: q.id || `cq-${index}`,
      text: q.text,
      options: {
        A: q.options?.A || "",
        B: q.options?.B || "",
        C: q.options?.C || "",
        D: q.options?.D || "",
        E: q.options?.E || "",
      },
      answerKey: q.answerKey,
      subject: q.subject || "Matematika",
      category: q.category || "UTBK"
    }));

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

    // Load student-created custom exams
    const customRaw = localStorage.getItem("custom_exams");
    const customList: any[] = customRaw ? JSON.parse(customRaw) : [];
    customList.forEach((exam) => {
      allQuizzes.push({
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        category: exam.category,
        questionsCount: exam.questions.length,
        durationMinutes: exam.durationMinutes,
        difficulty: exam.difficulty,
        icon: "✏️",
        questions: exam.questions,
        author: exam.author || "Siswa SMAN 2",
        isCustom: true,
      });
    });

    setQuizzes(allQuizzes);
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isStarted || timeLeft <= 0 || isFinished || questions.length === 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isStarted, timeLeft, isFinished, questions]);

  // ── Auto-finish on timer end ──────────────────────────────────────────────
  useEffect(() => {
    if (isStarted && timeLeft === 0 && !isFinished) setIsFinished(true);
  }, [isStarted, timeLeft, isFinished]);

  const handleSelectQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setQuestions(quiz.questions);
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
      if (answers[q.id] === q.answerKey) correct++;
    });
    return correct;
  };

  // ── Award V-Points when quiz is finished ──────────────────────────────────
  useEffect(() => {
    if (!isFinished || !selectedQuiz) return;

    const correct = questions.filter(q => answers[q.id] === q.answerKey).length;
    const wrong = questions.length - correct;
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;

    setPointsLoading(true);
    fetch("/api/quiz/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId: selectedQuiz.id,
        difficulty: selectedQuiz.difficulty,
        score,
        wrongAnswers: wrong,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPointsAwarded(data.pointsAwarded);
          setPenaltyPoints(data.penaltyPoints ?? 0);
        }
      })
      .catch((err) => console.error("Quiz point award error:", err))
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
  };

  // ── Delete custom exam ────────────────────────────────────────────────────
  const handleDeleteCustomExam = (examId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Hapus ujian buatan ini?")) return;
    const customRaw = localStorage.getItem("custom_exams");
    const list: any[] = customRaw ? JSON.parse(customRaw) : [];
    const updated = list.filter((ex) => ex.id !== examId);
    localStorage.setItem("custom_exams", JSON.stringify(updated));
    setQuizzes((prev) => prev.filter((q) => q.id !== examId));
  };

  // ── Create exam modal handlers ────────────────────────────────────────────
  const openCreateModal = () => {
    setExamMeta({ title: "", subject: "", category: "UTBK-SNBT", difficulty: "Sedang", durationMinutes: 30, questionCount: 5 });
    setExamDrafts([]);
    setExamQIdx(0);
    setCreateStep("meta");
    setShowCreateModal(true);
  };

  const handleMetaNext = () => {
    if (!examMeta.title.trim() || !examMeta.subject.trim()) {
      alert("Judul ujian dan mata pelajaran wajib diisi.");
      return;
    }
    if (examMeta.questionCount < 1 || examMeta.questionCount > 50) {
      alert("Jumlah soal harus antara 1–50.");
      return;
    }
    // Initialise blank drafts
    setExamDrafts(Array(examMeta.questionCount).fill(null).map(() => ({ ...EMPTY_DRAFT })));
    setExamQIdx(0);
    setCreateStep("questions");
  };

  const saveDraftAndGo = (direction: "next" | "prev") => {
    // Current draft is already tracked via examDrafts state (updated live)
    if (direction === "next") setExamQIdx((i) => Math.min(examDrafts.length - 1, i + 1));
    else setExamQIdx((i) => Math.max(0, i - 1));
  };

  const updateDraft = (field: keyof QuestionDraft, value: string) => {
    setExamDrafts((prev) => {
      const copy = [...prev];
      copy[examQIdx] = { ...copy[examQIdx], [field]: value };
      return copy;
    });
  };

  const handleSaveExam = () => {
    // Validate all questions have text + all options + answer key
    const incomplete = examDrafts.findIndex(
      (d) => !d.text.trim() || !d.optA.trim() || !d.optB.trim() || !d.optC.trim() || !d.optD.trim() || !d.optE.trim()
    );
    if (incomplete !== -1) {
      alert(`Soal nomor ${incomplete + 1} belum lengkap. Isi semua teks soal dan opsi A–E.`);
      setExamQIdx(incomplete);
      return;
    }

    const newId = `custom_${Date.now()}`;
    const questions: Question[] = examDrafts.map((d, i) => ({
      id: `${newId}_q${i}`,
      text: d.text,
      options: { A: d.optA, B: d.optB, C: d.optC, D: d.optD, E: d.optE },
      answerKey: d.answerKey,
      subject: examMeta.subject,
      category: examMeta.category,
    }));

    const newExam = {
      id: newId,
      title: examMeta.title,
      subject: examMeta.subject,
      category: examMeta.category,
      difficulty: examMeta.difficulty,
      durationMinutes: examMeta.durationMinutes,
      questions,
      author: "Siswa SMAN 2",
      createdAt: new Date().toISOString(),
    };

    // Persist
    const customRaw = localStorage.getItem("custom_exams");
    const list: any[] = customRaw ? JSON.parse(customRaw) : [];
    localStorage.setItem("custom_exams", JSON.stringify([...list, newExam]));

    // Add to quizzes state
    setQuizzes((prev) => [...prev, {
      id: newId,
      title: examMeta.title,
      subject: examMeta.subject,
      category: examMeta.category,
      questionsCount: questions.length,
      durationMinutes: examMeta.durationMinutes,
      difficulty: examMeta.difficulty,
      icon: "✏️",
      questions,
      author: "Siswa SMAN 2",
      isCustom: true,
    }]);

    setShowCreateModal(false);
    alert(`✅ Ujian "${examMeta.title}" berhasil dibuat dan tersedia di daftar paket!`);
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
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 text-left animate-in fade-in duration-200">

        {/* Header banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-zinc-955 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden mb-8 border border-zinc-800 shadow-xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest mb-3">
              <GraduationCap className="h-3.5 w-3.5" /> NAWA-LEARN CBT PRACTICE
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Pilih Paket Ujian CBT Latihan
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 mt-2 max-w-2xl leading-relaxed">
              Tingkatkan kesiapan akademis Anda dengan mengerjakan paket simulasi kuis pilihan ganda real-time yang dirancang khusus mengikuti standar UTBK, Olimpiade (OSN), dan ujian reguler.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">📚</div>
            <div>
              <p className="text-[10px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">Paket Ujian</p>
              <p className="text-sm font-extrabold text-zinc-850 dark:text-zinc-200">{quizzes.length} Tersedia</p>
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">🏆</div>
            <div>
              <p className="text-[10px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">Kolaborasi Siswa</p>
              <p className="text-sm font-extrabold text-emerald-650 dark:text-emerald-450 font-bold">
                {quizzes.some(q => q.id === "quiz_contributed") ? "Aktif & Terbuka" : "Menunggu Draf"}
              </p>
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">⚡</div>
            <div>
              <p className="text-[10px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">Sistem Penalti</p>
              <p className="text-sm font-extrabold text-zinc-850 dark:text-zinc-200">-2% / Jawaban Salah</p>
            </div>
          </div>
        </div>

        {/* Quiz list */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Daftar Paket Simulasi CBT SMAN 2
            </h3>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/40 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Buat Ujian Baru
            </button>
          </div>

          <div className="space-y-3">
            {quizzes.map((quiz) => {
              const isContributed = quiz.id === "quiz_contributed";
              const isEmpty = quiz.questions.length === 0;

              return (
                <div
                  key={quiz.id}
                  className={`flex flex-col md:flex-row md:items-center justify-between p-4 bg-white dark:bg-zinc-900 border rounded-2xl gap-4 transition-all duration-200 group text-left ${
                    isEmpty
                      ? "border-zinc-200 dark:border-zinc-800 opacity-60"
                      : isContributed
                        ? "border-amber-300 dark:border-amber-800 bg-amber-50/5 dark:bg-amber-950/5 shadow-inner shadow-amber-500/[0.02] hover:shadow-md"
                        : quiz.isCustom
                          ? "border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/5 hover:shadow-md"
                          : "border-zinc-200 dark:border-zinc-800 hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500/55"
                  }`}
                >
                  {/* Left: icon + title */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-lg border ${
                      isContributed
                        ? "bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900 text-amber-650"
                        : quiz.isCustom
                          ? "bg-indigo-100 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900"
                          : quiz.subject === "Campuran"
                            ? "bg-indigo-100 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900 text-indigo-650"
                            : quiz.subject === "Matematika"
                              ? "bg-orange-100 dark:bg-orange-950/60 border-orange-200 dark:border-orange-900 text-orange-650"
                              : quiz.subject === "Fisika"
                                ? "bg-purple-100 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900 text-purple-650"
                                : quiz.subject === "Biologi"
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900 text-emerald-650"
                                  : "bg-teal-100 dark:bg-teal-950/60 border-teal-200 dark:border-teal-900 text-teal-650"
                    }`}>
                      {quiz.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {quiz.title}
                        </h4>
                        {isContributed && (
                          <span className="bg-amber-500 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse border border-amber-600">
                            KONTRIBUSI SISWA
                          </span>
                        )}
                        {quiz.isCustom && (
                          <span className="bg-indigo-500 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-600">
                            BUATAN SISWA
                          </span>
                        )}
                        {isEmpty && (
                          <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            BELUM ADA SOAL
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-950 text-zinc-650 dark:text-zinc-400 font-bold px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800">
                          {quiz.subject}
                        </span>
                        <span className="text-[10px] bg-zinc-100 dark:bg-zinc-950 text-zinc-650 dark:text-zinc-400 font-bold px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800">
                          {quiz.category}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${getDifficultyStyle(quiz.difficulty)}`}>
                          {quiz.difficulty}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: stats + action */}
                  <div className="flex flex-row items-center justify-between md:justify-end gap-3 border-t md:border-0 border-zinc-100 dark:border-zinc-850 pt-3 md:pt-0 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-bold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-inner">
                        <FileText className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{quiz.questionsCount} Soal</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-bold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-inner">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span>{quiz.durationMinutes} Menit</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {quiz.isCustom && (
                        <button
                          onClick={(e) => handleDeleteCustomExam(quiz.id, e)}
                          className="h-8 w-8 flex items-center justify-center rounded-xl border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                          title="Hapus ujian ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => !isEmpty && handleSelectQuiz(quiz)}
                        disabled={isEmpty}
                        className={`inline-flex items-center gap-1.5 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer ${
                          isEmpty
                            ? "bg-zinc-300 dark:bg-zinc-700 cursor-not-allowed"
                            : isContributed
                              ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/10 border border-amber-600"
                              : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10 border border-indigo-600"
                        }`}
                      >
                        {isEmpty ? "Tidak Tersedia" : <>Mulai <ArrowRight className="h-3.5 w-3.5" /></>}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Create Exam Modal ── */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">

              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">Buat Ujian Baru</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {createStep === "meta"
                      ? "Atur metadata ujian sesuai keinginan kamu"
                      : `Isi soal ${examQIdx + 1} dari ${examDrafts.length}`}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="px-6 pt-4 flex items-center gap-3">
                <div className={`h-2 flex-1 rounded-full ${createStep === "meta" ? "bg-indigo-600" : "bg-indigo-600"}`} />
                <div className={`h-2 flex-1 rounded-full ${createStep === "questions" ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-700"}`} />
              </div>

              {/* ── Step 1: Metadata ── */}
              {createStep === "meta" && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Judul Ujian *</label>
                    <input
                      type="text"
                      value={examMeta.title}
                      onChange={(e) => setExamMeta((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Contoh: Simulasi UTBK Matematika Dasar Kelas 12"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Mata Pelajaran *</label>
                    <input
                      type="text"
                      value={examMeta.subject}
                      onChange={(e) => setExamMeta((p) => ({ ...p, subject: e.target.value }))}
                      placeholder="Contoh: Matematika, Fisika, Biologi…"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Kategori</label>
                      <select
                        value={examMeta.category}
                        onChange={(e) => setExamMeta((p) => ({ ...p, category: e.target.value }))}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                      >
                        {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Tingkat Kesulitan</label>
                      <select
                        value={examMeta.difficulty}
                        onChange={(e) => setExamMeta((p) => ({ ...p, difficulty: e.target.value }))}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                      >
                        {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Durasi (menit)</label>
                      <input
                        type="number"
                        min={5} max={180}
                        value={examMeta.durationMinutes}
                        onChange={(e) => setExamMeta((p) => ({ ...p, durationMinutes: Math.min(180, Math.max(5, Number(e.target.value))) }))}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                      <p className="text-[10px] text-zinc-400 mt-1">5–180 menit</p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Jumlah Soal</label>
                      <input
                        type="number"
                        min={1} max={50}
                        value={examMeta.questionCount}
                        onChange={(e) => setExamMeta((p) => ({ ...p, questionCount: Math.min(50, Math.max(1, Number(e.target.value))) }))}
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                      <p className="text-[10px] text-zinc-400 mt-1">1–50 soal</p>
                    </div>
                  </div>

                  {/* V-Point info */}
                  <div className={`p-3.5 rounded-2xl border flex items-center gap-3 text-xs ${getDifficultyStyle(examMeta.difficulty)}`}>
                    <span className="text-lg shrink-0">
                      {examMeta.difficulty === "Mudah" ? "⭐" : examMeta.difficulty === "Sedang" ? "⭐⭐" : examMeta.difficulty === "Sulit" ? "⭐⭐⭐" : "💜"}
                    </span>
                    <div>
                      <p className="font-bold">Reward ujian ini:</p>
                      <p>
                        {examMeta.difficulty === "Mudah" ? "+15" : examMeta.difficulty === "Sedang" ? "+25" : examMeta.difficulty === "Sulit" ? "+45" : "+100"} V-Point saat selesai
                        &nbsp;· penalti <span className="font-bold">-2%</span> total V-Point per jawaban salah
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleMetaNext}
                      className="flex-[2] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                    >
                      Lanjut: Isi Soal <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Questions ── */}
              {createStep === "questions" && examDrafts.length > 0 && (
                <div className="p-6 space-y-4">
                  {/* Progress */}
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-500 mb-1">
                    <span>Soal {examQIdx + 1} dari {examDrafts.length}</span>
                    <span>{examDrafts.filter(d => d.text.trim()).length} / {examDrafts.length} terisi</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${((examQIdx + 1) / examDrafts.length) * 100}%` }}
                    />
                  </div>

                  {/* Question text */}
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Teks Soal *</label>
                    <textarea
                      rows={3}
                      value={examDrafts[examQIdx]?.text ?? ""}
                      onChange={(e) => updateDraft("text", e.target.value)}
                      placeholder="Tulis pertanyaan di sini…"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                    />
                  </div>

                  {/* Options A–E */}
                  <div className="grid grid-cols-1 gap-2">
                    {(["A", "B", "C", "D", "E"] as const).map((key) => {
                      const fieldKey = `opt${key}` as keyof QuestionDraft;
                      return (
                        <div key={key} className="flex items-center gap-2">
                          <span className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black border ${
                            examDrafts[examQIdx]?.answerKey === key
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700"
                          }`}>
                            {key}
                          </span>
                          <input
                            type="text"
                            value={examDrafts[examQIdx]?.[fieldKey] ?? ""}
                            onChange={(e) => updateDraft(fieldKey, e.target.value)}
                            placeholder={`Opsi ${key}…`}
                            className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                          <button
                            onClick={() => updateDraft("answerKey", key)}
                            className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              examDrafts[examQIdx]?.answerKey === key
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 hover:text-indigo-600"
                            }`}
                            title={`Jadikan opsi ${key} sebagai kunci jawaban`}
                          >
                            ✓ KUNCI
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-zinc-400">
                    Klik tombol <span className="font-bold text-indigo-500">✓ KUNCI</span> di samping opsi yang benar.
                    Kunci jawaban: <span className="font-black text-indigo-600">{examDrafts[examQIdx]?.answerKey}</span>
                  </p>

                  {/* Navigation between questions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => saveDraftAndGo("prev")}
                      disabled={examQIdx === 0}
                      className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ChevronLeft className="h-4 w-4" /> Soal Sebelumnya
                    </button>

                    {examQIdx < examDrafts.length - 1 ? (
                      <button
                        onClick={() => saveDraftAndGo("next")}
                        className="flex-[2] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        Soal Berikutnya <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveExam}
                        className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Simpan Ujian
                      </button>
                    )}
                  </div>

                  {/* Number grid navigation */}
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Lompat ke Soal:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {examDrafts.map((d, i) => (
                        <button
                          key={i}
                          onClick={() => setExamQIdx(i)}
                          className={`h-7 w-7 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                            i === examQIdx
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : d.text.trim()
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900/40 text-emerald-600"
                                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Loading state (quiz selected but questions somehow empty)
  // ══════════════════════════════════════════════════════════════════════════
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Paket Ini Belum Memiliki Soal</h3>
        <p className="text-xs text-zinc-500 max-w-xs">
          Ujian ini belum diisi pertanyaan. Tambahkan soal melalui fitur Buat Ujian Baru atau pilih paket lain.
        </p>
        <button
          onClick={() => setSelectedQuiz(null)}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Quiz preparation screen
  // ══════════════════════════════════════════════════════════════════════════
  if (!isStarted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-left relative animate-in fade-in duration-300">

          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-850 p-6 sm:p-10 text-white relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full font-bold mb-3 border border-white/10 uppercase tracking-widest">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> RUANGGURU QUIZ FORMAT
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              {selectedQuiz.title}
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/90 mt-2.5 max-w-xl leading-relaxed">
              {selectedQuiz.id === "quiz_contributed"
                ? "Simulasi ujian khusus berisi soal latihan CBT hasil kontribusi mandiri dari rekan-rekan siswa SMAN 2 Jonggol yang disetujui moderator."
                : selectedQuiz.isCustom
                  ? `Ujian buatan siswa · ${selectedQuiz.questionsCount} soal · Durasi ${selectedQuiz.durationMinutes} menit.`
                  : "Uji kesiapan akademismu menjelang ujian seleksi masuk universitas negeri (UTBK-SNBT) dan Olimpiade Sains dengan simulasi CBT interaktif."}
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Informasi Detail Ujian</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/40 shrink-0">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">Jumlah Soal</p>
                    <p className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200">{selectedQuiz.questionsCount} Butir Soal</p>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100/40 shrink-0">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">Durasi Waktu</p>
                    <p className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200">{selectedQuiz.durationMinutes} Menit</p>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center border shrink-0 ${
                    selectedQuiz.difficulty.toLowerCase() === "sangat sulit"
                      ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100/40"
                      : "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100/40"
                  }`}>
                    <GraduationCap className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-450 dark:text-zinc-500 font-bold uppercase">Tingkat Kesulitan</p>
                    <p className={`text-xs font-extrabold ${
                      selectedQuiz.difficulty.toLowerCase() === "sangat sulit"
                        ? "text-purple-700 dark:text-purple-400"
                        : "text-zinc-850 dark:text-zinc-200"
                    }`}>{selectedQuiz.difficulty}</p>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/40 shrink-0">
                    <User className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">{selectedQuiz.id === "quiz_contributed" || selectedQuiz.isCustom ? "Pembuat Soal" : "Peserta Ujian"}</p>
                    <p className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200 truncate max-w-[120px]">
                      {selectedQuiz.id === "quiz_contributed" ? "Kolaborasi Siswa" : selectedQuiz.isCustom ? (selectedQuiz.author ?? "Siswa SMAN 2") : "Ahmad Kontributor"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Penalty warning */}
            <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                <span className="font-extrabold text-red-600 dark:text-red-400">Sistem Penalti Aktif: </span>
                Setiap jawaban salah akan <span className="font-bold">mengurangi 2% total V-Point</span> kamu saat ini.
                Jawab dengan cermat!
              </div>
            </div>

            {/* Instructions */}
            <div className="p-5 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900/30 rounded-2xl">
              <h5 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                📝 Panduan Pengerjaan Soal:
              </h5>
              <ul className="space-y-3 text-[11px] text-zinc-655 dark:text-zinc-400 leading-relaxed">
                <li className="flex gap-2.5 items-start">
                  <div className="h-4.5 w-4.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>Pastikan Anda berada di tempat yang tenang dengan koneksi internet stabil.</span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <div className="h-4.5 w-4.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>Waktu ujian akan <b>berjalan mundur secara otomatis</b> dan tidak dapat dijeda.</span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <div className="h-4.5 w-4.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>Gunakan sidebar navigasi soal di kanan untuk melompat bebas ke nomor soal manapun.</span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <div className="h-4.5 w-4.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>Skor akhir dan umpan balik kelulusan akademik langsung disajikan setelah submit.</span>
                </li>
              </ul>
            </div>

            <div className="border-t border-zinc-150 dark:border-zinc-800/80 pt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setSelectedQuiz(null)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-250 dark:border-zinc-800 hover:bg-zinc-55 dark:hover:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-bold py-3.5 px-6 text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" /> Menu Kuis
              </button>
              <button
                onClick={() => setIsStarted(true)}
                className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-6 text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20 active:scale-[0.98] cursor-pointer border border-indigo-700"
              >
                Mulai Ujian Sekarang 🚀
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Results screen
  // ══════════════════════════════════════════════════════════════════════════
  if (isFinished) {
    const netPoints = (pointsAwarded ?? 0) - (penaltyPoints ?? 0);

    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-6 border border-indigo-100 dark:border-indigo-900/30">
            <Award className="h-8 w-8" />
          </div>

          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">Hasil Latihan CBT Selesai</h2>
          <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-2 max-w-md mx-auto">
            Selamat! Anda telah menyelesaikan simulasi kuis dari NAWA-LEARN. Hasil kinerja akademik Anda tercatat di bawah ini.
          </p>

          {/* Score circle */}
          <div className="my-8 relative inline-flex items-center justify-center">
            <div className="h-40 w-40 rounded-full border-8 border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
              <span className="text-4xl sm:text-5xl font-black text-indigo-600 dark:text-indigo-400">{finalScore}</span>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">SCORE</span>
            </div>
            <div className="absolute -top-1 -right-1 bg-indigo-50 border border-indigo-200 p-1.5 rounded-lg text-indigo-600 animate-bounce">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-left">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Jawaban Benar</span>
              <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-450 mt-1">{correctCount} / {questions.length}</h4>
              <p className="text-xs text-zinc-455 dark:text-zinc-500 mt-1">Akurasi Soal</p>
            </div>
            <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-left">
              <span className="text-[10px] font-bold text-red-500 uppercase">Jawaban Salah</span>
              <h4 className="text-2xl font-black text-red-505 mt-1">{wrongCount} / {questions.length}</h4>
              <p className="text-xs text-zinc-455 dark:text-zinc-500 mt-1">Tinjau Kesalahan</p>
            </div>
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl text-left">
              <span className="text-[10px] font-bold text-indigo-500 uppercase">Sisa Waktu Ujian</span>
              <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
              </h4>
              <p className="text-xs text-zinc-455 dark:text-zinc-500 mt-1">Manajemen Waktu</p>
            </div>
          </div>

          {/* V-Point result section */}
          <div className="max-w-2xl mx-auto mb-6 space-y-3">
            {pointsLoading ? (
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3">
                <div className="h-5 w-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin shrink-0" />
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Menghitung V-Point kamu...</p>
              </div>
            ) : pointsAwarded !== null ? (
              <>
                {/* Reward row */}
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center text-lg shrink-0">⭐</div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Reward Selesai Kuis</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                        Kuis <span className="font-bold">{selectedQuiz?.difficulty}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400 shrink-0">+{pointsAwarded}</span>
                </div>

                {/* Penalty row (only if there are wrong answers) */}
                {(penaltyPoints ?? 0) > 0 && (
                  <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-500 flex items-center justify-center shrink-0">
                        <Minus className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Penalti Jawaban Salah</p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                          {wrongCount} salah × 2% total V-Point
                        </p>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-red-600 dark:text-red-400 shrink-0">−{penaltyPoints}</span>
                  </div>
                )}

                {/* Net total */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  netPoints >= 0
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"
                }`}>
                  <p className={`text-sm font-extrabold ${netPoints >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    {netPoints >= 0 ? "Net V-Point Diterima" : "Net V-Point Berkurang"}
                  </p>
                  <span className={`text-2xl font-black shrink-0 ${netPoints >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {netPoints >= 0 ? `+${netPoints}` : netPoints}
                  </span>
                </div>
              </>
            ) : null}
          </div>

          {/* Feedback badge */}
          <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm flex gap-3 items-start text-left mb-10">
            <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-zinc-900 dark:text-white">
                {finalScore >= 70 ? "🎉 Luar Biasa! Kesiapan Ujian Sangat Tinggi" : "📚 Terus Berjuang & Pelajari Rangkuman"}
              </p>
              <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                {finalScore >= 70
                  ? "Hasil latihan menunjukkan pemahaman yang sangat mendalam pada konsep dasar. Pertahankan prestasi dan cobalah tantangan kuis lainnya!"
                  : "Jangan patah semangat! Siswa SMAN 2 Jonggol dapat mengunduh serta membaca rangkuman pelajaran reguler dan UTBK secara instan di perpustakaan modul."}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 border-t border-zinc-150 dark:border-zinc-800/80 pt-8">
            <button
              onClick={handleRestart}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 text-sm transition-all shadow-md shadow-indigo-600/10 hover:shadow-lg active:scale-95 cursor-pointer border border-indigo-700"
            >
              <RotateCcw className="h-4 w-4" /> Ulangi Latihan CBT
            </button>
            <button
              onClick={() => setSelectedQuiz(null)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-750 dark:text-zinc-200 font-bold py-3 px-6 text-sm transition-all border border-zinc-200 dark:border-zinc-750 active:scale-95 cursor-pointer"
            >
              <BookOpen className="h-4 w-4" /> Daftar Kuis Lainnya
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Active quiz session
  // ══════════════════════════════════════════════════════════════════════════
  const currentQ = questions[currentIndex];
  const isTimeCritical = timeLeft < 300;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="text-left">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs px-2.5 py-0.5 rounded-md font-bold mb-2">
            <GraduationCap className="h-3.5 w-3.5" /> Ruang CBT Latihan Soal
          </div>
          <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">{selectedQuiz?.title}</h2>
          <p className="text-xs text-zinc-550 mt-0.5">
            Kerjakan soal pilihan ganda di bawah ini secara teliti untuk menguji kesiapan UTBK dan Olimpiade Anda.
          </p>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold text-sm sm:text-base tracking-widest shrink-0 transition-all ${
          isTimeCritical
            ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40 animate-pulse"
            : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400"
        }`}>
          <Clock className={`h-4.5 w-4.5 ${isTimeCritical ? "text-red-500 animate-spin" : "text-indigo-500"}`} />
          <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-850 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full flex-1">
          <div className="flex justify-between text-xs font-bold text-zinc-550 mb-1.5 text-left">
            <span>Progress Pengisian</span>
            <span>{answeredCount} dari {questions.length} Soal Terjawab ({progressPercent}%)</span>
          </div>
          <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Left: question panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 sm:p-8 text-left">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1 rounded-lg text-zinc-550 font-bold uppercase tracking-wider">
                Pertanyaan {currentIndex + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-0.5 rounded">
                  {currentQ.subject}
                </span>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded">
                  {currentQ.category}
                </span>
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-150 leading-relaxed mb-8">
              {currentQ.text}
            </h3>

            <div className="space-y-3">
              {Object.entries(currentQ.options).map(([key, value]) => {
                const isSelected = answers[currentQ.id] === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectOption(currentQ.id, key)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer group hover:scale-[1.01] ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-indigo-300 dark:hover:border-indigo-900 text-zinc-700 dark:text-zinc-355"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                          : "bg-zinc-50 dark:bg-zinc-850 text-zinc-500 border border-zinc-200 dark:border-zinc-750 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"
                      }`}>
                        {key}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold">{value}</span>
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation controls */}
          <div className="flex justify-between items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
            <button
              onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-bold text-zinc-655 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Sebelumnya
            </button>

            {currentIndex === questions.length - 1 ? (
              <button
                onClick={() => {
                  if (confirm("Apakah Anda yakin ingin menyelesaikan simulasi CBT ini?")) {
                    setIsFinished(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-indigo-600/10 hover:shadow-lg active:scale-95 transition-all cursor-pointer border border-indigo-700"
              >
                Selesaikan Ujian <CheckCircle2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-indigo-600/10 hover:shadow-lg active:scale-95 transition-all cursor-pointer border border-indigo-700"
              >
                Berikutnya <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="lg:col-span-1 space-y-6 text-left">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Navigasi Soal</h4>
            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((q, idx) => {
                const isActive = currentIndex === idx;
                const isAnswered = answers[q.id] !== undefined;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                      isActive
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20 font-black scale-105"
                        : isAnswered
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-450"
                          : "bg-zinc-50 dark:bg-zinc-955 border-zinc-200 dark:border-zinc-800 text-zinc-550 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-850"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800/80 mt-4 pt-4 space-y-2 text-[10px] font-semibold text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-md bg-indigo-600" />
                <span>Soal Aktif saat ini</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-md bg-emerald-50 border border-emerald-300" />
                <span>Sudah diisi / dijawab</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-md bg-zinc-50 border border-zinc-200" />
                <span>Belum dikerjakan</span>
              </div>
            </div>
          </div>

          {/* Peserta ujian card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm relative overflow-hidden bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Peserta Ujian</h4>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs uppercase border border-indigo-100 dark:border-indigo-950/50">
                {selectedQuiz?.id === "quiz_contributed" || selectedQuiz?.isCustom ? "K" : "A"}
              </div>
              <div>
                <h5 className="text-xs font-extrabold text-zinc-900 dark:text-white">
                  {selectedQuiz?.id === "quiz_contributed" ? "Kolaborasi Siswa" : selectedQuiz?.isCustom ? (selectedQuiz.author ?? "Siswa SMAN 2") : "Ahmad Kontributor"}
                </h5>
                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Siswa SMAN 2 Jonggol</p>
              </div>
            </div>
            <div className="border-t border-zinc-100 dark:border-zinc-800/80 mt-4 pt-3 space-y-1.5 text-[10px] text-zinc-500">
              <p>⏱️ <b>Durasi:</b> {selectedQuiz?.durationMinutes} Menit Maksimal</p>
              <p>🔀 <b>Acak Soal:</b> Aktif (CBT Mode)</p>
              <p>⚠️ <b>Penalti:</b> -2% / Jawaban Salah</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
