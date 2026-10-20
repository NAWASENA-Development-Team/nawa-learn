// components/profile/ProfileModals.tsx
// ─── Lima modal dari halaman profil ───────────────────────────────────────────
//
// Lima modal (sunting bio, picker avatar, status, lapor isu, sertifikat)
// dikelompokkan dalam satu file karena masing-masing adalah potongan UI yang
// muncul di atas halaman — tetapi penting bahwa mereka **tidak** lagi hidup
// di dalam `ProfileClient`. Sekelompok modal yang masing-masing menguasai
// state sendiri (draft bio, kategori laporan, nombre PDF) tidak boleh
// berbagi satu lingkup state dengan logika halaman: satu `useState` yang
// tak terbaca di keduanya sudah cukup untuk membuat|berubah tanpa terdeteksi.
//
// Setiap modal mandiri — induk hanya mengirim props `open` dan callback
// menutup. Tidak ada state yang menyusup ke atas.
"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Bell, XCircle, Flag, AlertCircle, Download,
} from "lucide-react";
import { AVATAR_OPTIONS, AvatarOption } from "@/lib/avatars";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { PLAYFUL_BIOS, calcLevel } from "./types";
import type { UserProfile, ProfileStatusItem } from "./types";

// ─── 1. Sunting Bio & Motto ─────────────────────────────────────────────────────
interface EditProfileModalProps {
  bio: string;
  motto: string;
  onClose: () => void;
}

export function EditProfileModal({ bio, motto, onClose }: EditProfileModalProps) {
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const [editBio, setEditBio] = useState(bio);
  const [editMotto, setEditMotto] = useState(motto);

  // Save profile edits
  //
  // Nama tidak ikut disimpan: `/api/profile/update` tidak menerima kolom `name`
  // sama sekali (nama datang dari akun Clerk lewat webhook). Dulu ada state
  // `editName` yang dibandingkan di sini dan disetel di tombol Edit, tetapi tidak
  // pernah dirender dan tidak pernah dikirim — perbandingan yang selalu bernilai
  // `false` dan field yang tidak pernah sampai ke server.
  const handleSaveProfile = async () => {
    const isBioChanged = editBio !== bio;
    const isMottoChanged = editMotto !== motto;

    if (!isBioChanged && !isMottoChanged) {
      onClose();
      return;
    }

    onClose();

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: editBio, motto: editMotto }),
      });

      if (!res.ok) {
        toastError("Gagal", "Gagal menyimpan perubahan profil ke server.");
        return;
      }

      toastSuccess("Tersimpan!", "Profil berhasil diperbarui.");
      router.refresh();
    } catch (err) {
      console.error("Profile save to DB failed:", err);
      toastError("Gagal", "Terjadi kesalahan jaringan.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-4">
          Sunting Bio &amp; Motto Belajar
        </h3>

        <div className="space-y-4">
          {/* Motto Belajar input */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase">Motto Belajar</label>
            <input
              type="text"
              value={editMotto}
              onChange={(e) => setEditMotto(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder-zinc-400"
              maxLength={100}
              placeholder="Contoh: Belajar hari ini, memimpin esok hari!"
            />
          </div>

          {/* Bio description */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-zinc-400 uppercase">Bio Singkat</label>
              <button
                type="button"
                onClick={() => setEditBio(PLAYFUL_BIOS[Math.floor(Math.random() * PLAYFUL_BIOS.length)])}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                Acak Bio
              </button>
            </div>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              className="w-full h-24 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder-zinc-400 resize-none"
              maxLength={200}
              placeholder="Tulis bio singkat yang menceritakan gaya belajarmu..."
            />
            <p className="text-[10px] text-zinc-400 text-right mt-1 font-mono">
              {editBio.length} / 200 karakter
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-850 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-350 font-bold py-2.5 px-4.5 rounded-xl text-xs transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveProfile}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-md cursor-pointer border border-indigo-700"
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 2. Pilih Avatar ─────────────────────────────────────────────────────────────
interface AvatarPickerModalProps {
  selectedAvatar: AvatarOption;
  onSelect: (avatar: AvatarOption) => void;
  onClose: () => void;
}

export function AvatarPickerModal({ selectedAvatar, onSelect, onClose }: AvatarPickerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 text-center">
        <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-2">
          Pilih Lencana Avatar Kamu
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
          Lencana avatar lucu mencerminkan semangat belajarmu di SMAN 2 Jonggol!
        </p>

        <div className="grid grid-cols-4 gap-4 mb-6 max-h-96 overflow-y-auto">
          {AVATAR_OPTIONS.map((av, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(av)}
              className={`group aspect-square rounded-2xl bg-gradient-to-br ${av.bg} flex flex-col items-center justify-center shadow-md border-2 transition-all hover:scale-110 active:scale-95 cursor-pointer overflow-hidden ${
                selectedAvatar.svg === av.svg
                  ? "border-indigo-600 scale-105 shadow-lg shadow-indigo-600/10"
                  : "border-transparent"
              }`}
              title={av.label}
            >
              <Image src={av.svg} alt={av.label} fill className="object-cover" />
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  );
}

// ─── 3. Cek Status / Notifikasi ──────────────────────────────────────────────────
interface StatusModalProps {
  items: ProfileStatusItem[];
  isLoading: boolean;
  onClose: () => void;
}

export function StatusModal({ items, isLoading, onClose }: StatusModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden relative">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Status &amp; Notifikasi</h3>
              <p className="text-xs text-zinc-400 font-medium">Lacak status kontribusi modul dan soal Anda</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <XCircle className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <div className="h-6 w-6 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <AlertCircle className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm font-medium">Belum ada riwayat kontribusi atau laporan.</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-zinc-800 bg-zinc-800/30 flex flex-col gap-2 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-800 px-2 py-0.5 rounded-md mb-1.5 inline-block">
                      {item.type === "module" ? "Modul" : item.type === "question" ? "Soal CBT" : "Laporan"}
                    </span>
                    <h4 className="text-sm font-bold text-zinc-200 leading-snug">{item.title}</h4>
                  </div>
                  <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border ${
                    item.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    item.status === "rejected" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                    "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}>
                    {item.status}
                  </span>
                </div>
                {item.feedback && (
                  <div className="mt-2 text-xs text-zinc-400 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 border-l-2 border-l-indigo-500">
                    <strong className="text-indigo-400">Catatan Moderator:</strong> {item.feedback}
                  </div>
                )}
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  {new Date(item.submittedAt).toLocaleDateString("id-ID", {
                    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 4. Lapor Isu ─────────────────────────────────────────────────────────────────
export function ReportModal({ onClose }: { onClose: () => void }) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [reportType, setReportType] = useState("bug");
  const [reportDesc, setReportDesc] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const submitReport = async () => {
    if (!reportDesc.trim()) return toastError("Peringatan", "Deskripsi laporan tidak boleh kosong.");
    setIsSubmittingReport(true);
    try {
      const res = await fetch("/api/profile/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueType: reportType, description: reportDesc }),
      });
      if (res.ok) {
        toastSuccess("Berhasil", "Laporan berhasil dikirim.");
        onClose();
        setReportDesc("");
      } else {
        throw new Error("Gagal");
      }
    } catch {
      toastError("Gagal", "Laporan gagal dikirim.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex justify-between items-start mb-2">
            <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <Flag className="h-5 w-5" />
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          <h3 className="text-xl font-black text-white mt-3">Lapor Isu &amp; Kendala</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Temukan kesalahan kunci jawaban, typo di modul, atau bug sistem? Laporkan ke tim Nawasena di sini.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Kategori Isu</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-sm text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            >
              <option value="bug">Bug Sistem / Error</option>
              <option value="content">Kesalahan Konten (Modul/Soal)</option>
              <option value="other">Lainnya / Saran</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Deskripsi Lengkap</label>
            <textarea
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              rows={4}
              placeholder="Sebutkan detail masalah (misal: Soal Matematika Bab Limit, Opsi D salah, seharusnya -2...)"
              className="w-full bg-zinc-800 border border-zinc-700 text-sm text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
            />
          </div>

          <button
            onClick={submitReport}
            disabled={isSubmittingReport}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
          >
            {isSubmittingReport ? (
              <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Mengirim...</>
            ) : (
              <><Flag className="h-4 w-4" /> Kirim Laporan</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 5. Sertifikat Apresiasi ───────────────────────────────────────────────────────
export function CertificateModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadCertificate = async () => {
    try {
      setIsDownloading(true);
      const element = document.getElementById("certificate-container");
      if (!element) {
        setIsDownloading(false);
        return;
      }

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`Sertifikat-NawaLearn-${user.name}.pdf`);

      toastSuccess("Berhasil", "Sertifikat berhasil diunduh.");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toastError("Gagal", "Terjadi kesalahan saat mengunduh sertifikat.");
    } finally {
      setIsDownloading(false);
    }
  };

  const level = calcLevel(user.points);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300">
      <div id="certificate-container" className="max-w-3xl w-full bg-white text-zinc-900 border-8 border-amber-500/80 p-6 sm:p-10 rounded-2xl shadow-2xl relative flex flex-col items-center justify-between text-center select-none overflow-hidden my-8 animate-in zoom-in-95 duration-300">
        {/* Elegant Background watermarks / borders */}
        <div className="absolute top-0 right-0 w-32 h-32 border-r-4 border-t-4 border-amber-200 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-32 h-32 border-l-4 border-b-4 border-amber-200 rounded-bl-lg" />
        <div className="absolute inset-4 border border-zinc-200 rounded" />
        <div className="absolute inset-5 border border-dashed border-amber-300 rounded" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-amber-500/[0.03] rounded-full blur-3xl pointer-events-none" />

        {/* Logo and Header info */}
        <div className="relative z-10 flex flex-col items-center">
          <span className="text-5xl mb-3">🕊️</span>
          <p className="text-[10px] font-black tracking-[0.25em] text-indigo-700 uppercase">OSIS NAWASENA SMAN 2 JONGGOL</p>
          <h2 className="font-extrabold text-2xl sm:text-3xl tracking-tight text-zinc-850 mt-2 font-serif">
            SERTIFIKAT APRESIASI
          </h2>
          <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-amber-500 to-transparent my-3" />
          <p className="text-[11px] text-zinc-450 italic font-medium font-sans">
            Diberikan penghargaan setinggi-tingginya kepada kontributor berprestasi:
          </p>
        </div>

        {/* Contributor Name */}
        <div className="relative z-10 my-6">
          <h3 className="text-3xl sm:text-4xl font-black text-indigo-900 font-serif border-b border-indigo-100 pb-2 px-10 inline-block">
            {user.name}
          </h3>
          <p className="text-xs text-zinc-400 font-mono tracking-widest mt-2 uppercase">
            {/* Fragmennya diambil dari `id` internal — yang sudah menjadi
                bagian dari URL profil — bukan dari `clerkId`. Sebelum M12
                empat huruf terakhir identitas Clerk tercetak di halaman
                publik yang bisa dibuka siapa saja. */}
            ID KONTRIBUTOR: {user.id.slice(0, 8).toUpperCase()}-{user.id.slice(-4).toUpperCase()}
          </p>
        </div>

        {/* Achievement Text Description */}
        <div className="relative z-10 max-w-lg leading-relaxed text-xs sm:text-sm text-zinc-650 px-6 font-sans">
          Atas dedikasi luar biasa dalam membagikan modul, ringkasan belajar estetik, serta kontribusi aktif membuat latihan soal di platform belajar kolaboratif <b>NAWA-LEARN</b> SMAN 2 Jonggol. Dengan total pencapaian perolehan sebesar:

          <div className="my-4 flex items-center justify-center gap-6">
            <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-center shadow-sm">
              <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">V-Point</p>
              <p className="text-xl font-black text-amber-700 mt-0.5">{user.points} VP</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-xl text-center shadow-sm">
              <p className="text-[10px] text-indigo-800 font-bold uppercase tracking-wider">Level Scholar</p>
              <p className="text-xl font-black text-indigo-700 mt-0.5">LEVEL {level}</p>
            </div>
          </div>

          Karya Anda telah membantu memperluas wawasan belajar literasi digital teman-teman siswa SMAN 2 Jonggol.
        </div>

        {/* Signatures and Date */}
        <div className="relative z-10 w-full grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-zinc-100 max-w-xl text-xs">
          <div className="flex flex-col items-center">
            <p className="text-zinc-400 font-semibold uppercase text-[9px] tracking-wider">KABINET NAWASENA</p>
            <div className="h-12 flex items-center justify-center font-mono italic text-indigo-600/40 select-none text-base font-bold my-1">
              ~ Ketua OSIS Nawasena ~
            </div>
            <p className="font-extrabold text-zinc-800 border-t border-zinc-200 pt-1 w-44 text-sm">Cecillia Natasya Sonthani</p>
            <p className="text-[9px] text-zinc-450 mt-0.5">Ketua OSIS SMAN 2 Jonggol</p>
          </div>

          <div className="flex flex-col items-center">
            <p className="text-zinc-400 font-semibold uppercase text-[9px] tracking-wider">NAWASENA TEAM</p>
            <div className="h-12 flex items-center justify-center font-mono italic text-indigo-600/40 select-none text-base font-bold my-1">
              ~ Team Developer ~
            </div>
            <p className="font-extrabold text-zinc-800 border-t border-zinc-200 pt-1 w-44 text-sm">Maulana Ferdi Irawan</p>
            <p className="text-[9px] text-zinc-450 mt-0.5">Kepala Nawasena Team Developer</p>
          </div>
        </div>

        {/* Certificate Modal Action Buttons */}
        <div data-html2canvas-ignore="true" className="relative z-10 mt-10 pt-4 border-t border-zinc-150 w-full flex items-center justify-between max-w-xl text-xs gap-3">
          <button
            onClick={onClose}
            className="bg-zinc-200 hover:bg-zinc-250 text-zinc-700 font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
          >
            Kembali Ke Profil
          </button>

          <button
            onClick={handleDownloadCertificate}
            disabled={isDownloading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-indigo-700"
          >
            <Download className={`h-4 w-4 ${isDownloading ? "animate-bounce" : ""}`} />
            {isDownloading ? "Menyiapkan PDF..." : "Unduh Sertifikat"}
          </button>
        </div>

      </div>
    </div>
  );
}
