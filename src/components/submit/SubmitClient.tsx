// src/components/submit/SubmitClient.tsx
// Client-side upload form. Rendered by the /submit page after it has verified
// that the signed-in user may upload (role !== "student").
//
// Dulu 1439 baris: formulir modul (react-hook-form), tab unggahan berkas,
// modal picker Google Drive, formulir soal, dan dua overlay perayaan dalam
// satu komponen. Sekarang file ini hanya memilih mode kontribusi dan
// menampilkan panduan; masing-masing formulir menjadi komponen mandiri.
//
// Yang tetap di sini: penghitung modul aktif (fetch `/api/modules/count` untuk
// kartu "Total Modul Aktif") dan header/kartu rentetan yang menjelaskan
// kedua mode — keduanya dibagikan oleh mode modul dan mode soal.
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles, ShieldCheck, FileUp, FolderOpen, HelpCircle, BookOpen, Loader2, ArrowRight,
} from "lucide-react";
import { ModuleSubmitForm } from "./ModuleSubmitForm";
import { QuestionSubmitForm } from "./QuestionSubmitForm";

type SubmitType = "module" | "question";

export default function SubmitClient() {
  const [submitType, setSubmitType] = useState<SubmitType>("module");

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Main Grid Header */}
      <div className="mb-8 text-center sm:text-left relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent p-6 sm:p-8 border border-indigo-100 dark:border-zinc-800/80 rounded-3xl">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="max-w-3xl relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            {submitType === "module" ? "Kontribusi Modul Pembelajaran" : "Kontribusi Kuis Latihan CBT"}
          </h2>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {submitType === "module"
              ? "Unggah materi pembelajaran terbaikmu—baik itu ringkasan rumus matematika, rangkuman sosiologi, latihan soal olimpiade, atau catatan lainnya. Bantu teman-teman SMAN 2 Jonggol belajar lebih cepat dan kumpulkan poin XP-mu!"
              : "Buat soal latihan buatanmu sendiri! Pertanyaan kuis yang Anda ajukan akan masuk antrean moderasi pengurus OSIS. Setelah disetujui, soal akan diterbitkan secara instan di halaman latihan."}
          </p>
        </div>

        {/* Badges container */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-6">
          {[
            { title: submitType === "module" ? "Dapatkan +15 Poin" : "Dapatkan +10 Poin", desc: "Poin setiap kontribusi yang disetujui", icon: Sparkles, color: "text-amber-500 bg-amber-50 dark:bg-amber-950/20" },
            { title: "Moderasi < 24 Jam", desc: "Tim OSIS meninjau dengan sangat cepat", icon: ShieldCheck, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" },
            { title: submitType === "module" ? "Metode Unggah Cerdas" : "Tinjau Kunci Jawaban", desc: submitType === "module" ? "Lokal file, Drive link, atau foto" : "Opsi ganda A-E terstruktur", icon: FileUp, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20" }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{item.title}</p>
                <p className="text-xs text-zinc-550">{item.desc}</p>
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
              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
              : "bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-50"
          }`}
        >
          <FolderOpen className="h-4 w-4" /> Kontribusi Modul Catatan
        </button>
        <button
          type="button"
          onClick={() => setSubmitType("question")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
            submitType === "question"
              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
              : "bg-white dark:bg-zinc-900 border-zinc-250 dark:border-zinc-800 text-zinc-655 dark:text-zinc-350 hover:bg-zinc-50"
          }`}
        >
          <HelpCircle className="h-4 w-4" /> Buat Soal Latihan CBT
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left side: Guide & Guidelines (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <h4 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-indigo-500" /> Aturan Berkontribusi
            </h4>

            <ul className="space-y-4">
              {[
                { title: "Materi Asli & Relevan", desc: "Pastikan materi adalah catatan asli atau rangkuman pribadi yang sesuai dengan kurikulum SMA." },
                { title: "Format File Terbaca", desc: "Jika mengunggah foto catatan via kamera, pastikan tulisan jelas terbaca dan pencahayaan terang." },
                { title: "Kategori Yang Sesuai", desc: "Pilihlah mata pelajaran dan kategori (UTBK/Olimpiade/Reguler) agar mudah dicari siswa lain." },
                { title: "Hindari Plagiarisme", desc: "Dilarang menyebarkan hak cipta buku komersial tanpa izin penulis." }
              ].map((step, idx) => (
                <li key={idx} className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{step.title}</h5>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-6 border-t border-zinc-150 dark:border-zinc-800 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Total Modul Aktif</p>
                <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                  {totalActiveModules !== null ? (
                    `${totalActiveModules} Modul Belajar`
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-zinc-450 dark:text-zinc-550">
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
        </div>

        {/* Right side: Interactive Form (lg:col-span-8) */}
        <div className="lg:col-span-8">
          {submitType === "module" ? <ModuleSubmitForm /> : <QuestionSubmitForm />}
        </div>
      </div>
    </div>
  );
}
