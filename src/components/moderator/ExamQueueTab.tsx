// components/moderator/ExamQueueTab.tsx
// ─── Tab: antrean paket ujian ────────────────────────────────────────────────
//
// Tab ini ada karena M18 menutup jalan pintas yang lama: sampai M17 paket ujian
// yang dibuat siswa **langsung tayang**, dan satu kunci jawaban yang salah akan
// menyesatkan setiap siswa yang mengerjakannya tanpa pernah ada yang memeriksa.
// Sekarang paket berstatus `pending` sampai peninjau memutuskan.
//
// Murni presentasi, seperti tab antrean lainnya. Persetujuan dan penolakan adalah
// callback ke shell, yang memanggil route dan menghapus kartunya dari antrean.
//
// Kunci jawaban tampil di sini dan itu memang tugasnya — lihat catatan di
// `PendingExamQuestion`: satu-satunya route yang mengirim kunci ke browser
// peninjau adalah `/api/exams/pending`, di balik `requireReviewer()`.
"use client";

import { useState } from "react";
import { Check, X, ClipboardList, Key, Clock, FileText } from "lucide-react";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import type { PendingExam } from "./types";

interface ExamQueueTabProps {
  pendingExams: PendingExam[];
  isLoadingExams: boolean;
  processingExamId: string | null;
  onApproveExam: (exam: PendingExam) => void;
  onRejectExam: (exam: PendingExam, reason: string) => void;
}

/**
 * Tanggal singkat untuk kepala kartu.
 *
 * Nama bulan ditulis manual, bukan lewat `toLocaleDateString("id-ID")`: format
 * locale bergantung pada data ICU yang tersedia di mesin yang menjalankannya,
 * dan hasil yang berbeda antara server dan peramban adalah sumber peringatan
 * hidrasi. Datanya sendiri baru tiba setelah mount (fetch di shell), jadi tidak
 * ada HTML server yang perlu dicocokkan — tetapi satu format tetap lebih murah
 * daripada satu kelas bug.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function ExamQueueTab({
  pendingExams, isLoadingExams, processingExamId, onApproveExam, onRejectExam,
}: ExamQueueTabProps) {
  // Satu paket bisa ditolak dengan alasan. Alasannya ditulis di kartu itu
  // sendiri, bukan di `prompt()`: `prompt()` diblokir di sebagian peramban dan
  // tidak bisa menampilkan soal yang sedang dinilai di sebelah kotak isiannya.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const startReject = (exam: PendingExam) => {
    setRejectingId(exam.submissionId);
    setReason("");
  };

  const cancelReject = () => {
    setRejectingId(null);
    setReason("");
  };

  const submitReject = (exam: PendingExam) => {
    // Alasan kosong bukan alasan. Penolakan tanpa catatan membuat penulis tidak
    // tahu apa yang harus diperbaiki, dan surelnya akan berbunyi seperti keputusan
    // sewenang-wenang.
    if (!reason.trim()) return;
    onRejectExam(exam, reason.trim());
    cancelReject();
  };

  if (isLoadingExams) {
    return <div className="text-center py-10 text-zinc-500 text-sm">Memuat paket ujian pending...</div>;
  }

  if (pendingExams.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-3xl p-10 text-center shadow-sm max-w-xl mx-auto">
        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-nawa-primary dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100/40">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h4 className="text-base font-extrabold text-zinc-800 dark:text-zinc-100">Antrean Paket Ujian Bersih</h4>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Belum ada paket ujian yang menunggu peninjauan. Paket yang diajukan kontributor
          akan muncul di sini sebelum bisa dikerjakan siswa.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {pendingExams.map((exam) => (
        <div
          key={exam.submissionId}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5 text-left border-l-4 border-l-indigo-500"
        >
          {/* Kepala kartu */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
            <div className="min-w-0">
              <h4 className="text-base font-extrabold text-zinc-900 dark:text-white leading-snug">
                {exam.title}
              </h4>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-nawa-primary dark:text-indigo-400 font-extrabold px-2.5 py-0.5 rounded">
                  {exam.subject}
                </span>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded">
                  {exam.category}
                </span>
                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-extrabold px-2.5 py-0.5 rounded">
                  {exam.difficulty}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-bold px-2 py-0.5">
                  <FileText className="h-3 w-3" /> {exam.questionCount} soal
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 font-bold px-2 py-0.5">
                  <Clock className="h-3 w-3" /> {exam.durationMinutes} menit
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-[10px] text-zinc-400">
                PENULIS: <span className="font-bold text-zinc-600 dark:text-zinc-300">{exam.submitterName}</span>
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Diajukan {shortDate(exam.submittedAt)}</p>
            </div>
          </div>

          {/* Seluruh soal. Paket maksimal lima soal, jadi tidak ada yang dilipat:
              peninjau yang harus mengklik "lihat soal" akan menyetujui kepala
              kartunya saja. */}
          <ol className="space-y-4">
            {exam.questions.map((question, index) => (
              <li key={question.id} className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-3.5">
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                  <span className="text-zinc-400 mr-1.5">{index + 1}.</span>
                  <LatexRenderer text={question.text} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
                  {Object.entries(question.options).map(([key, value]) => (
                    <div
                      key={key}
                      className={`p-2.5 rounded-xl border text-xs flex gap-2 items-center ${
                        question.answerKey === key
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 text-emerald-800 dark:text-emerald-400 font-bold"
                          : "border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                        question.answerKey === key ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>
                        {key}
                      </span>
                      <span className="truncate"><LatexRenderer text={value} /></span>
                    </div>
                  ))}
                </div>

                {question.explanation && (
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    <span className="font-bold">Pembahasan:</span> {question.explanation}
                  </p>
                )}
              </li>
            ))}
          </ol>

          {/* Keputusan */}
          {rejectingId === exam.submissionId ? (
            <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 space-y-2">
              <label
                htmlFor={`reject-reason-${exam.submissionId}`}
                className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block"
              >
                Alasan penolakan (dikirim ke penulis)
              </label>
              <textarea
                id={`reject-reason-${exam.submissionId}`}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: kunci soal 3 keliru — jawaban yang benar adalah B, bukan D."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={cancelReject}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold px-4 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => submitReject(exam)}
                  disabled={!reason.trim() || processingExamId === exam.submissionId}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold px-4 text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Kirim Penolakan
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Periksa setiap kunci sebelum menerbitkan.</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startReject(exam)}
                  disabled={processingExamId === exam.submissionId}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.98] text-red-600 dark:text-red-400 font-bold px-4 text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="h-4 w-4 mr-1" /> Tolak
                </button>

                <button
                  type="button"
                  onClick={() => onApproveExam(exam)}
                  disabled={processingExamId === exam.submissionId}
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold px-4 text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {processingExamId === exam.submissionId ? "Memproses..." : "Setujui & Terbitkan"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
