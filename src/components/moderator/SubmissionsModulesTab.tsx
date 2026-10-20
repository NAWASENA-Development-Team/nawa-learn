// components/moderator/SubmissionsModulesTab.tsx
// ─── Tab 1: antrean draf modul ────────────────────────────────────────────────
//
// Murni presentasi: antrean dan status pemrosesan dimuat shell (label tab
// di header memerlukan jumlahnya — kalau tab memuat sendirinya, jumlah akan
// tetap 0 sampai tab dibuka). Pengunduhan berkas `data:` legacy tetap di sini
// karena itu urusan tampilan, bukan status.
"use client";

import {
  Clock, User, CheckCircle2,
} from "lucide-react";
import type { PendingSubmission } from "./types";

interface SubmissionsModulesTabProps {
  submissions: PendingSubmission[];
  isLoadingModules: boolean;
  processingModuleId: string | null;
  onApproveModule: (sub: PendingSubmission) => void;
}

export function SubmissionsModulesTab({
  submissions, isLoadingModules, processingModuleId, onApproveModule,
}: SubmissionsModulesTabProps) {
  return (
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
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between shadow-sm transition-all hover:border-indigo-300 gap-3 sm:gap-6"
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
                  <button
                    onClick={() => {
                      const url = sub.moduleUrl;
                      if (url.startsWith("data:")) {
                        // Trigger download for legacy base64 rows. Object-storage
                        // URLs (the only kind written since M8) take the `else`
                        // branch and open in a new tab.
                        const ext = url.startsWith("data:image/png") ? ".png"
                                  : url.startsWith("data:image/jpeg") ? ".jpg"
                                  : url.startsWith("data:application/pdf") ? ".pdf"
                                  : url.includes("wordprocessingml") ? ".docx"
                                  : url.includes("presentationml") ? ".pptx"
                                  : ".dat";
                        try {
                          const parts = url.split(",");
                          const byteString = atob(parts[1]);
                          const ab = new ArrayBuffer(byteString.length);
                          const ia = new Uint8Array(ab);
                          for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                          }
                          const mime = parts[0].split(":")[1].split(";")[0];
                          const blob = new Blob([ab], { type: mime });
                          const blobUrl = URL.createObjectURL(blob);

                          const link = document.createElement("a");
                          link.href = blobUrl;
                          link.download = `modul-${sub.moduleTitle}${ext}`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);

                          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                        } catch (err) {
                          console.error("Failed to download data URI in moderator", err);
                        }
                      } else {
                        window.open(url, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="inline-flex items-center text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    Buka Dokumen Modul ↗
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-4 sm:pt-0">
                <button
                  onClick={() => onApproveModule(sub)}
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
  );
}
