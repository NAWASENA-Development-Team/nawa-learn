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
  BookMarked
} from "lucide-react";

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
  id: string;
  text: string;
  options: Record<string, string>;
  answerKey: string;
  subject: string;
  category: string;
  submittedAt: string;
  submitterName: string;
};

export default function ModeratorDashboard() {
  const [activeTab, setActiveTab] = useState<"modules" | "questions">("modules");
  
  // Modules State
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(true);
  const [processingModuleId, setProcessingModuleId] = useState<string | null>(null);

  // Questions State
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [processingQuestionId, setProcessingQuestionId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingSubmissions();
    loadPendingQuestions();
  }, []);

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

  // Load pending questions submitted by students from localStorage
  const loadPendingQuestions = () => {
    if (typeof window !== "undefined") {
      const questionsData = localStorage.getItem("pending_questions");
      if (questionsData) {
        setPendingQuestions(JSON.parse(questionsData));
      }
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
        alert("Modul berhasil disetujui! Poin telah ditambahkan ke profil kontributor.");
        setSubmissions((prev) => prev.filter((s) => s.submissionId !== sub.submissionId));
      } else {
        alert("Terjadi kegagalan saat menyetujui modul.");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setProcessingModuleId(null);
    }
  };

  // Approve Question
  const handleApproveQuestion = (q: PendingQuestion) => {
    setProcessingQuestionId(q.id);
    setTimeout(() => {
      // 1. Remove from pending_questions
      const filteredPending = pendingQuestions.filter((item) => item.id !== q.id);
      localStorage.setItem("pending_questions", JSON.stringify(filteredPending));
      setPendingQuestions(filteredPending);

      // 2. Add to approved_questions
      const approvedList = JSON.parse(localStorage.getItem("approved_questions") || "[]");
      localStorage.setItem("approved_questions", JSON.stringify([...approvedList, q]));

      alert(`Soal latihan "${q.subject}" berhasil disetujui! Soal ini sekarang aktif di Halaman Practice.`);
      setProcessingQuestionId(null);
    }, 800);
  };

  // Reject Question
  const handleRejectQuestion = (questionId: string) => {
    if (confirm("Apakah Anda yakin ingin menolak soal latihan ini?")) {
      const filteredPending = pendingQuestions.filter((item) => item.id !== questionId);
      localStorage.setItem("pending_questions", JSON.stringify(filteredPending));
      setPendingQuestions(filteredPending);
      alert("Soal berhasil ditolak dan dihapus dari antrean.");
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
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between shadow-sm transition-all hover:border-indigo-300 gap-6"
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
                      <a 
                        href={sub.moduleUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Buka Dokumen Modul ↗
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 pt-4 md:pt-0">
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

      {/* 2. QUESTIONS SUBMISSION TAB */}
      {activeTab === "questions" && (
        <div className="space-y-4">
          {pendingQuestions.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-3xl p-10 text-center shadow-sm max-w-xl mx-auto">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-100/40">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h4 className="text-base font-extrabold text-zinc-850 dark:text-zinc-150">Antrean Latihan Soal Bersih</h4>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Siswa belum mengajukan soal kuis baru untuk latihan mandiri. Usulan soal latihan dari kontributor akan muncul di sini untuk peninjauan.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {pendingQuestions.map((q) => (
                <div 
                  key={q.id} 
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5 text-left border-l-4 border-l-purple-500"
                >
                  {/* Top Header Card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-0.5 rounded">
                        {q.subject}
                      </span>
                      <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded">
                        {q.category}
                      </span>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400">PENGUSUL: <span className="font-bold text-zinc-600 dark:text-zinc-300">{q.submitterName}</span></p>
                    </div>
                  </div>

                  {/* Question text */}
                  <div>
                    <h4 className="text-sm font-extrabold text-zinc-950 dark:text-zinc-150 leading-relaxed mb-3">
                      {q.text}
                    </h4>

                    {/* Options list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {Object.entries(q.options).map(([key, val]) => (
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
                        onClick={() => handleRejectQuestion(q.id)}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 font-bold px-4 text-xs transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4 mr-1" /> Tolak
                      </button>

                      <button
                        onClick={() => handleApproveQuestion(q)}
                        disabled={processingQuestionId === q.id}
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 text-xs transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                      >
                        <Check className="h-4 w-4 mr-1" /> {processingQuestionId === q.id ? "Menyetujui..." : "Setujui & Publikasikan"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}