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
// shell: memuat antrean pada saat mount, memegang jumlah untuk label tab, dan
// menyerahkan setiap tab ke komponen presentasionalnya. Tab Tim (M17) tidak
// punya antrean — ia hanya membaca daftar orang, dan justru itu alasan
// keberadaannya: staf tidak lagi terlihat di papan peringkat. Tab Paket Ujian
// (M18) punya antrean, dan ia ada karena paket ujian buatan siswa dulu tayang
// tanpa diperiksa siapa pun.
"use client";

import { useState, useEffect } from "react";
import {
  BookOpen, BookMarked, ClipboardList, Eye, Zap, ShieldCheck, Users,
} from "lucide-react";
import type { BadgeDisplay } from "@/lib/badges";
import { useToast } from "@/components/ui/Toast";
import { SubmissionsModulesTab } from "./SubmissionsModulesTab";
import { SubmissionsQuestionsTab } from "./SubmissionsQuestionsTab";
import { ExamQueueTab } from "./ExamQueueTab";
import { HiddenBadgesTab } from "./HiddenBadgesTab";
import { DailyQuizTab } from "./DailyQuizTab";
import { TeamTab } from "./TeamTab";
import type { DailyFormState } from "./DailyQuizTab";
import type {
  PendingSubmission, PendingQuestion, PendingExam, HiddenBadgeHolder, DailyQuestion,
  TeamSeatMember, TeamStaffMember,
} from "./types";

type ModeratorTab = "modules" | "questions" | "exams" | "badges" | "daily" | "team";

export default function ModeratorClient({ seatKind = "human" }: { seatKind?: "human" | "seat" }) {
  const { success, error: toastError, info } = useToast();
  const [activeTab, setActiveTab] = useState<ModeratorTab>("modules");
  // A season seat may review content and write the daily quiz, but it may not
  // read the hidden-badge catalogue or the audit log. The two tabs are not
  // rendered at all rather than disabled: a tab that is visible but refuses is
  // an invitation to keep trying.
  const canSeeSecrets = seatKind === "human";

  // Modules State
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [processingModuleId, setProcessingModuleId] = useState<string | null>(null);

  // Questions State
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [processingQuestionId, setProcessingQuestionId] = useState<string | null>(null);

  // Exams State (M18)
  //
  // Dimuat untuk **kedua** jenis peninjau: kursi musim boleh menerbitkan paket
  // ujian (`requireReviewer()`), dan justru kursi itulah yang paling mungkin
  // menulis paket — larangan yang mereka pegang hanya soal mengunggah, bukan
  // meninjau.
  const [pendingExams, setPendingExams] = useState<PendingExam[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [processingExamId, setProcessingExamId] = useState<string | null>(null);

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

  // Team State (M17)
  //
  // Dimuat untuk **kedua** jenis peninjau. Tab ini justru paling dibutuhkan
  // pemegang kursi: staf manusia tidak lagi muncul di papan peringkat, jadi
  // tanpa tab ini tidak ada satu pun layar yang memberi tahu kursi baru siapa
  // yang mengangkatnya.
  const [teamStaff, setTeamStaff] = useState<TeamStaffMember[]>([]);
  const [teamSeats, setTeamSeats] = useState<TeamSeatMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  // A failed load must not render as "belum ada staf": that sentence is a claim
  // about the platform, and an empty array from a 500 says nothing about it.
  const [teamError, setTeamError] = useState(false);

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
    // so there is no gate left to clear here — only the queues to load, plus the
    // team list (which every reviewer may read).
    fetchPendingSubmissions();
    fetchPendingQuestions();
    fetchPendingExams();
    if (canSeeSecrets) fetchHiddenBadges();
    fetchDailyQuestions();
    fetchTeam();
    // The fetchers are re-created on every render by design: they close over the
    // toast helpers. Re-running the effect on each render would refetch every
    // queue forever, so the fetchers are deliberately left out of this list.
    // `canSeeSecrets` **is** listed: it is a server prop, and if it ever changes
    // under a live session (a podium seat revoked mid-season) the secret panel
    // must stop loading, not keep a stale queue on screen.
  }, [canSeeSecrets]);

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

  // ── Paket ujian (M18) ──
  async function fetchPendingExams() {
    setIsLoadingExams(true);
    try {
      const res = await fetch("/api/exams/pending");
      if (res.ok) {
        const { data } = await res.json();
        setPendingExams(data);
      }
    } catch (error) {
      console.error("Gagal mengambil data paket ujian pending:", error);
    } finally {
      setIsLoadingExams(false);
    }
  }

  const handleApproveExam = async (exam: PendingExam) => {
    setProcessingExamId(exam.submissionId);
    try {
      const res = await fetch("/api/exams/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: exam.submissionId,
          feedback: "Paket ujian disetujui. Terima kasih atas kontribusinya untuk SMAN 2 Jonggol!",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rewardMsg = data.levelRewards?.length
          ? ` • Level Reward: ${data.levelRewards.join(", ")}`
          : "";
        success(
          "Paket ujian diterbitkan!",
          `+${data.pointsAwarded} V-Point diberikan ke penulisnya.${rewardMsg}`
        );
        setPendingExams((prev) => prev.filter((item) => item.submissionId !== exam.submissionId));
      } else if (res.status === 409) {
        // Sudah diputuskan peninjau lain (atau paketnya sudah tidak pending).
        // Menghapus kartunya lebih jujur daripada membiarkannya terlihat bisa
        // ditekan dua kali.
        toastError("Paket ini sudah diputuskan", "Muat ulang panel untuk melihat keadaan terbaru.");
        setPendingExams((prev) => prev.filter((item) => item.submissionId !== exam.submissionId));
      } else {
        const data = await res.json().catch(() => ({}));
        toastError("Gagal menerbitkan paket", data.error || "Terjadi kesalahan. Coba lagi.");
      }
    } catch {
      toastError("Kesalahan jaringan", "Periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setProcessingExamId(null);
    }
  };

  const handleRejectExam = async (exam: PendingExam, reason: string) => {
    setProcessingExamId(exam.submissionId);
    try {
      const res = await fetch("/api/exams/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `feedback`, bukan `reason`: skema route-nya `.strict()` dengan nama itu,
        // dan `reason` akan dijawab 400 — penolakan tidak akan pernah terkirim.
        body: JSON.stringify({ submissionId: exam.submissionId, feedback: reason }),
      });

      if (res.ok) {
        setPendingExams((prev) => prev.filter((item) => item.submissionId !== exam.submissionId));
        info("Paket ujian ditolak", "Penulisnya menerima alasan penolakan lewat surel.");
      } else {
        const data = await res.json().catch(() => ({}));
        toastError("Gagal menolak paket", data.error || "Terjadi kesalahan. Coba lagi.");
      }
    } catch {
      toastError("Kesalahan jaringan", "Periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setProcessingExamId(null);
    }
  };

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

  // ── Team (M17) ──
  async function fetchTeam() {
    try {
      const res = await fetch("/api/moderator/team");
      if (!res.ok) {
        setTeamError(true);
        return;
      }
      const { staff, seats } = await res.json();
      setTeamStaff(staff);
      setTeamSeats(seats);
      setTeamError(false);
    } catch (error) {
      setTeamError(true);
      console.error("Gagal mengambil daftar tim moderator:", error);
    } finally {
      setIsLoadingTeam(false);
    }
  }

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
        // 409 `daily_slot_taken`: hari ini sudah punya soal kurasi. Pesannya
        // menyebut siapa yang lebih dulu, karena "gagal" tanpa sebab akan
        // membuat peninjau berikutnya mencoba lagi dan lagi.
        if (res.status === 409) {
          info("Kuis harian hari ini sudah ada", "Soal kurasi hari ini sudah dibuat. Soalmu tidak disimpan.");
        } else {
          toastError("Gagal membuat soal", data.error || "Terjadi kesalahan.");
        }
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
      <div className="mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 sm:p-7 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-nawa-primary dark:text-indigo-400 shrink-0 mt-0.5">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              Dasbor Pengawasan &amp; Persetujuan
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              Tinjau kontribusi modul catatan belajar, draf usulan soal latihan CBT, dan paket
              ujian yang diajukan kontributor agar perpustakaan NAWA-LEARN tetap bersih dan
              akurat. Paket ujian tidak tayang sebelum disetujui di sini.
            </p>
          </div>
        </div>

        {/* Double Tabs Selector */}
        <div className="flex flex-wrap gap-2.5 mt-6 border-t border-zinc-100 dark:border-zinc-800/80 pt-6">
          <button
            onClick={() => setActiveTab("modules")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98] ${
              activeTab === "modules"
                ? "bg-nawa-primary border-nawa-primary text-white shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <BookOpen className="h-4 w-4" /> Draf Modul Catatan ({submissions.length})
          </button>

          <button
            onClick={() => setActiveTab("questions")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98] ${
              activeTab === "questions"
                ? "bg-nawa-primary border-nawa-primary text-white shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <BookMarked className="h-4 w-4" /> Draf Soal Latihan CBT ({pendingQuestions.length})
          </button>

          <button
            onClick={() => setActiveTab("exams")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98] ${
              activeTab === "exams"
                ? "bg-nawa-primary border-nawa-primary text-white shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <ClipboardList className="h-4 w-4" /> Paket Ujian ({pendingExams.length})
          </button>

          {canSeeSecrets && (
            <button
              onClick={() => setActiveTab("badges")}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98] ${
                activeTab === "badges"
                  ? "bg-nawa-warning border-nawa-warning text-white shadow-sm"
                  : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Eye className="h-4 w-4" /> Lencana Tersembunyi ({hiddenBadges.length})
            </button>
          )}
          <button
            onClick={() => setActiveTab("daily")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98] ${
              activeTab === "daily"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Zap className="h-4 w-4" /> Kuis Harian ({dailyQuestions.length})
          </button>

          <button
            onClick={() => setActiveTab("team")}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-2 active:scale-[0.98] ${
              activeTab === "team"
                ? "bg-zinc-800 border-zinc-800 text-white shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Users className="h-4 w-4" /> Tim ({teamStaff.length + teamSeats.length})
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

      {/* 3. EXAM PACKAGE QUEUE TAB (M18) */}
      {activeTab === "exams" && (
        <ExamQueueTab
          pendingExams={pendingExams}
          isLoadingExams={isLoadingExams}
          processingExamId={processingExamId}
          onApproveExam={handleApproveExam}
          onRejectExam={handleRejectExam}
        />
      )}

      {/* 4. HIDDEN BADGES MONITOR TAB */}
      {canSeeSecrets && activeTab === "badges" && (
        <HiddenBadgesTab
          hiddenBadges={hiddenBadges}
          badgeHolders={badgeHolders}
          isLoadingBadges={isLoadingBadges}
          expandedBadge={expandedBadge}
          onToggleExpand={(badgeId) => setExpandedBadge(expandedBadge === badgeId ? null : badgeId)}
        />
      )}

      {/* 5. DAILY QUIZ CREATOR TAB */}
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

      {/* 6. TEAM TAB (M17) */}
      {activeTab === "team" && (
        <TeamTab
          staff={teamStaff}
          seats={teamSeats}
          isLoadingTeam={isLoadingTeam}
          hasError={teamError}
        />
      )}
    </div>
  );
}
