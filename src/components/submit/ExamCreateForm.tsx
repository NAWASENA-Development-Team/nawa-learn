// src/components/submit/ExamCreateForm.tsx
// ─── Formulir paket ujian (tab ketiga /submit) ────────────────────────────────
//
// Sampai M17 pembuatan paket ujian adalah modal di halaman latihan: satu tombol
// "Buat Ujian Baru" di samping daftar ujian, dan begitu tersimpan paketnya
// **langsung tayang** untuk semua siswa. M18 memindahkannya ke sini karena dua
// alasan yang saling menguatkan:
//
//   1. Membuat konten adalah satu permukaan. Modul, soal, dan paket ujian ditulis
//      di tempat yang sama, dengan aturan yang sama, dan antreannya sama-sama
//      ditinjau. Modal di halaman latihan membuat "berkontribusi" terlihat
//      seperti fitur latihan, bukan seperti pekerjaan yang dinilai.
//   2. Paket ujian sekarang melewati peninjauan (`status = 'pending'`), jadi
//      jawaban setelah menyimpan bukan lagi "sekarang terlihat oleh semua
//      pengguna" — kalimat itu dulu benar dan sekarang dusta.
//
// Kunci jawaban tetap dikirim dari sini: penulisnya memang orang yang menulis
// kunci itu. Yang tidak boleh terjadi adalah kunci kembali ke browser pembaca
// lain, dan penjaganya ada di `/api/exams/list` + `toPublicExamQuestions()`.
"use client";

import { useState } from "react";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Award, Check, ShieldCheck, Send,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  DIFFICULTY_OPTIONS, CATEGORY_OPTIONS, EMPTY_DRAFT,
} from "@/components/practice/types";
import type { QuestionDraft } from "@/components/practice/types";

/** Batas jumlah soal per paket. Sama dengan batas di `examScoring.ts`. */
const MAX_EXAM_QUESTIONS = 5;

interface ExamCreateFormProps {
  /**
   * Dipanggil setelah server menerima paketnya. Tab `/submit` memakainya untuk
   * memuat ulang daftar "Paket ujianku" di bawah formulir: tanpa itu, paket yang
   * baru dikirim tidak muncul sampai halaman dimuat ulang, dan penulisnya akan
   * mengira kirimannya hilang.
   */
  onCreated?: () => void;
}

export function ExamCreateForm({ onCreated }: ExamCreateFormProps) {
  const { error: toastError, success: toastSuccess, warning: toastWarning } = useToast();

  const [step, setStep] = useState<"meta" | "questions">("meta");
  const [meta, setMeta] = useState({
    title: "",
    subject: "",
    category: "UTBK-SNBT",
    difficulty: "Sedang",
    durationMinutes: 30,
    questionCount: 5,
  });
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  // Diisi setelah server menerima paketnya. Selama ini bukan `null`, formulirnya
  // diganti kartu "menunggu peninjauan" — mengosongkan formulir seolah-olah
  // paketnya gagal, dan membiarkannya terisi mengundang kiriman kedua yang
  // identik (dan langsung menabrak kuota).
  const [created, setCreated] = useState<{ title: string } | null>(null);

  const handleMetaNext = () => {
    if (!meta.title.trim() || !meta.subject.trim()) {
      toastWarning("Data Belum Lengkap", "Judul ujian dan mata pelajaran wajib diisi.");
      return;
    }
    if (meta.questionCount < 1 || meta.questionCount > MAX_EXAM_QUESTIONS) {
      toastWarning("Jumlah Soal Tidak Valid", `Jumlah soal harus antara 1–${MAX_EXAM_QUESTIONS}.`);
      return;
    }
    setDrafts(Array.from({ length: meta.questionCount }, () => ({ ...EMPTY_DRAFT })));
    setIdx(0);
    setStep("questions");
  };

  const updateDraft = (field: keyof QuestionDraft, value: string) => {
    setDrafts((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleSave = async () => {
    // Setiap soal harus lengkap: teks + lima opsi. Kunci sudah pasti terisi
    // karena `EMPTY_DRAFT.answerKey` adalah "A"; yang bisa kosong adalah teksnya.
    const incomplete = drafts.findIndex(
      (d) => !d.text.trim() || !d.optA.trim() || !d.optB.trim() || !d.optC.trim() || !d.optD.trim() || !d.optE.trim(),
    );
    if (incomplete !== -1) {
      toastWarning(
        "Soal Belum Lengkap",
        `Soal nomor ${incomplete + 1} belum lengkap. Isi semua teks soal dan opsi A–E.`,
      );
      setIdx(incomplete);
      return;
    }

    const builtQuestions = drafts.map((d, i) => ({
      // Id sementara, hanya untuk membedakan soal di dalam satu paket. Server
      // tidak memakainya sebagai identitas apa pun.
      id: `draft_q${i}`,
      text: d.text,
      options: { A: d.optA, B: d.optB, C: d.optC, D: d.optD, E: d.optE },
      answerKey: d.answerKey,
      explanation: d.explanation || null,
    }));

    setSaving(true);
    try {
      const res = await fetch("/api/exams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meta.title,
          subject: meta.subject,
          category: meta.category,
          difficulty: meta.difficulty,
          durationMinutes: meta.durationMinutes,
          questions: builtQuestions,
        }),
      });

      // `fetch` hanya menolak pada kegagalan jaringan: tanpa pemeriksaan ini,
      // 409 kuota atau 403 peran akan tampil sebagai "berhasil".
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toastError("Gagal Menyimpan Paket Ujian", err.error || "Coba lagi.");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setCreated({ title: data.title ?? meta.title });
      toastSuccess("Paket Ujian Terkirim", "Paketmu menunggu peninjauan sebelum bisa dikerjakan.");
      // Daftar di bawah formulir memuat ulang di sini, bukan lewat `router.refresh()`:
      // daftarnya sendiri yang di-fetch ulang, dan formulir ini tidak perlu
      // dirender ulang oleh server.
      onCreated?.();
    } catch {
      toastError("Kesalahan Jaringan", "Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCreated(null);
    setStep("meta");
    setDrafts([]);
    setIdx(0);
    setMeta({
      title: "", subject: "", category: "UTBK-SNBT", difficulty: "Sedang",
      durationMinutes: 30, questionCount: 5,
    });
  };

  // ── Setelah terkirim ────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center mb-5">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
          Paket ujian terkirim
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          &ldquo;{created.title}&rdquo; sedang menunggu peninjauan moderator. Setelah
          disetujui, paket itu muncul di halaman latihan dan bisa dikerjakan siswa
          lain — kamu sendiri tidak bisa mengerjakannya, karena kamu memegang
          kuncinya.
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
          Kamu mendapat <span className="font-bold text-zinc-700 dark:text-zinc-300">+20 V-Points</span> saat
          paketnya disetujui. Paket yang belum disetujui tidak muncul di halaman
          latihan siswa lain — statusnya bisa kamu pantau di daftar di bawah.
        </p>
        <button
          type="button"
          onClick={resetForm}
          className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-nawa-primary hover:bg-nawa-primary-hover text-white text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
        >
          Buat Paket Lain
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Kepala + indikator langkah */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">Buat Paket Ujian</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          {step === "meta"
            ? "Atur metadata paketnya lebih dulu"
            : `Isi soal ${idx + 1} dari ${drafts.length}`}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-nawa-primary" />
          <div
            className={`h-2 flex-1 rounded-full ${step === "questions" ? "bg-nawa-primary" : "bg-zinc-200 dark:bg-zinc-700"}`}
          />
        </div>
      </div>

      {/* ── Langkah 1: metadata ── */}
      {step === "meta" && (
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="exam-title" className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Judul Ujian *</label>
            <input
              type="text"
              id="exam-title"
              value={meta.title}
              onChange={(e) => setMeta((p) => ({ ...p, title: e.target.value }))}
              placeholder="Contoh: Simulasi UTBK Matematika Dasar Kelas 12"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label htmlFor="exam-subject" className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Mata Pelajaran *</label>
            <input
              type="text"
              id="exam-subject"
              value={meta.subject}
              onChange={(e) => setMeta((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Contoh: Matematika, Fisika, Biologi…"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="exam-category" className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Kategori</label>
              <select
                id="exam-category"
                value={meta.category}
                onChange={(e) => setMeta((p) => ({ ...p, category: e.target.value }))}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="exam-difficulty" className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Tingkat Kesulitan</label>
              <select
                id="exam-difficulty"
                value={meta.difficulty}
                onChange={(e) => setMeta((p) => ({ ...p, difficulty: e.target.value }))}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="exam-duration" className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Durasi (menit)</label>
              <input
                type="number"
                id="exam-duration"
                min={5}
                max={180}
                value={meta.durationMinutes}
                onChange={(e) => setMeta((p) => ({ ...p, durationMinutes: Math.min(180, Math.max(5, Number(e.target.value))) }))}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <p className="text-[10px] text-zinc-400 mt-1">5–180 menit</p>
            </div>

            <div>
              <label htmlFor="exam-question-count" className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Jumlah Soal</label>
              <input
                type="number"
                id="exam-question-count"
                min={1}
                max={MAX_EXAM_QUESTIONS}
                value={meta.questionCount}
                onChange={(e) => setMeta((p) => ({ ...p, questionCount: Math.min(MAX_EXAM_QUESTIONS, Math.max(1, Number(e.target.value))) }))}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <p className="text-[10px] text-zinc-400 mt-1">Maks. {MAX_EXAM_QUESTIONS} soal per paket</p>
            </div>
          </div>

          {/* Bayaran yang benar. Versi lama di sini menjanjikan "+15 s.d. +100 Poin
              XP saat selesai" untuk pengerja ujian — angka yang tidak pernah
              dibayar oleh route mana pun, karena `exams/submit` memang tidak
              memberi poin (M3). Yang dibayar adalah **penulisnya**, saat paketnya
              disetujui. */}
          <div className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
            <Award className="h-5 w-5 shrink-0 text-nawa-warning" />
            <div>
              <p className="font-bold">+20 V-Points untukmu saat paket ini disetujui.</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                Mengerjakan paket ujian tidak memberi poin kepada siapa pun — poin
                kontribusi hanya datang dari karya yang diterima.
              </p>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={handleMetaNext}
              className="flex-1 py-2.5 rounded-xl bg-nawa-primary hover:bg-nawa-primary-hover active:scale-[0.98] text-white text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              Lanjut: Isi Soal <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Langkah 2: soal ── */}
      {step === "questions" && drafts.length > 0 && (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 mb-1">
            <span>Soal {idx + 1} dari {drafts.length}</span>
            <span>{drafts.filter((d) => d.text.trim()).length} / {drafts.length} terisi</span>
          </div>
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-nawa-primary rounded-full transition-all"
              style={{ width: `${((idx + 1) / drafts.length) * 100}%` }}
            />
          </div>

          <div>
            <label htmlFor="exam-question-text" className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Teks Soal *</label>
            <textarea
              rows={3}
              id="exam-question-text"
              value={drafts[idx]?.text ?? ""}
              onChange={(e) => updateDraft("text", e.target.value)}
              placeholder="Tulis pertanyaan di sini…"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {(["A", "B", "C", "D", "E"] as const).map((key) => {
              const fieldKey = `opt${key}` as keyof QuestionDraft;
              const isKey = drafts[idx]?.answerKey === key;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black border ${
                      isKey
                        ? "bg-nawa-primary text-white border-nawa-primary"
                        : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    {key}
                  </span>
                  <input
                    type="text"
                    aria-label={`Opsi ${key}`}
                    value={drafts[idx]?.[fieldKey] ?? ""}
                    onChange={(e) => updateDraft(fieldKey, e.target.value)}
                    placeholder={`Opsi ${key}…`}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => updateDraft("answerKey", key)}
                    aria-pressed={isKey}
                    className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer active:scale-[0.98] flex items-center gap-1 ${
                      isKey
                        ? "bg-nawa-primary text-white border-nawa-primary"
                        : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 hover:text-nawa-primary"
                    }`}
                  >
                    {isKey && <Check className="h-3 w-3" />}
                    Kunci Jawaban
                  </button>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Pilih tombol <span className="font-bold text-indigo-500">Kunci Jawaban</span> di samping opsi yang benar.
            Kunci aktif: <span className="font-black text-nawa-primary dark:text-indigo-400">Opsi {drafts[idx]?.answerKey}</span>
          </p>

          <div className="pt-2">
            <label htmlFor="exam-explanation" className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Pembahasan (Opsional)</label>
            <textarea
              rows={2}
              id="exam-explanation"
              value={drafts[idx]?.explanation ?? ""}
              onChange={(e) => updateDraft("explanation", e.target.value)}
              placeholder="Pembahasan untuk soal ini… (bisa pakai LaTeX)"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" /> Soal Sebelumnya
            </button>

            {idx < drafts.length - 1 ? (
              <button
                type="button"
                onClick={() => setIdx((i) => Math.min(drafts.length - 1, i + 1))}
                className="flex-[2] py-2.5 rounded-xl bg-nawa-primary hover:bg-nawa-primary-hover active:scale-[0.98] text-white text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                Soal Berikutnya <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 text-white text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Mengirim…
                  </>
                ) : (
                  <><Send className="h-4 w-4" /> Kirim untuk Ditinjau</>
                )}
              </button>
            )}
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Lompat ke Soal:</p>
            <div className="flex flex-wrap gap-1.5">
              {drafts.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Soal ${i + 1}`}
                  aria-current={i === idx}
                  className={`h-7 w-7 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    i === idx
                      ? "bg-nawa-primary border-nawa-primary text-white"
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

          <div className="flex items-start gap-2 pt-1 text-[11px] text-zinc-500 dark:text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
            <span>
              Paket ini akan ditinjau moderator sebelum bisa dikerjakan siapa pun.
              Kamu sendiri tidak bisa mengerjakannya — kamu sudah tahu kuncinya.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
