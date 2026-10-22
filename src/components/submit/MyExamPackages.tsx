// src/components/submit/MyExamPackages.tsx
// ─── Daftar "Paket ujianku" di tab ketiga /submit ─────────────────────────────
//
// Dulu pengelolaan paket ujian ada di halaman latihan, dan tombol hapusnya bahkan
// tidak menghapus apa pun: `handleDeleteCustomExam` hanya menyaring baris dari
// state lokal sambil memberi tahu bahwa "ujian tetap tersimpan di server". M18
// memindahkan pengelolaan ke sini karena hanya di sini penulisnya melihat paket
// yang **belum** disetujui — daftar latihan sengaja tidak memuatnya, karena paket
// pending bukan materi yang boleh dikerjakan.
//
// Status yang bisa dilihat penulis:
//
//   pending  → menunggu peninjauan; tidak tayang, tidak bisa dikerjakan siapa pun
//   approved → tayang di halaman latihan; penulisnya sendiri tidak bisa mengerjakan
//   rejected → tidak tayang; peninjau mengirim alasannya lewat surel, dan satu-
//              satunya jalan memperbaikinya adalah menghapus lalu membuat ulang
//              (tidak ada alur sunting, dan itu disengaja: paket yang disunting
//              setelah ditolak akan lolos tanpa tinjauan ulang kalau ada).
//
// Hapus di sini **permanen**, termasuk baris `submissions`-nya, dan hanya bisa
// dilakukan pemiliknya (`DELETE /api/exams/[id]` menjawab `403 not_owner` untuk
// siapa pun selain dia).
"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList, Clock, FileText, Loader2, Trash2, CheckCircle2,
  XCircle, AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

type ExamStatus = "pending" | "approved" | "rejected";

type OwnExam = {
  id: string;
  title: string;
  subject: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  questionCount: number;
  status: ExamStatus;
};

/** Batas yang sama dengan `src/lib/submissionQuota.ts`, untuk ditampilkan. */
const MAX_PENDING_EXAMS = 3;
const MAX_PUBLISHED_EXAMS = 25;

const STATUS_STYLE: Record<ExamStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: {
    label: "Menunggu Peninjauan",
    className: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40",
    icon: Clock,
  },
  approved: {
    label: "Tayang",
    className: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Ditolak",
    className: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
    icon: XCircle,
  },
};

export function MyExamPackages() {
  const { success, error: toastError } = useToast();

  const [exams, setExams] = useState<OwnExam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Kegagalan muat tidak boleh tampil sebagai "belum ada paket": kalimat itu
  // klaim tentang keadaan, sedangkan array kosong dari respons 500 tidak
  // mengatakan apa pun tentangnya.
  const [hasError, setHasError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Tanpa `setIsLoading(true)` di awal: `isLoading` sudah `true` saat komponen
  // pertama dirender, dan `load()` hanya dipanggil sekali saat mount (komponen
  // ini di-*remount* lewat `key` setiap kali sebuah paket selesai dibuat). Satu
  // `setState` sinkron sebelum `await` cukup untuk memicu
  // `react-hooks/set-state-in-effect` pada efek di bawah — dan di sini memang
  // tidak ada gunanya.
  async function load() {
    try {
      const res = await fetch("/api/exams/list?mine=1");
      if (!res.ok) {
        setHasError(true);
        return;
      }
      const { data } = await res.json();
      setExams(data);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // `load()` tidak menyentuh state sebelum `await fetch` (lihat komentarnya),
    // jadi ini bukan setState sinkron di badan efek. Aturan
    // `set-state-in-effect` menelusuri badan fungsi yang dipanggil efek dan tidak
    // bisa membedakan keduanya, sehingga pengecualian ini ditulis eksplisit
    // daripada memindahkan `load` ke atas efek demi urutan pembacaan compiler.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const handleDelete = async (exam: OwnExam) => {
    if (
      !confirm(
        `Hapus permanen paket "${exam.title}"? Paket ini tidak bisa dikembalikan, ` +
          `dan bila sedang menunggu peninjauan, pengajuannya ikut dibatalkan.`,
      )
    ) {
      return;
    }

    setDeletingId(exam.id);
    try {
      const res = await fetch(`/api/exams/${exam.id}`, { method: "DELETE" });

      // `fetch` hanya menolak pada kegagalan jaringan: tanpa pemeriksaan ini,
      // 403/404 akan tampil sebagai "berhasil dihapus" dan barisnya hilang dari
      // layar padahal masih ada di server.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toastError("Gagal menghapus paket", data.error || "Terjadi kesalahan. Coba lagi.");
        return;
      }

      setExams((prev) => prev.filter((item) => item.id !== exam.id));
      success("Paket ujian dihapus", "Paket dan pengajuannya sudah dibatalkan.");
    } catch {
      toastError("Kesalahan jaringan", "Periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  const pendingCount = exams.filter((e) => e.status === "pending").length;
  const publishedCount = exams.filter((e) => e.status === "approved").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat paket ujianmu…
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
        <div className="text-xs text-red-700 dark:text-red-400">
          <p className="font-bold">Daftar paket ujian gagal dimuat.</p>
          <p className="mt-0.5">Paket yang sudah kamu kirim tetap aman. Muat ulang halaman untuk mencoba lagi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">Paket Ujianku</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {exams.length === 0
              ? "Belum ada paket ujian."
              : `${pendingCount} menunggu · ${publishedCount} tayang · ${exams.length} total`}
          </p>
        </div>
        <p className="text-[10px] text-zinc-400 font-semibold">
          Kuota: maks. {MAX_PENDING_EXAMS} menunggu · {MAX_PUBLISHED_EXAMS} tayang
        </p>
      </div>

      {exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <ClipboardList className="h-7 w-7 mx-auto text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">Belum ada paket ujian</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-relaxed">
            Paket yang kamu kirim lewat formulir di atas akan muncul di sini beserta status
            peninjauannya.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {exams.map((exam) => {
            const style = STATUS_STYLE[exam.status];
            const StatusIcon = style.icon;
            return (
              <li
                key={exam.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${style.className}`}>
                      <StatusIcon className="h-3 w-3" /> {style.label}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400">{exam.subject}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-bold text-zinc-900 dark:text-white leading-snug break-words">
                    {exam.title}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {exam.questionCount} soal
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {exam.durationMinutes} menit
                    </span>
                    <span>{exam.category}</span>
                  </p>
                  {exam.status === "pending" && (
                    <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed">
                      Belum tayang. Paket ini tidak bisa dikerjakan siapa pun sampai moderator menyetujuinya.
                    </p>
                  )}
                  {exam.status === "rejected" && (
                    <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed">
                      Alasan penolakan dikirim ke surelmu. Perbaiki lalu kirim ulang sebagai paket baru —
                      paket yang ditolak tidak bisa disunting.
                    </p>
                  )}
                  {exam.status === "approved" && (
                    <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed">
                      Sudah tayang. Kamu sendiri tidak bisa mengerjakannya, karena kamu memegang kuncinya.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(exam)}
                  disabled={deletingId === exam.id}
                  aria-label={`Hapus paket ujian ${exam.title}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {deletingId === exam.id ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menghapus…</>
                  ) : (
                    <><Trash2 className="h-3.5 w-3.5" /> Hapus</>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {publishedCount >= MAX_PUBLISHED_EXAMS && (
        <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Kamu sudah mencapai batas {MAX_PUBLISHED_EXAMS} paket tayang. Hapus salah satu untuk membuat yang baru.
        </p>
      )}
      {pendingCount >= MAX_PENDING_EXAMS && (
        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Kamu punya {MAX_PENDING_EXAMS} paket yang menunggu peninjauan. Tunggu salah satunya diputuskan
          sebelum mengirim lagi.
        </p>
      )}
    </div>
  );
}
