// src/components/moderator/ModeratorClient.tsx
// The moderator panel UI. Access is no longer decided here: the route
// (`src/app/(dashboard)/moderator/page.tsx`) resolves `users.role` on the server
// and calls `notFound()` for anyone else, so this component only ever mounts for
// a reviewer. It used to fetch `/api/moderator/auth-check` on mount and render a
// "Memeriksa hak akses…" spinner followed by an "Akses Ditolak" card — a client
// gate that a browser could skip by simply not running the JavaScript.
//
// Dulu 897 baris: empat antrean, empat kumpulan state, empat kelompok handler
// dan seluruh markup empat tab dalam satu komponen. Sekarang file ini adalah
// shell: memuat keempat antrean pada saat mount, memegang jumlah untuk label
// tab, dan menyerahkan setiap tab ke komponen presentasionalnya.
"use client";

import { useState, useEffect } from "react";
import {
  BookOpen, BookMarked, Eye, Zap,
} from "lucide-react";
import type { BadgeDisplay } from "@/lib/badges";
import { useToast } from "@/components/ui/Toast";
import { SubmissionsModulesTab } from "./SubmissionsModulesTab";
import { SubmissionsQuestionsTab } from "./SubmissionsQuestionsTab";
import { HiddenBadgesTab } from "./HiddenBadgesTab";
import { DailyQuizTab } from "./DailyQuizTab";
import type { DailyFormState } from "./DailyQuizTab";
import type {
  PendingSubmission, PendingQuestion, HiddenBadgeHolder, DailyQuestion,
} from "./types";

type ModeratorTab = "modules" | "questions" | "badges" | "daily";

export default function ModeratorClient() {
  const { success, error: toastError, info } = useToast();
  const [activeTab, setActiveTab] = useState<ModeratorTab>("modules");

  // Modules State
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [processingModuleId, setProcessingModuleId] = useState<string | null>(null);

  // Questions State
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [processingQuestionId, setProcessingQuestionId] = useState<string | null>(null);

  // Hidden Badges State
  //
  // `badges` sudah dievaluasi server (`GET /api/moderator/hidden-badges`):
  // `requirement` ditulis di katalog server dan hanya dikirim ke moderator. Dulu
  // komponen ini yang memegang katalognya dan menjalankan `unlockCondition`
  // untuk setiap siswa — yang berarti kedelapan syarat rahasia ikut ke bundel
  // browser.
  const [hiddenBadges, setHiddenBadges] = useState<BadgeDisplay[]>([]);
  const [badgeHolders, setBadgeHolders] = useState<Record<string, HiddenBadgeHolder[]>>({});
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null);

  // Daily Quiz State
  const [dailyQuestions, setDailyQuestions] = useState<DailyQuestion[]>([]);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [isSubmittingDaily, setIsSubmittingDaily] = useState(false);
  const [dailyForm, setDailyForm] = useState<DailyFormState>({
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    optionE: "",
    answerKey: "A",
    difficulty: "sedang",
    subject: "Umum",
  });

  useEffect(() => {
    // Mount-only bootstrap. The server already proved this viewer is a reviewer,
    // so there is no gate left to clear here — only the four queues to load.
    fetchPendingSubmissions();
    fetchPendingQuestions();
    fetchHiddenBadges();
    fetchDailyQuestions();
    // The four fetchers are re-created on every render by design: they close over
    // the toast helpers. Re-running the effect on each render would refetch every
    // queue forever, so it is deliberately mount-only.
  }, []);

  async function fetchHiddenBadges() {
    setIsLoadingBadges(true);
    try {
      const res = await fetch("/api/moderator/hidden-badges");
      if (res.ok) {
        const { badges, holders } = await res.json();
        setHiddenBadges(badges);
        setBadgeHolders(holders);
      }
    } catch (error) {
      console.error("Gagal mengambil data badge tersembunyi:", error);
    } finally {
      setIsLoadingBadges(false);
    }
  }

  async function fetchPendingSubmissions() {
    try {
      const res = await fetch("/api/submissions/pending");
      if (res.ok) {
        const { data } = await res.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error("Gagal mengambil data draf modul:", error);
    } finally {
      setIsLoadingModules(false);
    }
  }

  // Load pending questions from real DB API
  async function fetchPendingQuestions() {
    setIsLoadingQuestions(true);
    try {
      const res = await fetch("/api/questions/pending");
      if (res.ok) {
        const { data } = await res.json();
        setPendingQuestions(data);
      }
    } catch (error) {
      console.error("Gagal mengambil data soal pending:", error);
    } finally {
      setIsLoadingQuestions(false);
    }
  }

  // Approve Module
  const handleApproveModule = async (sub: PendingSubmission) => {
    setProcessingModuleId(sub.submissionId);
    try {
      const res = await fetch("/api/modules/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server resolves the module + submitter from the submission row.
        body: JSON.stringify({
          submissionId: sub.submissionId,
          feedback: "Modul disetujui. Terima kasih atas kontribusinya untuk SMAN 2 Jonggol!",
        }),
      });

      if (res.ok) {
        success("Modul disetujui!", "Poin telah ditambahkan ke profil kontributor.");
        setSubmissions((prev) => prev.filter((s) => s.submissionId !== sub.submissionId));
      } else {
        toastError("Gagal menyetujui modul", "Terjadi kesalahan saat menyetujui modul.");
      }
    } catch (error) {
      console.error(error);
      toastError("Kesalahan jaringan", "Periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setProcessingModuleId(null);
    }
  };

  // Approve Question via real DB API
  const handleApproveQuestion = async (q: PendingQuestion) => {
    setProcessingQuestionId(q.questionId);
    try {
      const res = await fetch("/api/questions/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: q.submissionId,
          feedback: "Soal disetujui. Terima kasih atas kontribusinya untuk SMAN 2 Jonggol!",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rewardMsg = data.levelRewards?.length
          ? ` • Level Reward: ${data.levelRewards.join(", ")}`
          : "";
        success(
          `Soal disetujui!`,
          `+${data.pointsAwarded} V-Point diberikan ke kontributor.${rewardMsg}`
        );
        setPendingQuestions((prev) => prev.filter((item) => item.questionId !== q.questionId));
      } else {
        toastError("Gagal menyetujui soal", "Terjadi kesalahan. Coba lagi.");
      }
    } catch (error) {
      console.error(error);
      toastError("Kesalahan jaringan", "Periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setProcessingQuestionId(null);
    }
  };

  // Reject Question via real DB API
  const handleRejectQuestion = async (q: PendingQuestion) => {
    if (!confirm("Apakah Anda yakin ingin menolak soal latihan ini?")) return;
    setProcessingQuestionId(q.questionId);
    try {
      const res = await fetch("/api/questions/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: q.submissionId,
          feedback: "Soal tidak memenuhi standar kualitas.",
        }),
      });

      if (res.ok) {
        setPendingQuestions((prev) => prev.filter((item) => item.questionId !== q.questionId));
        info("Soal ditolak", "Soal telah dihapus dari antrian moderasi.");
      } else {
        toastError("Gagal menolak soal", "Terjadi kesalahan. Coba lagi.");
      }
    } catch {
      toastError("Kesalahan jaringan", "Periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setProcessingQuestionId(null);
    }
  };

  // ── Daily Quiz Functions ──
  async function fetchDailyQuestions() {
    setIsLoadingDaily(true);
    try {
      const res = await fetch("/api/questions/daily-create");
      if (res.ok) {
        const { data } = await res.json();
        setDailyQuestions(data);
      }
    } catch (error) {
      console.error("Gagal mengambil soal kuis harian:", error);
    } finally {
      setIsLoadingDaily(false);
    }
  }

  const handleCreateDailyQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDaily(true);
    try {
      const options: Record<string, string> = {
        A: dailyForm.optionA,
        B: dailyForm.optionB,
        C: dailyForm.optionC,
        D: dailyForm.optionD,
      };
      if (dailyForm.optionE.trim()) {
        options.E = dailyForm.optionE;
      }

      const res = await fetch("/api/questions/daily-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: dailyForm.questionText,
          options,
          answerKey: dailyForm.answerKey,
          difficulty: dailyForm.difficulty,
          subject: dailyForm.subject,
        }),
      });

      if (res.ok) {
        success("Soal berhasil dibuat!", "Soal Kuis Harian baru sudah aktif dan siap dikerjakan siswa.");
        setDailyForm({
          questionText: "",
          optionA: "",
          optionB: "",
          optionC: "",
          optionD: "",
          optionE: "",
          answerKey: "A",
          difficulty: "sedang",
          subject: "Umum",
        });
        fetchDailyQuestions();
      } else {
        const data = await res.json();
        toastError("Gagal membuat soal", data.error || "Terjadi kesalahan.");
      }
    } catch {
      toastError("Kesalahan jaringan", "Periksa koneksi internet Anda.");
    } finally {
      setIsSubmittingDaily(false);
    }
  };

  const handleDeleteDailyQuestion = async (questionId: string) => {
    if (!confirm("Hapus soal kuis harian ini? Aksi ini tidak bisa dibatalkan.")) return;
    try {
      // We'll just change its status to rejected to soft-delete
      const res = await fetch("/api/questions/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          submissionId: questionId, // fallback
          feedback: "Dihapus oleh moderator.",
        }),
      });
      if (res.ok) {
        setDailyQuestions(prev => prev.filter(q => q.id !== questionId));
        info("Soal dihapus", "Soal telah dinonaktifkan dari Kuis Harian.");
      }
    } catch {
      toastError("Gagal menghapus", "Terjadi kesalahan jaringan.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 mt-4 text-left">
      {/* Header Panel */}
      <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6 relative overflow-hidden bg-gradient-to-br from-indigo-500/[0.03] to-transparent p-6 rounded-3xl border border-zinc-150">
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] px-2.5 py-0.5 rounded-md font-bold mb-3 border border-indigo-100/40 uppercase tracking-wider w-fit">
          🛡️ Ruang Panel Moderasi SMAN 2
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          Dasbor Pengawasan & Persetujuan
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1 max-w-2xl leading-relaxed">
          Tinjau kontribusi modul catatan belajar dan draf usulan soal latihan CBT yang diajukan oleh siswa agar perpustakaan NAWA-LEARN tetap bersih dan akurat.
        </p>

        {/* Double Tabs Selector */}
        <div className="flex gap-2.5 mt-6 border-t border-zinc-150 dark:border-zinc-800/80 pt-6">
          <button
            onClick={() => setActiveTab("modules")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "modules"
                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50"
            }`}
          >
            <BookOpen className="h-4 w-4" /> Draf Modul Catatan ({submissions.length})
          </button>

          <button
            onClick={() => setActiveTab("questions")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "questions"
                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-355 hover:bg-zinc-50"
            }`}
          >
            <BookMarked className="h-4 w-4" /> Draf Soal Latihan CBT ({pendingQuestions.length})
          </button>

          <button
            onClick={() => setActiveTab("badges")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "badges"
                ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/10"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-355 hover:bg-zinc-50"
            }`}
          >
            <Eye className="h-4 w-4" /> Lencana Tersembunyi ({hiddenBadges.length})
          </button>

          <button
            onClick={() => setActiveTab("daily")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "daily"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/10"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-355 hover:bg-zinc-50"
            }`}
          >
            <Zap className="h-4 w-4" /> Kuis Harian ({dailyQuestions.length})
          </button>
        </div>
      </div>

      {/* 1. MODULES SUBMISSION TAB */}
      {activeTab === "modules" && (
        <SubmissionsModulesTab
          submissions={submissions}
          isLoadingModules={isLoadingModules}
          processingModuleId={processingModuleId}
          onApproveModule={handleApproveModule}
        />
      )}

      {/* 2. QUESTIONS SUBMISSION TAB */}
      {activeTab === "questions" && (
        <SubmissionsQuestionsTab
          pendingQuestions={pendingQuestions}
          isLoadingQuestions={isLoadingQuestions}
          processingQuestionId={processingQuestionId}
          onApproveQuestion={handleApproveQuestion}
          onRejectQuestion={handleRejectQuestion}
        />
      )}

      {/* 3. HIDDEN BADGES MONITOR TAB */}
      {activeTab === "badges" && (
        <HiddenBadgesTab
          hiddenBadges={hiddenBadges}
          badgeHolders={badgeHolders}
          isLoadingBadges={isLoadingBadges}
          expandedBadge={expandedBadge}
          onToggleExpand={(badgeId) => setExpandedBadge(expandedBadge === badgeId ? null : badgeId)}
        />
      )}

      {/* 4. DAILY QUIZ CREATOR TAB */}
      {activeTab === "daily" && (
        <DailyQuizTab
          dailyQuestions={dailyQuestions}
          isLoadingDaily={isLoadingDaily}
          isSubmittingDaily={isSubmittingDaily}
          dailyForm={dailyForm}
          onFormChange={setDailyForm}
          onCreateQuestion={handleCreateDailyQuestion}
          onDeleteQuestion={handleDeleteDailyQuestion}
        />
      )}
    </div>
  );
}
