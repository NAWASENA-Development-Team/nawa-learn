// app/(dashboard)/moderator/page.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  Check, 
  X, 
  BookOpen, 
  HelpCircle, 
  Sparkles, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Award,
  BookMarked,
  Lock,
  Eye,
  ChevronDown,
} from "lucide-react";
import { BADGES, getDaysOldAccount, getRarityColor } from "@/lib/badges";
import type { BadgeUnlockData } from "@/lib/badges";
import { useToast } from "@/components/ui/Toast";

type PendingSubmission = {
  submissionId: string;
  submittedAt: string;
  moduleId: string;
  moduleTitle: string;
  moduleUrl: string;
  submitterId: string;
  submitterName: string;
};

type PendingQuestion = {
  submissionId: string;
  questionId: string;
  questionText: string;
  options: Record<string, string>;
  answerKey: string;
  difficulty: "mudah" | "sedang" | "sulit";
  subject: string | null;
  category: string | null;
  submittedAt: string;
  submitterId: string;
  submitterName: string;
};

const MODERATOR_PASSWORD = "nawa2024"; // Change this to your desired password

// User stats returned from /api/moderator/hidden-badges
type UserStats = {
  id: string;
  name: string;
  points: number;
  createdAt: string;
  approvedModules: number;
  totalDownloads: number;
  approvedQuestions: number;
};

// Pre-compute the hidden badges list once
const HIDDEN_BADGES = BADGES.filter((b) => b.hidden);

export default function ModeratorDashboard() {
  const { success, error: toastError, info } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [activeTab, setActiveTab] = useState<"modules" | "questions" | "badges">("modules");
  
  // Modules State
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [processingModuleId, setProcessingModuleId] = useState<string | null>(null);

  // Questions State
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [processingQuestionId, setProcessingQuestionId] = useState<string | null>(null);

  // Hidden Badges State
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [isLoadingBadges, setIsLoadingBadges] = useState(false);
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null);

  useEffect(() => {
    // Check if already authenticated from sessionStorage
    const isAuth = sessionStorage.getItem("moderator_authenticated") === "true";
    setIsAuthenticated(isAuth);
    
    if (isAuth) {
      fetchPendingSubmissions();
      fetchPendingQuestions();
      fetchHiddenBadges();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHiddenBadges = async () => {
    setIsLoadingBadges(true);
    try {
      const res = await fetch("/api/moderator/hidden-badges");
      if (res.ok) {
        const { users } = await res.json();
        setUserStats(users);
      }
    } catch (error) {
      console.error("Gagal mengambil data badge tersembunyi:", error);
    } finally {
      setIsLoadingBadges(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    
    if (passwordInput === MODERATOR_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem("moderator_authenticated", "true");
      setPasswordInput("");
      fetchPendingSubmissions();
      fetchPendingQuestions();
      fetchHiddenBadges();
    } else {
      setPasswordError("Password salah. Silakan coba lagi.");
      setPasswordInput("");
    }
  };

  const fetchPendingSubmissions = async () => {
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
  };

  // Load pending questions from real DB API
  const fetchPendingQuestions = async () => {
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
  };

  // Approve Module
  const handleApproveModule = async (sub: PendingSubmission) => {
    setProcessingModuleId(sub.submissionId);
    try {
      const res = await fetch("/api/modules/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: sub.submissionId,
          moduleId: sub.moduleId,
          submitterId: sub.submitterId,
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
          questionId: q.questionId,
          submitterId: q.submitterId,
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
          questionId: q.questionId,
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

  // If not authenticated, show password form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-lg">
            {/* Lock Icon */}
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-100/40">
              <Lock className="h-8 w-8" />
            </div>

            <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white text-center mb-2">
              Ruang Moderator
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
              Halaman ini dilindungi. Masukkan password untuk melanjutkan.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">{passwordError}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl transition-colors shadow-md shadow-indigo-600/10"
              >
                Masuk
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

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
            <Eye className="h-4 w-4" /> Lencana Tersembunyi ({HIDDEN_BADGES.length})
          </button>
        </div>
      </div>

      {/* 1. MODULES SUBMISSION TAB */}
      {activeTab === "modules" && (
        <div className="space-y-4">
          {isLoadingModules ? (
            <div className="p-12 text-center text-zinc-550 flex flex-col items-center justify-center">
              <div className="h-8 w-8 rounded-full border-4 border-indigo-150 border-t-indigo-600 animate-spin mb-3" />
              <p className="text-xs font-bold">Memuat antrean draf modul...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-3xl p-10 text-center shadow-sm max-w-xl mx-auto">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100/40">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h4 className="text-base font-extrabold text-zinc-850 dark:text-zinc-150">Antrean Modul Bersih</h4>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Saat ini belum ada draf modul yang diajukan oleh siswa untuk ditinjau. Semua modul yang dikirim telah diterbitkan!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {submissions.map((sub) => (
                <div 
                  key={sub.submissionId} 
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between shadow-sm transition-all hover:border-indigo-300 gap-3 sm:gap-6"
                >
                  <div className="space-y-1.5 flex-1 text-left">
                    <h3 className="text-base font-extrabold text-zinc-900 dark:text-white leading-snug">
                      {sub.moduleTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-semibold">
                      <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <User className="h-3.5 w-3.5" /> Pengirim: {sub.submitterName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" /> {new Date(sub.submittedAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          const url = sub.moduleUrl;
                          if (url.startsWith("data:")) {
                            // Trigger download for real uploaded files stored as base64
                            const ext = url.startsWith("data:image/png") ? ".png"
                                      : url.startsWith("data:image/jpeg") ? ".jpg"
                                      : url.startsWith("data:application/pdf") ? ".pdf"
                                      : url.includes("wordprocessingml") ? ".docx"
                                      : url.includes("presentationml") ? ".pptx"
                                      : ".dat";
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `modul-${sub.moduleTitle}${ext}`;
                            link.click();
                          } else {
                            window.open(url, "_blank", "noopener,noreferrer");
                          }
                        }}
                        className="inline-flex items-center text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      >
                        Buka Dokumen Modul ↗
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-4 sm:pt-0">
                    <button 
                      onClick={() => handleApproveModule(sub)}
                      disabled={processingModuleId === sub.submissionId}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-600/10 cursor-pointer h-9 disabled:opacity-50"
                    >
                      {processingModuleId === sub.submissionId ? "Memproses..." : "Setujui Modul"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. HIDDEN BADGES MONITOR TAB */}
      {activeTab === "badges" && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl px-5 py-3 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <Eye className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Halaman ini hanya terlihat oleh moderator. Lencana tersembunyi <strong>tidak ditampilkan</strong> kepada
              siswa — mereka hanya melihat slot <em>"???"</em> di profil. Pantau siapa saja yang berhasil
              membukanya di sini.
            </span>
          </div>

          {isLoadingBadges ? (
            <div className="p-12 text-center text-zinc-550 flex flex-col items-center justify-center">
              <div className="h-8 w-8 rounded-full border-4 border-amber-150 border-t-amber-500 animate-spin mb-3" />
              <p className="text-xs font-bold">Memuat data lencana tersembunyi...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {HIDDEN_BADGES.map((badge) => {
                // Compute holders client-side using the same unlock logic
                const holders = userStats.filter((u) => {
                  const data: BadgeUnlockData = {
                    points: u.points,
                    rank: 0,
                    totalStudents: userStats.length,
                    approvedModules: Number(u.approvedModules),
                    approvedQuestions: Number(u.approvedQuestions),
                    totalDownloads: Number(u.totalDownloads),
                    modulesBySubject: {},
                    questionsCreated: 0,
                    accountAgeInDays: getDaysOldAccount(u.createdAt),
                    createdAt: u.createdAt,
                  };
                  return badge.unlockCondition(data);
                });

                const isExpanded = expandedBadge === badge.id;

                return (
                  <div
                    key={badge.id}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm"
                  >
                    {/* Badge header row */}
                    <button
                      onClick={() => setExpandedBadge(isExpanded ? null : badge.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-gradient-to-br ${getRarityColor(badge.rarity)} shadow-sm`}>
                        {badge.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{badge.title}</h4>
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            Tersembunyi
                          </span>
                          <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold px-2 py-0.5 rounded capitalize">
                            {badge.rarity}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{badge.description}</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold mt-1">
                          Syarat rahasia: {badge.unlockCondition.toString().replace(/.*=> /, "").replace("data\.", "").trim()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 pr-1">
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                          {holders.length}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-semibold">pemegang</span>
                        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {/* Holders list (expandable) */}
                    {isExpanded && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pb-4 pt-3">
                        {holders.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic">Belum ada siswa yang membuka lencana ini.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                              {holders.length} Siswa Pemegang Lencana
                            </p>
                            {holders.map((u, idx) => (
                              <div key={u.id} className="flex items-center gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl">
                                <span className="text-xs font-black text-zinc-400 w-5 text-center">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">{u.name}</p>
                                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                                    {u.points} VP · {Number(u.approvedModules)} modul · {Number(u.approvedQuestions)} soal
                                  </p>
                                </div>
                                <a
                                  href={`/profile/${u.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                                >
                                  Profil ↗
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. QUESTIONS SUBMISSION TAB */}
      {activeTab === "questions" && (
        <div className="space-y-4">
          {isLoadingQuestions ? (
            <div className="text-center py-10 text-zinc-500 text-sm">Memuat soal pending...</div>
          ) : pendingQuestions.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-3xl p-10 text-center shadow-sm max-w-xl mx-auto">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-100/40">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h4 className="text-base font-extrabold text-zinc-850 dark:text-zinc-150">Antrean Latihan Soal Bersih</h4>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Siswa belum mengajukan soal kuis baru untuk latihan mandiri. Usulan soal latihan dari kontributor akan muncul di sini untuk peninjauan.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {pendingQuestions.map((q) => {
                const difficultyBadge = {
                  mudah:  { label: "Mudah",  cls: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400", pts: "+15 VP" },
                  sedang: { label: "Sedang", cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",   pts: "+25 VP" },
                  sulit:  { label: "Sulit",  cls: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",           pts: "+40 VP" },
                }[q.difficulty] ?? { label: q.difficulty, cls: "bg-zinc-100 text-zinc-600", pts: "" };

                return (
                <div 
                  key={q.questionId} 
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5 text-left border-l-4 border-l-purple-500"
                >
                  {/* Top Header Card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {q.subject && (
                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-0.5 rounded">
                          {q.subject}
                        </span>
                      )}
                      {q.category && (
                        <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded">
                          {q.category}
                        </span>
                      )}
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded ${difficultyBadge.cls}`}>
                        {difficultyBadge.label} · {difficultyBadge.pts}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400">PENGUSUL: <span className="font-bold text-zinc-600 dark:text-zinc-300">{q.submitterName}</span></p>
                    </div>
                  </div>

                  {/* Question text */}
                  <div>
                    <h4 className="text-sm font-extrabold text-zinc-950 dark:text-zinc-150 leading-relaxed mb-3">
                      {q.questionText}
                    </h4>

                    {/* Options list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {Object.entries(q.options as Record<string, string>).map(([key, val]) => (
                        <div 
                          key={key} 
                          className={`p-2.5 rounded-xl border text-xs flex gap-2 items-center ${
                            q.answerKey === key 
                              ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-350 text-emerald-800 dark:text-emerald-450 font-bold"
                              : "border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                            q.answerKey === key ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                          }`}>
                            {key}
                          </span>
                          <span className="truncate">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer tools */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                    <div className="text-xs text-zinc-450 dark:text-zinc-500 font-semibold">
                      🔑 Kunci Jawaban: <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm uppercase">Opsi {q.answerKey}</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectQuestion(q)}
                        disabled={processingQuestionId === q.questionId}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 font-bold px-4 text-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <X className="h-4 w-4 mr-1" /> Tolak
                      </button>

                      <button
                        onClick={() => handleApproveQuestion(q)}
                        disabled={processingQuestionId === q.questionId}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 text-xs transition-all shadow-md shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="h-4 w-4 mr-1" /> {processingQuestionId === q.questionId ? "Memproses..." : "Setujui & Publikasikan"}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}