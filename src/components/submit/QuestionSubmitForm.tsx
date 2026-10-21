// components/submit/QuestionSubmitForm.tsx
// ─── Formulir kontribusi soal latihan CBT ─────────────────────────────────────
//
// Sepenuhnya mandiri: state sepuluh bidang soal, validasi sisi klien (cermin
// dari skema server di `/api/questions/submit`), panggilan API, dan overlay
// perayaan setelah berhasil. Induk hanya me-render-nya; tidak ada callback
// yang harus dijaga.
//
// `answerKey` memang dikirim ke server dari sini — pembuat soal berhak atas
// kuncinya. Halaman latihan tidak pernah menerimanya kembali untuk pengguna
// lain (lihat `/api/questions/approved`).
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, Sparkles, Loader2, Clock,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { SUBJECTS } from "./types";

type QuestionDifficulty = "mudah" | "sedang" | "sulit";

const DIFFICULTY_CHOICES = [
  { key: "mudah", label: "Mudah", emoji: "🟢", pts: 15, color: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" },
  { key: "sedang", label: "Sedang", emoji: "🟡", pts: 25, color: "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" },
  { key: "sulit", label: "Sulit", emoji: "🔴", pts: 40, color: "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" },
] as const;

export function QuestionSubmitForm() {
  const { error: toastError, warning: toastWarning } = useToast();

  const [questionText, setQuestionText] = useState("");
  const [questionSubject, setQuestionSubject] = useState("");
  const [questionCategory, setQuestionCategory] = useState("UTBK");
  const [questionDifficulty, setQuestionDifficulty] = useState<QuestionDifficulty>("sedang");
  const [questionExplanation, setQuestionExplanation] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [optionE, setOptionE] = useState("");
  const [questionAnswerKey, setQuestionAnswerKey] = useState("A");
  const [isQuestionSubmitting, setIsQuestionSubmitting] = useState(false);
  const [showQuestionSuccess, setShowQuestionSuccess] = useState(false);

  const onSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation (mirrors server schema)
    if (!questionText.trim()) {
      toastWarning("Soal Belum Lengkap", "Teks pertanyaan wajib diisi.");
      return;
    }
    if (questionText.trim().length < 10) {
      toastWarning("Teks Terlalu Pendek", "Pertanyaan minimal harus 10 karakter.");
      return;
    }
    if (!questionSubject.trim() || questionSubject.trim().length < 2) {
      toastWarning("Mata Pelajaran Kosong", "Pilih atau isi mata pelajaran terlebih dahulu.");
      return;
    }
    if (!optionA.trim() || !optionB.trim()) {
      toastWarning("Opsi Belum Lengkap", "Minimal isi opsi A dan B.");
      return;
    }

    setIsQuestionSubmitting(true);
    try {
      const res = await fetch("/api/questions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: questionText.trim(),
          options: {
            A: optionA.trim(),
            B: optionB.trim(),
            C: optionC.trim() || "-",
            D: optionD.trim() || "-",
            E: optionE.trim() || "-",
          },
          answerKey: questionAnswerKey,
          explanation: questionExplanation.trim(),
          difficulty: questionDifficulty,
          subject: questionSubject.trim(),
          category: questionCategory,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          toastError("Belum Login", "Silakan refresh halaman dan login kembali.");
        } else if (res.status === 404) {
          toastError("Profil Tidak Ditemukan", "Logout dan login kembali untuk menyinkronkan profil.");
        } else if (res.status === 400 && err.details) {
          // `details` is the shared field-error shape from src/lib/validation.ts:
          // `path` is a dotted string, with `(root)` for the whole body.
          const firstIssue = err.details[0];
          const fieldName = firstIssue?.path ?? "field";
          const fieldMap: Record<string, string> = {
            questionText: "teks pertanyaan",
            subject: "mata pelajaran",
            category: "kategori",
            answerKey: "kunci jawaban",
            difficulty: "tingkat kesulitan",
          };
          const label = fieldMap[String(fieldName)] ?? String(fieldName);
          toastError("Data Tidak Valid", `Periksa kolom "${label}": ${firstIssue?.message ?? "nilai tidak sesuai"}.`);
        } else {
          toastError("Gagal Mengirim Soal", err.error || "Terjadi kesalahan, coba lagi.");
        }
        return;
      }

      setShowQuestionSuccess(true);
      // Clear fields
      setQuestionText("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setOptionE("");
      setQuestionAnswerKey("A");
      setQuestionExplanation("");
      setQuestionDifficulty("sedang");
    } catch {
      toastError("Kesalahan Jaringan", "Pastikan Anda sudah login dan terhubung ke internet.");
    } finally {
      setIsQuestionSubmitting(false);
    }
  };

  return (
    <>
      {/* Question Success Celebration Popup overlay */}
      {showQuestionSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-6 relative border border-emerald-200">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
              <Sparkles className="h-5 w-5 text-nawa-warning absolute -top-1 -right-1 animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Soal Berhasil Dikirim!</h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
              Soal mata pelajaran <span className="font-bold text-nawa-primary dark:text-indigo-400">&quot;{questionSubject}&quot;</span> telah masuk ke antrean moderator.
            </p>

            {/* Pending notice */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 mb-4 text-left flex gap-2.5 items-start">
              <Clock className="h-4 w-4 text-nawa-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300">Menunggu persetujuan moderator</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 leading-snug">
                  Poin XP baru diberikan <strong>setelah moderator menyetujui</strong> soal ini. Soal sudah muncul di tab <em>Soal Saya</em> pada profilmu dengan status <em>verifikasi</em>.
                </p>
              </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-5 flex items-center justify-between text-left">
              <div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">POIN SAAT DISETUJUI</p>
                <p className="text-base font-bold text-nawa-primary dark:text-indigo-400">
                  {questionDifficulty === "mudah" ? "+15" : questionDifficulty === "sulit" ? "+40" : "+25"} Poin XP
                </p>
              </div>
              <div className={`text-xs px-2.5 py-1 rounded-md font-semibold border ${
                questionDifficulty === "mudah"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
                  : questionDifficulty === "sulit"
                    ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900"
              }`}>
                {questionDifficulty === "mudah" ? "Mudah" : questionDifficulty === "sulit" ? "Sulit" : "Sedang"}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowQuestionSuccess(false)}
                className="w-full bg-nawa-primary hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-nawa-primary/10 hover:shadow-lg active:scale-95 cursor-pointer text-xs"
              >
                Buat Soal Lain
              </button>
              <Link
                href="/profile"
                className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold py-2.5 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-1.5 text-xs border border-zinc-200 dark:border-zinc-700"
              >
                Lihat di Profilku
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Custom CBT Question Submission Form */}
      <form onSubmit={onSubmitQuestion} className="space-y-6 bg-white dark:bg-zinc-900 p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm text-left">

        {/* Question text input */}
        <div>
          <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">Pertanyaan Soal Kuis</label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400 min-h-[120px] shadow-inner"
            placeholder="Ketikkan deskripsi lengkap soal latihan di sini... (Gunakan $$...$$ atau $...$ untuk rumus LaTeX, contoh: $x^2 + y^2 = r^2$)"
            required
          />
        </div>

        {/* Explanation text input */}
        <div>
          <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">Pembahasan Singkat (Opsional)</label>
          <textarea
            value={questionExplanation}
            onChange={(e) => setQuestionExplanation(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400 min-h-[100px] shadow-inner"
            placeholder="Beri penjelasan singkat mengapa jawaban tersebut benar... (Mendukung LaTeX)"
          />
        </div>

        {/* Subject & Category Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Subject Selector */}
          <div>
            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">Mata Pelajaran</label>
            <select
              value={questionSubject}
              onChange={(e) => setQuestionSubject(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white cursor-pointer"
              required
            >
              <option value="">-- Pilih Mata Pelajaran --</option>
              {SUBJECTS.map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">Kategori Ujian</label>
            <select
              value={questionCategory}
              onChange={(e) => setQuestionCategory(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white cursor-pointer"
              required
            >
              <option value="UTBK">UTBK / SNBT</option>
              <option value="Olimpiade">Olimpiade (OSN)</option>
              <option value="Reguler">Ujian Harian / Reguler</option>
            </select>
          </div>
        </div>

        {/* Difficulty + Point Preview */}
        <div>
          <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2">
            Tingkat Kesulitan Soal
          </label>
          <div className="grid grid-cols-3 gap-3">
            {DIFFICULTY_CHOICES.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setQuestionDifficulty(d.key)}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all duration-150 cursor-pointer ${
                  questionDifficulty === d.key
                    ? d.color + " shadow-md scale-[1.03]"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 hover:border-zinc-400"
                }`}
              >
                <span className="text-lg">{d.emoji}</span>
                <span className="text-xs font-bold">{d.label}</span>
                <span className="text-[10px] font-semibold opacity-80">+{d.pts} XP</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Poin diberikan ke akunmu saat soal disetujui moderator. Soal lebih sulit = lebih banyak Poin XP!
          </p>
        </div>

        {/* Options A-E */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Opsi Pilihan Jawaban (A-E)</h4>

          {[
            { label: "Opsi A", val: optionA, set: setOptionA },
            { label: "Opsi B", val: optionB, set: setOptionB },
            { label: "Opsi C", val: optionC, set: setOptionC },
            { label: "Opsi D", val: optionD, set: setOptionD },
            { label: "Opsi E", val: optionE, set: setOptionE },
          ].map((opt, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-500 select-none shrink-0 border border-zinc-200 dark:border-zinc-700">
                {String.fromCharCode(65 + idx)}
              </span>
              <input
                type="text"
                value={opt.val}
                onChange={(e) => opt.set(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-inner"
                placeholder={`Isi konten jawaban untuk pilihan ${String.fromCharCode(65 + idx)}...`}
                required={idx < 2} // A and B are required
              />
            </div>
          ))}
        </div>

        {/* Correct answer key selector */}
        <div>
          <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">Kunci Jawaban Benar</label>
          <select
            value={questionAnswerKey}
            onChange={(e) => setQuestionAnswerKey(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white cursor-pointer"
            required
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
          </select>
        </div>

        {/* Submit Question Button */}
        <button
          type="submit"
          disabled={isQuestionSubmitting}
          className="w-full bg-nawa-primary text-white py-3.5 rounded-xl hover:bg-nawa-primary-hover disabled:opacity-50 disabled:pointer-events-none font-bold transition-all duration-200 text-xs sm:text-sm shadow-lg shadow-nawa-primary/10 hover:shadow-xl hover:scale-[1.005] active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-nawa-primary-hover"
        >
          {isQuestionSubmitting ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
              Mengajukan Soal Ke Moderator...
            </>
          ) : (
            <>
              <Sparkles className="h-4.5 w-4.5 text-amber-300" />
              Kirim Soal Latihan & Dapatkan Poin
            </>
          )}
        </button>
      </form>
    </>
  );
}
