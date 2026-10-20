// components/submit/ModuleSubmitForm.tsx
// ─── Formulir kontribusi modul pembelajaran ──────────────────────────────────
//
// Memegang `useForm` (judul, kelas, kategori, mata pelajaran, contentUrl) dan
// menanam `ModuleUploadTabs` untuk lampiran berkas. Komunikasi dengan tab
// satu arah: tab melaporkan `contentUrl` baru lewat `onContentUrlChange`;
// setelah submit berhasil, formulir ini menaikkan `uploadResetKey` sehingga
// seluruh tab dipasang ulang dengan state bersih — tidak ada API imperatif
// "bersihkan dirimu" yang bisa terlupakan saat alur bertambah.
"use client";

import { useState } from "react";
import {
  CheckCircle2, Sparkles, Loader2, AlertCircle, ArrowRight,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/Toast";
import { ModuleUploadTabs } from "./ModuleUploadTabs";
import { moduleSchema, SUBJECTS } from "./types";
import type { ModuleFormData } from "./types";

export function ModuleSubmitForm() {
  const { error: toastError } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [submittedModuleName, setSubmittedModuleName] = useState("");
  const [uploadResetKey, setUploadResetKey] = useState(0);

  const { register, handleSubmit, formState: { errors }, reset, setValue, trigger, control } = useForm<ModuleFormData>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      title: "",
      subject: "",
      grade: "Umum",
      category: "",
      contentUrl: "",
    }
  });

  // `watch(name)` is a plain function returned by `useForm`, and the React
  // Compiler refuses to compile a component that calls it ("Use of incompatible
  // library") — the whole form fell out of auto-memoisation. `useWatch` is the
  // subscription hook for the same value, and it is a real hook, so the compiler
  // keeps the component.
  const selectedSubject = useWatch({ control, name: "subject" });
  const selectedGrade = useWatch({ control, name: "grade" });
  const selectedCategory = useWatch({ control, name: "category" });
  const currentContentUrl = useWatch({ control, name: "contentUrl" });

  const handleSubjectSelect = (subj: string) => {
    setValue("subject", subj);
    trigger("subject");
  };

  const handleGradeSelect = (grd: string) => {
    setValue("grade", grd);
    trigger("grade");
  };

  const handleCategorySelect = (cat: string) => {
    setValue("category", cat);
    trigger("category");
  };

  const onSubmit = async (data: ModuleFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/modules/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSubmittedModuleName(data.title);
        setShowCelebration(true);
        reset();
        // Remount the upload tabs so every local state (berkas, snapshot,
        // berkas Drive) is cleared together with the form fields.
        setUploadResetKey((k) => k + 1);
      } else {
        let errorTitle = "Gagal Mengirim Modul";
        let errorMessage = "Terjadi kesalahan tidak diketahui.";

        try {
          const errData = await res.json();
          if (res.status === 401) {
            errorTitle = "Belum Login";
            errorMessage = "Silakan refresh halaman dan login kembali.";
          } else if (res.status === 404) {
            errorTitle = "Profil Tidak Ditemukan";
            errorMessage = "Silakan logout dan login kembali untuk menyinkronkan profil Anda.";
          } else if (res.status === 400) {
            errorTitle = "Data Tidak Valid";
            errorMessage = errData.error || "Periksa kembali isian formulir Anda.";
          } else if (res.status === 503) {
            errorTitle = "Database Tidak Tersedia";
            errorMessage = "Coba lagi dalam beberapa saat.";
          } else if (res.status === 500) {
            errorTitle = "Kesalahan Server";
            errorMessage = "Silakan coba lagi nanti.";
          } else {
            errorMessage = errData.error || errorMessage;
          }
        } catch (parseError) {
          console.error("Error parsing response:", parseError);
        }

        toastError(errorTitle, errorMessage);
      }
    } catch (error) {
      console.error("Network error:", error);
      toastError("Kesalahan Jaringan", "Pastikan Anda terhubung ke internet dan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Celebration success screen */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 transition-all duration-300">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-2xl text-center relative overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Ambient glows */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-6 relative">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
              <Sparkles className="h-5 w-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>

            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Kontribusi Terkirim!</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              Terima kasih pejuang NAWA-LEARN! Modul <span className="font-semibold text-indigo-600 dark:text-indigo-400">&quot;{submittedModuleName}&quot;</span> telah masuk dalam antrean moderasi.
            </p>

            <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-6 flex items-center justify-between text-left">
              <div>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">POTENSI HADIAH</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">+50 V-Point</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs px-2.5 py-1 rounded-md font-semibold border border-indigo-100 dark:border-indigo-950">
                Peringkat Siswa
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowCelebration(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/10 hover:shadow-lg hover:scale-[1.01]"
              >
                Kirim Modul Lain
              </button>
              <a
                href="/leaderboard"
                className="w-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold py-2.5 rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-1.5"
              >
                Lihat Peringkat <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      <form
        // `handleSubmit(onSubmit)` is evaluated *inside* the event
        // handler rather than during render. `onSubmit` resets the file
        // input by writing `fileInputRef.current`, so the React Compiler
        // (rightly) refuses to hand a ref-reading function to another
        // function during render — it cannot prove `handleSubmit` will
        // not call it immediately. Inside an event handler that
        // restriction does not apply.
        onSubmit={(event) => { void handleSubmit(onSubmit)(event); }}
        className="space-y-6 bg-white dark:bg-zinc-900 p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm"
      >
        {/* Step 1: Judul Modul */}
        <div>
          <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-200 mb-1.5">Judul Modul Pembelajaran</label>
          <input
            {...register("title")}
            className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400 dark:placeholder-zinc-650 shadow-inner"
            placeholder="e.g. Ringkasan Rumus Turunan Matematika Peminatan Kelas XI"
          />
          {errors.title && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.title.message}</p>}
        </div>

        {/* Step 2: Subject, Grade & Category Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Kelas Selector */}
          <div>
            <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-200 mb-1.5">Pilih Kelas</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["X", "XI", "XII", "Umum"].map((gradeOption) => (
                <button
                  key={gradeOption}
                  type="button"
                  onClick={() => handleGradeSelect(gradeOption)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
                    selectedGrade === gradeOption
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {gradeOption}
                </button>
              ))}
            </div>
            {errors.grade && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.grade.message}</p>}
          </div>

          {/* Kategori Selector */}
          <div>
            <label className="block text-sm font-bold text-zinc-855 dark:text-zinc-200 mb-1.5">Kategori Materi</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "UTBK", label: "Materi UTBK" },
                { value: "Olimpiade", label: "Olimpiade" },
                { value: "Reguler", label: "Reguler" }
              ].map((categoryOption) => (
                <button
                  key={categoryOption.value}
                  type="button"
                  onClick={() => handleCategorySelect(categoryOption.value)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all duration-200 ${
                    selectedCategory === categoryOption.value
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {categoryOption.label}
                </button>
              ))}
            </div>
            {errors.category && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.category.message}</p>}
          </div>
        </div>

        {/* Step 3: Mata Pelajaran Grid Selector */}
        <div>
          <label className="block text-sm font-bold text-zinc-850 dark:text-zinc-200 mb-2">Pilih Mata Pelajaran</label>

          <div className="flex flex-wrap gap-2 mb-3">
            {SUBJECTS.map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => handleSubjectSelect(subj)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                  selectedSubject === subj
                    ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold scale-[1.02]"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {subj}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={selectedSubject && !SUBJECTS.includes(selectedSubject) ? selectedSubject : ""}
              onChange={(e) => handleSubjectSelect(e.target.value)}
              className="w-full rounded-xl border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-955 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400 shadow-inner"
              placeholder="Atau masukkan mata pelajaran khusus (contoh: Sejarah Indonesia)"
            />
          </div>
          {errors.subject && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.subject.message}</p>}
        </div>

        {/* Step 4: Advance File Attachment Tabs */}
        <ModuleUploadTabs
          key={uploadResetKey}
          contentUrl={currentContentUrl ?? ""}
          onContentUrlChange={(url) => setValue("contentUrl", url)}
        />
        {errors.contentUrl && <p className="text-red-500 text-xs font-semibold mt-1.5 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {errors.contentUrl.message}</p>}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !currentContentUrl}
          className="w-full bg-indigo-600 text-white py-3.5 rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none font-bold transition-all duration-200 text-sm shadow-lg shadow-indigo-600/10 hover:shadow-xl hover:scale-[1.005] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
              Mengirim Modul Ke Moderasi...
            </>
          ) : (
            <>
              <Sparkles className="h-4.5 w-4.5 text-amber-300" />
              Kirim Modul & Dapatkan Poin
            </>
          )}
        </button>
      </form>
    </>
  );
}
