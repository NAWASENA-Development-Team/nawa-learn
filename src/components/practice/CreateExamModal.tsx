// components/practice/CreateExamModal.tsx
// ─── Wizard pembuatan ujian buatan siswa ──────────────────────────────────────
//
// Modal ini menguasai state draft-nya sendiri (meta ujian, draf soal, indeks
// soal aktif) — halaman tidak perlu tahu sedang di soal ke berapa. Begitu
// `/api/exams/create` menjawab, modal ini menyerahkan ujian yang sudah jadi
// lewat `onExamCreated` dan halaman yang menambahkannya ke daftar.
//
// Catatan keamanan: `answerKey` tiap soal **memang** dikirim ke server dari
// sini. Ini bukan kebocoran — pembuat soal adalah orang yang menulis kuncinya.
// Yang tidak boleh terjadi adalah kunci itu kembali ke browser *pembaca*
// lain, dan pencegahannya ada di `/api/exams/list` + `toPublicExamQuestions`.
"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, CheckCircle2, Award, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  DIFFICULTY_OPTIONS, CATEGORY_OPTIONS, EMPTY_DRAFT, getDifficultyStyle,
} from "./types";
import type { Quiz, QuestionDraft } from "./types";

interface CreateExamModalProps {
  onClose: () => void;
  onExamCreated: (quiz: Quiz) => void;
}

export function CreateExamModal({ onClose, onExamCreated }: CreateExamModalProps) {
  const { error: toastError, success: toastSuccess, warning: toastWarning } = useToast();

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
  const [isSavingExam, setIsSavingExam] = useState(false);

  const handleMetaNext = () => {
    if (!examMeta.title.trim() || !examMeta.subject.trim()) {
      toastWarning("Data Belum Lengkap", "Judul ujian dan mata pelajaran wajib diisi.");
      return;
    }
    if (examMeta.questionCount < 1 || examMeta.questionCount > 5) {
      toastWarning("Jumlah Soal Tidak Valid", "Jumlah soal harus antara 1–5.");
      return;
    }
    // Initialise blank drafts
    setExamDrafts(Array(examMeta.questionCount).fill(null).map(() => ({ ...EMPTY_DRAFT })));
    setExamQIdx(0);
    setCreateStep("questions");
  };

  // Current draft is already tracked via examDrafts state (updated live)
  const saveDraftAndGo = (direction: "next" | "prev") => {
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

  const handleSaveExam = async () => {
    // Validate all questions have text + all options + answer key
    const incomplete = examDrafts.findIndex(
      (d) => !d.text.trim() || !d.optA.trim() || !d.optB.trim() || !d.optC.trim() || !d.optD.trim() || !d.optE.trim()
    );
    if (incomplete !== -1) {
      toastWarning("Soal Belum Lengkap", `Soal nomor ${incomplete + 1} belum lengkap. Isi semua teks soal dan opsi A–E.`);
      setExamQIdx(incomplete);
      return;
    }

    const tempId = `custom_${Date.now()}`;
    const builtQuestions = examDrafts.map((d, i) => ({
      id: `${tempId}_q${i}`,
      text: d.text,
      options: { A: d.optA, B: d.optB, C: d.optC, D: d.optD, E: d.optE },
      answerKey: d.answerKey,
      explanation: d.explanation || null,
      subject: examMeta.subject,
      category: examMeta.category,
    }));

    setIsSavingExam(true);
    try {
      const res = await fetch("/api/exams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: examMeta.title,
          subject: examMeta.subject,
          category: examMeta.category,
          difficulty: examMeta.difficulty,
          durationMinutes: examMeta.durationMinutes,
          questions: builtQuestions.map((q) => ({
            id: q.id,
            text: q.text,
            options: q.options,
            answerKey: q.answerKey,
            explanation: q.explanation || null,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toastError("Gagal Menyimpan Ujian", err.error || "Coba lagi.");
        return;
      }

      const { examId } = await res.json();

      // Add immediately to local state so the creator can use it right away
      onExamCreated({
        id: examId,
        title: examMeta.title,
        subject: examMeta.subject,
        category: examMeta.category,
        questionsCount: builtQuestions.length,
        durationMinutes: examMeta.durationMinutes,
        difficulty: examMeta.difficulty,
        icon: "✏️",
        questions: builtQuestions,
        author: "Siswa SMAN 2",
        isCustom: true,
      });

      toastSuccess(`Ujian Berhasil Dibuat!`, `"${examMeta.title}" sekarang terlihat oleh semua pengguna.`);
    } catch {
      toastError("Kesalahan Jaringan", "Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setIsSavingExam(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-[95vw] sm:max-w-xl max-h-[92vh] overflow-y-auto">

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
            onClick={onClose}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  min={1} max={5}
                  value={examMeta.questionCount}
                  onChange={(e) => setExamMeta((p) => ({ ...p, questionCount: Math.min(5, Math.max(1, Number(e.target.value))) }))}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <p className="text-[10px] text-zinc-400 mt-1">Maks. 5 soal per ujian</p>
              </div>
            </div>

            {/* Poin XP info */}
            <div className={`p-3.5 rounded-2xl border flex items-center gap-3 text-xs ${getDifficultyStyle(examMeta.difficulty)}`}>
              <Award className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="font-bold">Hadiah Poin XP ujian ini:</p>
                <p>
                  {examMeta.difficulty === "Mudah" ? "+15" : examMeta.difficulty === "Sedang" ? "+25" : examMeta.difficulty === "Sulit" ? "+45" : "+100"} Poin XP saat selesai (pertama kali)
                  &nbsp;· penalti <span className="font-bold">-10%</span> total Poin per jawaban salah
                </p>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleMetaNext}
                className="flex-[2] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
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
                      className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1 ${
                        examDrafts[examQIdx]?.answerKey === key
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 hover:text-indigo-600"
                      }`}
                      title={`Jadikan opsi ${key} sebagai kunci jawaban`}
                    >
                      {examDrafts[examQIdx]?.answerKey === key && <Check className="h-3 w-3" />}
                      Kunci Jawaban
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Pilih tombol <span className="font-bold text-indigo-500">Kunci Jawaban</span> di samping opsi yang benar.
              Kunci aktif: <span className="font-black text-indigo-600 dark:text-indigo-400">Opsi {examDrafts[examQIdx]?.answerKey}</span>
            </p>

            {/* Explanation text */}
            <div className="pt-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Pembahasan (Opsional)</label>
              <textarea
                rows={2}
                value={examDrafts[examQIdx]?.explanation ?? ""}
                onChange={(e) => updateDraft("explanation", e.target.value)}
                placeholder="Pembahasan untuk soal ini... (Bisa pakai LaTeX)"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>

            {/* Navigation between questions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => saveDraftAndGo("prev")}
                disabled={examQIdx === 0}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" /> Soal Sebelumnya
              </button>

              {examQIdx < examDrafts.length - 1 ? (
                <button
                  onClick={() => saveDraftAndGo("next")}
                  className="flex-[2] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Soal Berikutnya <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSaveExam}
                  disabled={isSavingExam}
                  className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 text-white text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingExam ? (
                    <><div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Menyimpan...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Simpan &amp; Bagikan Ujian</>
                  )}
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
  );
}
