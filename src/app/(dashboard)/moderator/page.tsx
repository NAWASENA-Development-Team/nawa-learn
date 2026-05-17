// app/(dashboard)/moderator/page.tsx
"use client";

import { useState, useEffect } from "react";

// Tipe data yang diharapkan dari API /api/submissions/pending
type PendingSubmission = {
  submissionId: string;
  submittedAt: string;
  moduleId: string;
  moduleTitle: string;
  moduleUrl: string;
  submitterId: string;
  submitterName: string;
};

export default function ModeratorDashboard() {
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Mengambil data antrean saat komponen dimuat
  useEffect(() => {
    fetchPendingSubmissions();
  }, []);

  const fetchPendingSubmissions = async () => {
    try {
      const res = await fetch("/api/submissions/pending");
      if (res.ok) {
        const { data } = await res.json();
        setSubmissions(data);
      } else {
        console.error("Gagal mengambil data antrean");
      }
    } catch (error) {
      console.error("Terjadi kesalahan:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk memproses persetujuan modul
  const handleApprove = async (sub: PendingSubmission) => {
    setProcessingId(sub.submissionId);
    try {
      const res = await fetch("/api/modules/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: sub.submissionId,
          moduleId: sub.moduleId,
          submitterId: sub.submitterId,
          feedback: "Modul disetujui. Terima kasih atas kontribusinya untuk SMAN 2 Jonggol!",
        }),
      });

      if (res.ok) {
        alert("Modul berhasil disetujui! Poin telah ditambahkan ke profil kontributor.");
        // Hapus modul yang sudah disetujui dari daftar UI
        setSubmissions((prev) => prev.filter((s) => s.submissionId !== sub.submissionId));
      } else {
        alert("Akses ditolak atau terjadi kegagalan sistem.");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-zinc-500 font-medium animate-pulse">Memuat antrean moderasi...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 mt-8">
      <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Ruang Moderator</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Tinjau draf modul yang dikirim oleh siswa sebelum diterbitkan ke perpustakaan publik NAWA-LEARN.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">Antrean Bersih</h3>
          <p className="text-zinc-500 mt-2">Belum ada modul baru yang menunggu persetujuan saat ini.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {submissions.map((sub) => (
            <div 
              key={sub.submissionId} 
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-800 gap-6"
            >
              <div className="space-y-2 flex-1">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                  {sub.moduleTitle}
                </h3>
                <div className="text-sm text-zinc-500 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                    Oleh: {sub.submitterName}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(sub.submittedAt).toLocaleDateString('id-ID', { 
                      year: 'numeric', month: 'long', day: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="pt-2">
                  <a 
                    href={sub.moduleUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Buka Dokumen Modul ↗
                  </a>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 pt-4 md:pt-0">
                <button 
                  onClick={() => handleApprove(sub)}
                  disabled={processingId === sub.submissionId}
                  className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-md hover:bg-indigo-500 disabled:opacity-50 font-medium transition-colors shadow-sm"
                >
                  {processingId === sub.submissionId ? "Memproses..." : "Setujui Modul"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}