// components/practice/QuizPreparationScreen.tsx
// ─── Layar 2: ringkasan ujian sebelum mulai ───────────────────────────────────
//
// Murni presentasi: menampilkan metadata ujian, peringatan penalti, panduan,
// dan tombol mulai/kembali. Keputusan "boleh mulai atau tidak" (anti-cheat:
// semua soal dibuat oleh pengguna ini) sudah diambil halaman dan datang
// lewat `blockedByAntiCheat` — layar ini hanya menampilkan hasilnya.
"use client";

import {
  FileText, Clock, GraduationCap, User, AlertTriangle, Check, ArrowLeft, Sparkles,
} from "lucide-react";
import type { Quiz } from "./types";

interface QuizPreparationScreenProps {
  quiz: Quiz;
  blockedByAntiCheat: boolean;
  onBack: () => void;
  onStart: () => void;
}

export function QuizPreparationScreen({
  quiz, blockedByAntiCheat, onBack, onStart,
}: QuizPreparationScreenProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden text-left relative animate-in fade-in duration-300">

        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-850 p-6 sm:p-10 text-white relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md text-white text-[10px] px-3 py-1 rounded-full font-bold mb-3 border border-white/10 uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> RUANGGURU QUIZ FORMAT
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            {quiz.title}
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100/90 mt-2.5 max-w-xl leading-relaxed">
            {quiz.id === "quiz_contributed"
              ? "Simulasi ujian khusus berisi soal latihan CBT hasil kontribusi mandiri dari rekan-rekan siswa SMAN 2 Jonggol yang disetujui moderator."
              : quiz.isCustom
                ? `Ujian buatan siswa · ${quiz.questionsCount} soal · Durasi ${quiz.durationMinutes} menit.`
                : "Uji kesiapan akademismu menjelang ujian seleksi masuk universitas negeri (UTBK-SNBT) dan Olimpiade Sains dengan simulasi CBT interaktif."}
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Informasi Detail Ujian</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/40 shrink-0">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">Jumlah Soal</p>
                  <p className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200">{quiz.questionsCount} Butir Soal</p>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100/40 shrink-0">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">Durasi Waktu</p>
                  <p className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200">{quiz.durationMinutes} Menit</p>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center border shrink-0 ${
                  quiz.difficulty.toLowerCase() === "sangat sulit"
                    ? "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100/40"
                    : "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100/40"
                }`}>
                  <GraduationCap className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-450 dark:text-zinc-500 font-bold uppercase">Tingkat Kesulitan</p>
                  <p className={`text-xs font-extrabold ${
                    quiz.difficulty.toLowerCase() === "sangat sulit"
                      ? "text-purple-700 dark:text-purple-400"
                      : "text-zinc-850 dark:text-zinc-200"
                  }`}>{quiz.difficulty}</p>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/40 shrink-0">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[9px] text-zinc-455 dark:text-zinc-500 font-bold uppercase">{quiz.id === "quiz_contributed" || quiz.isCustom ? "Pembuat Soal" : "Peserta Ujian"}</p>
                  <p className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200 truncate max-w-[120px]">
                    {quiz.id === "quiz_contributed" ? "Kolaborasi Siswa" : quiz.isCustom ? (quiz.author ?? "Siswa SMAN 2") : "Ahmad Kontributor"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Penalty warning */}
          <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <span className="font-extrabold text-red-600 dark:text-red-400">Sistem Penalti Aktif: </span>
              Setiap jawaban salah akan <span className="font-bold">mengurangi 10% total V-Point</span> kamu saat ini.
              Jawab dengan cermat!
            </div>
          </div>

          {/* Instructions */}
          <div className="p-5 bg-indigo-50/20 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900/30 rounded-2xl">
            <h5 className="text-xs font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              📝 Panduan Pengerjaan Soal:
            </h5>
            <ul className="space-y-3 text-[11px] text-zinc-655 dark:text-zinc-400 leading-relaxed">
              <li className="flex gap-2.5 items-start">
                <div className="h-4.5 w-4.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <span>Pastikan Anda berada di tempat yang tenang dengan koneksi internet stabil.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <div className="h-4.5 w-4.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <span>Waktu ujian akan <b>berjalan mundur secara otomatis</b> dan tidak dapat dijeda.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <div className="h-4.5 w-4.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <span>Gunakan sidebar navigasi soal di kanan untuk melompat bebas ke nomor soal manapun.</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <div className="h-4.5 w-4.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <span>Skor akhir dan umpan balik kelulusan akademik langsung disajikan setelah submit.</span>
              </li>
            </ul>
          </div>

          <div className="border-t border-zinc-150 dark:border-zinc-800/80 pt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onBack}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-250 dark:border-zinc-800 hover:bg-zinc-55 dark:hover:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-bold py-3.5 px-6 text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" /> Menu Kuis
            </button>
            {blockedByAntiCheat ? (
              <div className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold py-3.5 px-6 text-xs sm:text-sm cursor-not-allowed">
                ⚠️ Semua soal ini Anda buat — tidak bisa mengikuti kuis sendiri
              </div>
            ) : (
              <button
                onClick={onStart}
                className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-6 text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/10 hover:shadow-lg hover:shadow-indigo-600/20 active:scale-[0.98] cursor-pointer border border-indigo-700"
              >
                Mulai Ujian Sekarang 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
