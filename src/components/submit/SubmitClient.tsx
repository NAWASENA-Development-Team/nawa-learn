// src/components/submit/SubmitClient.tsx
// Client-side upload form. Rendered by the /submit page for every signed-in
// user who is **not** holding a season seat — since M18 that includes students,
// because submitting work is how a student becomes a contributor.
//
// Dulu 1439 baris: formulir modul (react-hook-form), tab unggahan berkas,
// modal picker Google Drive, formulir soal, dan dua overlay perayaan dalam
// satu komponen. Sekarang file ini hanya memilih mode kontribusi dan
// menampilkan panduan; masing-masing formulir menjadi komponen mandiri.
//
// Yang tetap di sini: penghitung modul aktif (fetch `/api/modules/count` untuk
// kartu "Total Modul Aktif") dan header/kartu rentetan yang menjelaskan ketiga
// mode — semuanya dibagikan oleh mode modul, soal, dan paket ujian.
//
// Tab ketiga (M18) hanya dirender untuk pengguna yang **boleh** membuatnya, dan
// itu ditentukan server: `canCreateExam` berasal dari `users.role` di
// `submit/page.tsx`, bukan dari hasil fetch di sini. Menampilkan tab yang
// pasti ditolak `403 contributor_required` bukan sekadar jelek — ia mengajarkan
// bahwa formulir panjang bisa berakhir di pintu yang terkunci.
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles, ShieldCheck, FileUp, FolderOpen, HelpCircle, BookOpen, Loader2, ArrowRight,
  ClipboardList,
} from "lucide-react";
import { ModuleSubmitForm } from "./ModuleSubmitForm";
import { QuestionSubmitForm } from "./QuestionSubmitForm";
import { ExamCreateForm } from "./ExamCreateForm";
import { MyExamPackages } from "./MyExamPackages";

type SubmitType = "module" | "question" | "exam";

interface SubmitClientProps {
  /** `true` untuk kontributor dan staf manusia; `false` untuk siswa. */
  canCreateExam: boolean;
}

export default function SubmitClient({ canCreateExam }: SubmitClientProps) {
  const [submitType, setSubmitType] = useState<SubmitType>("module");

  // Dinaikkan setiap kali sebuah paket ujian berhasil dikirim. Dipakai sebagai
  // `key` pada `MyExamPackages` supaya daftarnya **memuat ulang** tanpa perlu
  // `router.refresh()` — remount memicu fetch awalnya, dan formulir di atasnya
  // tidak ikut dirender ulang (isinya sudah diganti kartu "terkirim").
  const [examListKey, setExamListKey] = useState(0);

  // Real-time approved modules count from database
  const [totalActiveModules, setTotalActiveModules] = useState<number | null>(null);

  // Load active modules count from database
  useEffect(() => {
    const fetchActiveCount = async () => {
      try {
        const res = await fetch("/api/modules/count");
        if (res.ok) {
          const data = await res.json();
          setTotalActiveModules(data.count);
        }
      } catch (err) {
        console.error("Gagal memuat jumlah modul aktif:", err);
      }
    };
    fetchActiveCount();
  }, []);

  // Aturan yang ditampilkan mengikuti mode. Sebelum M18 daftarnya selalu aturan
  // modul, termasuk "pastikan tulisan foto jelas terbaca" — kalimat yang tidak
  // berarti apa-apa bagi orang yang sedang menulis soal pilihan ganda.
  const rules =
    submitType === "module"
      ? [
          { title: "Materi Asli & Relevan", desc: "Pastikan materi adalah catatan asli atau rangkuman pribadi yang sesuai dengan kurikulum SMA." },
          { title: "Format File Terbaca", desc: "Jika mengunggah foto catatan via kamera, pastikan tulisan jelas terbaca dan pencahayaan terang." },
          { title: "Kategori Yang Sesuai", desc: "Pilihlah mata pelajaran dan kategori (UTBK/Olimpiade/Reguler) agar mudah dicari siswa lain." },
          { title: "Hindari Plagiarisme", desc: "Dilarang menyebarkan hak cipta buku komersial tanpa izin penulis." },
        ]
      : submitType === "question"
        ? [
            { title: "Satu Soal, Satu Kunci", desc: "Setiap soal harus punya tepat satu jawaban benar dan lima opsi A–E yang masuk akal." },
            { title: "Bukan Soal Sendiri", desc: "Soal yang kamu ajukan tidak bisa kamu jawab sendiri di halaman latihan — itu jalan pintas poin." },
            { title: "Kategori Yang Sesuai", desc: "Pilih mata pelajaran dan tingkat kesulitan yang jujur; soal sulit berbayar lebih besar." },
            { title: "Bahasanya Jelas", desc: "Hindari pertanyaan menjebak yang bergantung pada salah ketik. Soal yang membingungkan akan ditolak." },
          ]
        : [
            { title: "Paket, Bukan Kumpulan Acak", desc: "Isi 1–5 soal dari materi yang sama; paket yang mencampur semua mata pelajaran sulit dinilai." },
            { title: "Kunci Harus Kamu Yakini", desc: "Peninjau akan memeriksa setiap kunci. Satu kunci yang salah menyesatkan semua siswa yang mengerjakan." },
            { title: "Kamu Tidak Bisa Mengerjakannya", desc: "Paketmu sendiri tidak bisa kamu kerjakan — kamu sudah memegang kuncinya." },
            { title: "Ditinjau Sebelum Tayang", desc: "Paket berstatus menunggu sampai moderator menyetujuinya. Statusnya bisa kamu pantau di daftar \"Paket Ujianku\" di bawah formulir." },
          ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Main Grid Header */}
      <div className="mb-8 text-center sm:text-left relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-6 sm:p-8 border border-indigo-100 dark:border-zinc-800/80 rounded-3xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="max-w-3xl relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            {submitType === "module"
              ? "Kontribusi Modul Pembelajaran"
              : submitType === "question"
                ? "Kontribusi Kuis Latihan CBT"
                : "Kontribusi Paket Ujian"}
          </h2>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {submitType === "module"
              ? "Unggah materi pembelajaran terbaikmu—baik itu ringkasan rumus matematika, rangkuman sosiologi, latihan soal olimpiade, atau catatan lainnya. Bantu teman-teman SMAN 2 Jonggol belajar lebih cepat dan kumpulkan V-Points-mu!"
              : submitType === "question"
                ? "Buat soal latihan buatanmu sendiri! Pertanyaan kuis yang Anda ajukan akan masuk antrean moderasi pengurus OSIS. Setelah disetujui, soal akan diterbitkan secara instan di halaman latihan."
                : "Susun beberapa soal menjadi satu paket ujian bertimer. Paket ujian ditinjau lebih dulu oleh moderator sebelum bisa dikerjakan siswa lain, karena satu kunci yang salah akan menyesatkan semua orang yang mengerjakannya."}
          </p>
        </div>

        {/* Badges container */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-6">
          {[
            {
              title:
                submitType === "module"
                  ? "Dapatkan +50 V-Points"
                  : submitType === "question"
                    ? "Dapatkan +5 s.d. +15 V-Points"
                    : "Dapatkan +20 V-Points",
              desc: "Poin setiap kontribusi yang disetujui",
              icon: Sparkles,
              color: "text-nawa-warning bg-amber-50 dark:bg-amber-950/20",
            },
            {
              title: "Moderasi < 24 Jam",
              desc: "Tim OSIS meninjau dengan sangat cepat",
              icon: ShieldCheck,
              color: "text-nawa-success bg-emerald-50 dark:bg-emerald-950/20",
            },
            {
              title:
                submitType === "module"
                  ? "Metode Unggah Cerdas"
                  : submitType === "question"
                    ? "Tinjau Kunci Jawaban"
                    : "Ditinjau Sebelum Tayang",
              desc:
                submitType === "module"
                  ? "Lokal file, Drive link, atau foto"
                  : submitType === "question"
                    ? "Opsi ganda A-E terstruktur"
                    : "Kunci diperiksa sebelum siswa mengerjakan",
              icon: FileUp,
              color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20",
            },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{item.title}</p>
                <p className="text-xs text-zinc-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab selection for Submit Mode */}
      <div className="flex justify-center sm:justify-start gap-3 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <button
          type="button"
          onClick={() => setSubmitType("module")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
            submitType === "module"
              ? "bg-nawa-primary border-nawa-primary text-white shadow-md shadow-nawa-primary/10 scale-[1.02]"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50"
          }`}
        >
          <FolderOpen className="h-4 w-4" /> Kontribusi Modul Catatan
        </button>
        <button
          type="button"
          onClick={() => setSubmitType("question")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
            submitType === "question"
              ? "bg-nawa-primary border-nawa-primary text-white shadow-md shadow-nawa-primary/10 scale-[1.02]"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50"
          }`}
        >
          <HelpCircle className="h-4 w-4" /> Buat Soal Latihan CBT
        </button>
        {canCreateExam && (
          <button
            type="button"
            onClick={() => setSubmitType("exam")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
              submitType === "exam"
                ? "bg-nawa-primary border-nawa-primary text-white shadow-md shadow-nawa-primary/10 scale-[1.02]"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <ClipboardList className="h-4 w-4" /> Buat Paket Ujian
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left side: Guide & Guidelines (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <h4 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-indigo-500" /> Aturan Berkontribusi
            </h4>

            <ul className="space-y-4">
              {rules.map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-nawa-primary dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{step.title}</h5>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950 text-nawa-primary dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Total Modul Aktif</p>
                <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  {totalActiveModules !== null ? (
                    `${totalActiveModules} Modul Belajar`
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-zinc-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat...
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
            <h4 className="font-bold mb-2 flex items-center gap-1.5 text-indigo-200">
              <Sparkles className="h-4.5 w-4.5 text-amber-400" /> Liga Kontributor
            </h4>
            <p className="text-xs text-indigo-200 leading-relaxed mb-4">
              Jadilah siswa paling berpengaruh di SMAN 2 Jonggol! Modulmu akan di-download oleh teman satu angkatan. Poinmu akan diakumulasikan ke papan peringkat utama sekolah.
            </p>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1 bg-white hover:bg-zinc-100 text-indigo-900 text-xs px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
            >
              Cek Papan Peringkat <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Jalan evolusi. Sebelum M18 tidak ada satu pun tempat di UI yang
              menjelaskan bagaimana seorang siswa menjadi kontributor, dan
              jawabannya ternyata "satu jawaban kuis benar" — karena keempat
              pintu promosi lama tidak punya ambang. Sekarang syaratnya nyata,
              jadi syaratnya juga harus tertulis. */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h4 className="font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" /> Jalan Menjadi Kontributor
            </h4>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
              Kontributor bukan pangkat yang diberikan karena rajin masuk. Syaratnya
              dua, dan keduanya harus terpenuhi:
            </p>
            <ol className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <li className="flex gap-2">
                <span className="font-bold text-nawa-primary">1.</span>
                <span>Punya <span className="font-bold text-zinc-800 dark:text-zinc-200">minimal satu karya yang disetujui</span> — modul atau soal.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-nawa-primary">2.</span>
                <span>Total <span className="font-bold text-zinc-800 dark:text-zinc-200">100 V-Points</span> atau lebih.</span>
              </li>
            </ol>
            <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-500 leading-relaxed">
              Setelah itu kamu bisa membuat paket ujian sendiri. Peran tidak pernah
              turun, dan poin tidak berkurang saat musim berganti.
            </p>
          </div>
        </div>

        {/* Right side: Interactive Form (lg:col-span-8) */}
        <div className="lg:col-span-8">
          {submitType === "module" ? (
            <ModuleSubmitForm />
          ) : submitType === "question" ? (
            <QuestionSubmitForm />
          ) : (
            <>
              <ExamCreateForm onCreated={() => setExamListKey((k) => k + 1)} />
              <MyExamPackages key={examListKey} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
