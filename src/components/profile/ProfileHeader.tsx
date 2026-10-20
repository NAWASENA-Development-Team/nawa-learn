// components/profile/ProfileHeader.tsx
// ─── Banner profil: avatar + bingkai, identitas, tombol aksi, papan level ──────
//
// Ini adalah bagian "hidup" dari halaman profil: semua handler penyimpanan
// (avatar, bio, foto) dan semua state yang terkait dengannya ada di sini.
// Panel-panel tab di bawahnya murni presentasional — mereka hanya menerima
// data. Memisah keduanya berarti mengubah tampilan tab tidak perlu membaca
// logika unggah foto, dan sebaliknya.
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Edit3, XCircle, Shield, UserCheck, Sparkles, BookOpen, Award, Camera,
  Share2, Bell, Flag, ShieldCheck, Calendar,
} from "lucide-react";
import { AvatarOption } from "@/lib/avatars";
import { ACCEPTED_AVATAR_TYPES, MAX_AVATAR_BYTES, uploadFile } from "@/lib/uploadClient";
import { getSpecialtyBadge } from "@/lib/badges";
import type { SpecialtyStats } from "@/lib/badges";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import {
  calcLevel, calcLevelThreshold, ADMIN_DEFAULT_BIO, STUDENT_DEFAULT_BIO,
  DEFAULT_MOTTO,
} from "./types";
import type { UserProfile } from "./types";

interface ProfileHeaderProps {
  user: UserProfile;
  /** Enam angka lencana spesialis, dihitung SQL di server (`getSpecialtyStats`). */
  specialtyStats: SpecialtyStats;
  badgeCount: { unlocked: number; total: number };
  /** Hanya pemilik yang melihat tombol edit/foto/lapor di profilnya sendiri. */
  isOwnProfile: boolean;
  /** Avatar yang saat ini dipilih (dikelola induk). */
  selectedAvatar: AvatarOption;
  /** Membuka picker avatar (modal di `ProfileModals`). */
  onSelectAvatar: () => void;
  /** Dipanggil ketika pengguna membuka modal sunting bio/motto. */
  onEditProfile: () => void;
  /** Membuka modal status/notifikasi. */
  onOpenStatus: () => void;
  /** Membuka modal lapor isu. */
  onOpenReport: () => void;
  /** Membuka modal sertifikat. */
  onOpenCertificate: () => void;
}

export function ProfileHeader({
  user, specialtyStats, badgeCount, isOwnProfile, selectedAvatar,
  onSelectAvatar, onEditProfile, onOpenStatus, onOpenReport, onOpenCertificate,
}: ProfileHeaderProps) {
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();

  // Leveling Calculations (linear scaling: L→L+1 costs L*50 XP)
  const level = calcLevel(user.points);
  const currentThreshold = calcLevelThreshold(level);
  const nextThreshold = calcLevelThreshold(level + 1);
  const pointsInCurrentLevel = user.points - currentThreshold;
  const pointsForThisLevel = nextThreshold - currentThreshold; // = level * 50
  const progressPercent = Math.min(100, Math.floor((pointsInCurrentLevel / pointsForThisLevel) * 100));
  const pointsNeededForNext = pointsForThisLevel - pointsInCurrentLevel;

  // Animated progress bar: starts at 0, animates to actual value after mount
  const [displayProgress, setDisplayProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDisplayProgress(progressPercent), 400);
    return () => clearTimeout(t);
  }, [progressPercent]);

  // Custom photo upload state (Top 10 perk)
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [customPhoto, setCustomPhoto] = useState<string | null>(user.photoUrl);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Clear the input so choosing the same file again still fires `change`.
    e.target.value = "";

    if (file.size > MAX_AVATAR_BYTES) {
      toastError("Foto Terlalu Besar", "Ukuran foto maksimal 2MB.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // The browser used to turn the file into a base64 data URL and hand that
      // to /api/profile/update, which stored it in Postgres. The bytes now go to
      // object storage and only the resulting URL is saved.
      const uploaded = await uploadFile(file, "avatar");
      if (!uploaded.ok || !uploaded.url) {
        toastError("Gagal Mengunggah", uploaded.error ?? "Coba lagi.");
        return;
      }

      setCustomPhoto(uploaded.url);

      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: uploaded.url }),
      });
      if (!res.ok) {
        toastError("Gagal Menyimpan", "Foto sudah terunggah, tetapi gagal disimpan ke profil.");
        return;
      }

      toastSuccess("Berhasil", "Foto profil berhasil diperbarui.");
      router.refresh();
    } catch (err) {
      console.error("Photo upload failed:", err);
      toastError("Gagal Menyimpan", "Terjadi kesalahan saat menyimpan foto profil.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };
  const handleRemovePhoto = async () => {
    setCustomPhoto(null);
    try {
      await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: null }),
      });
      router.refresh();
    } catch (err) {
      console.error("Photo remove failed:", err);
    }
  };

  // === REWARD SYSTEM HELPERS ===

  // Get avatar frame style based on rank
  const getAvatarFrame = (rank: number) => {
    if (rank <= 3) return {
      ring: "ring-4 ring-offset-2 ring-offset-indigo-950",
      ringColor: "ring-amber-400",
      glow: "shadow-[0_0_30px_rgba(251,191,36,0.6)]",
      label: "Top 3 Champion",
      animate: "animate-pulse",
    };
    if (rank <= 10) return {
      ring: "ring-4 ring-offset-2 ring-offset-indigo-950",
      ringColor: "ring-purple-400",
      glow: "shadow-[0_0_20px_rgba(192,132,252,0.5)]",
      label: "Top 10 Elite",
      animate: "",
    };
    if (rank <= 50) return {
      ring: "ring-2 ring-offset-1 ring-offset-indigo-950",
      ringColor: "ring-cyan-400",
      glow: "shadow-[0_0_15px_rgba(34,211,238,0.4)]",
      label: "Top 50 Rising",
      animate: "",
    };
    return null;
  };

  // Level frame styling based on user.levelFrame DB field
  const getLevelFrameStyle = (frame: string | null) => {
    if (!frame) return null;
    const map: Record<string, { gradient: string; label: string }> = {
      wood: { gradient: "from-amber-800 via-yellow-700 to-amber-600", label: "Frame Kayu" },
      bronze: { gradient: "from-amber-600 via-orange-500 to-amber-700", label: "Frame Perunggu" },
      silver: { gradient: "from-slate-400 via-zinc-300 to-slate-500", label: "Frame Silver" },
      gold: { gradient: "from-yellow-400 via-amber-300 to-yellow-600", label: "Frame Emas" },
    };
    return map[frame] ?? null;
  };
  const levelFrameStyle = getLevelFrameStyle(user.levelFrame);

  // Get specialty badge for Top 3 (based on contribution type)
  const userSpecialtyBadge = getSpecialtyBadge(specialtyStats, user.rank);

  // Get secret achievement for Top 100
  const getSecretAchievement = () => {
    if (user.rank > 100) return null;
    // Sumber yang sama dengan lencana spesialis di atas: SQL, bukan 20 baris
    // log terakhir. `quizTotal`/`hardQuizzes` di sini berarti soal yang dijawab.
    const { quizTotal, hardQuizzes, approvedMods, diverseSubjects, totalDownloads } = specialtyStats;

    if (hardQuizzes >= 5) return { name: "Bane of Easy Mode", desc: "Menaklukkan 5+ soal sulit", icon: "💀", color: "text-red-400", bg: "bg-red-950/30 border-red-900/50" };
    if (approvedMods >= 5) return { name: "Living Library", desc: "5+ modul disetujui", icon: "🏛️", color: "text-purple-400", bg: "bg-purple-950/30 border-purple-900/50" };
    if (totalDownloads >= 100) return { name: "Viral Scholar", desc: "Modul diunduh 100+ kali", icon: "🌊", color: "text-cyan-400", bg: "bg-cyan-950/30 border-cyan-900/50" };
    if (diverseSubjects >= 4) return { name: "Polymath Prodigy", desc: "Kontribusi di 4+ mata pelajaran", icon: "🔬", color: "text-green-400", bg: "bg-green-950/30 border-green-900/50" };
    if (quizTotal >= 10) return { name: "Eternal Student", desc: "Menjawab 10+ soal", icon: "🔄", color: "text-blue-400", bg: "bg-blue-950/30 border-blue-900/50" };
    if (user.rank <= 10) return { name: "The Chosen Few", desc: "Masuk dalam 10 besar", icon: "🌟", color: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/50" };
    if (user.rank <= 50) return { name: "Silent Powerhouse", desc: "Masuk dalam 50 besar", icon: "⚡", color: "text-indigo-400", bg: "bg-indigo-950/30 border-indigo-900/50" };
    return { name: "The Century Club", desc: "Masuk dalam 100 besar", icon: "🎖️", color: "text-zinc-300", bg: "bg-zinc-800/50 border-zinc-700/50" };
  };

  const avatarFrame = getAvatarFrame(user.rank);
  const specialtyBadge = userSpecialtyBadge;
  const secretAchievement = getSecretAchievement();

  // Title rank based on levels
  const getPlayfulRankTitle = (lvl: number, role: string) => {
    if (role === "admin") return "Grandmaster Administrator 👑";
    if (role === "moderator") return "Laskar Penjaga Ilmu 🛡️";
    if (lvl >= 10) return "Cendekiawan Agung 🔮";
    if (lvl >= 7) return "Ksatria Buku Senior 🧙‍♂️";
    if (lvl >= 4) return "Pakar Modul Sekolah 🧠";
    if (lvl >= 2) return "Prajurit Belajar Aktif ⚡";
    return "Pemula Berbakat 🌱";
  };

  const bio = user.bio ?? (user.role === "admin" ? ADMIN_DEFAULT_BIO : STUDENT_DEFAULT_BIO);
  const motto = user.motto ?? DEFAULT_MOTTO;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-950 to-zinc-950 text-white rounded-3xl border border-indigo-500/20 shadow-2xl p-6 sm:p-10 mb-8">
      {/* Glow circles backgrounds */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">

        {/* Playful Interactive Avatar Component */}
        <div className="relative shrink-0 group">
          {/* Level frame (from level rewards system) — shown when no rank frame */}
          {levelFrameStyle && !avatarFrame && (
            <div className={`absolute -inset-2 rounded-[30px] bg-gradient-to-br ${levelFrameStyle.gradient} opacity-90`} title={levelFrameStyle.label} />
          )}
          {/* Avatar frame ring for ranked players */}
          {avatarFrame && (
            <div className={`absolute -inset-1.5 rounded-[28px] bg-gradient-to-br ${
              user.rank <= 3 ? "from-amber-400 via-yellow-300 to-amber-500" :
              user.rank <= 10 ? "from-purple-400 via-fuchsia-400 to-purple-600" :
              "from-cyan-400 via-blue-400 to-cyan-600"
            } ${user.rank <= 3 ? "animate-[spin_4s_linear_infinite]" : ""} opacity-80`} />
          )}
          <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${selectedAvatar.bg} flex items-center justify-center shadow-lg border-4 border-white/10 relative transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3 overflow-hidden ${avatarFrame ? avatarFrame.glow : "shadow-indigo-500/20"}`}>
            {/* Custom photo takes priority over SVG avatar */}
            {customPhoto ? (
              <Image src={customPhoto} alt="Custom photo" fill className="object-cover" />
            ) : (
              <Image src={selectedAvatar.svg} alt={selectedAvatar.label} fill className="object-cover" />
            )}

            {isOwnProfile && !customPhoto && (
              <button
                onClick={onSelectAvatar}
                className="absolute -bottom-2 -right-2 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl border border-white/20 shadow-md transition-all scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 cursor-pointer"
                title="Ganti Lencana Avatar"
              >
                <Edit3 className="h-4.5 w-4.5" />
              </button>
            )}
            {/* Custom photo edit/remove button (Top 10 perk) */}
            {isOwnProfile && user.rank <= 10 && customPhoto && (
              <button
                onClick={handleRemovePhoto}
                className="absolute -bottom-2 -right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl border border-white/20 shadow-md transition-all scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 cursor-pointer"
                title="Hapus Foto"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>


          {/* Rank indicator badge */}
          {user.rank <= 3 && (
            <span className="absolute -top-3 -left-3 bg-amber-500 text-zinc-950 px-2.5 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase border border-amber-300 shadow-md">
              #{user.rank}
            </span>
          )}
        </div>

        {/* User Meta Information */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-start">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2 flex-wrap justify-center md:justify-start">
              {user.name}
              {user.role === "admin" && (
                <span className="bg-rose-500 text-white px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase border border-rose-400 flex items-center gap-1 shadow-sm">
                  <Shield className="h-3.5 w-3.5" /> ADMIN
                </span>
              )}
              {user.role === "moderator" && (
                <span className="bg-amber-500 text-white px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase border border-amber-400 flex items-center gap-1 shadow-sm">
                  <UserCheck className="h-3.5 w-3.5" /> REVIEWER
                </span>
              )}
              {user.role === "contributor" && (
                <span className="bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase border border-indigo-400 flex items-center gap-1 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" /> KONTRIBUTOR
                </span>
              )}
              {user.role === "student" && (
                <span className="bg-zinc-500 text-white px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase border border-zinc-400 flex items-center gap-1 shadow-sm">
                  <BookOpen className="h-3.5 w-3.5" /> SISWA
                </span>
              )}
            </h1>
            <span className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/10 text-indigo-200">
              Level {level}
            </span>
          </div>

          {/* Ranks & Roles badges */}
          <p className="text-indigo-400 font-bold text-sm sm:text-base mt-2 flex items-center gap-1.5 justify-center md:justify-start">
            <Award className="h-4.5 w-4.5 text-amber-400" /> {getPlayfulRankTitle(level, user.role)}
          </p>

          {/* ⭐ TOP 3 SPECIALTY BADGE (below name) */}
          {specialtyBadge && (
            <div className={`inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full bg-gradient-to-r ${specialtyBadge.gradient} border ${specialtyBadge.border} shadow-lg ${specialtyBadge.glow} backdrop-blur-sm`}>
              <span className="text-sm">{specialtyBadge.icon}</span>
              <div className="text-left">
                <p className="text-xs font-black text-white tracking-wider uppercase">{specialtyBadge.name}</p>
                <p className="text-[9px] text-white/70 font-semibold">{specialtyBadge.desc}</p>
              </div>
              <Sparkles className="h-3.5 w-3.5 text-white/80 animate-pulse" />
            </div>
          )}

          {/* 🎖️ SECRET ACHIEVEMENT (Top 100) */}
          {secretAchievement && (
            <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full border text-xs font-bold ${secretAchievement.bg} ${secretAchievement.color}`}>
              <span>{secretAchievement.icon}</span>
              <span>{secretAchievement.name}</span>
              <span className="text-[9px] text-normal opacity-70">— {secretAchievement.desc}</span>
            </div>
          )}

          {/* Playful Motto */}
          <p className="italic text-zinc-300 text-sm mt-3 bg-white/5 border border-white/5 px-4 py-2 rounded-2xl max-w-xl mx-auto md:mx-0 leading-relaxed font-sans">
            &quot;{motto}&quot;
          </p>

          {/* Playful Short Bio */}
          <p className="text-zinc-400 text-sm mt-3 max-w-xl">
            {bio}
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3 justify-center md:justify-start">
            {isOwnProfile && (
              <button
                onClick={onEditProfile}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <Edit3 className="h-4 w-4 text-indigo-300" /> Edit Bio &amp; Motto
              </button>
            )}

            {user.points > 0 && (
              <button
                onClick={onOpenCertificate}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-zinc-950 px-4 py-2.5 text-xs font-black shadow-lg shadow-amber-500/20 border border-amber-300/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <Award className="h-4 w-4" /> Lihat Sertifikat Kontributor
              </button>
            )}

            {/* 📸 CUSTOM PHOTO UPLOAD (Top 10 perk) */}
            {isOwnProfile && user.rank <= 10 && (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept={ACCEPTED_AVATAR_TYPES}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white px-4 py-2.5 text-xs font-black shadow-lg shadow-purple-500/20 border border-purple-400/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  title="Unggah foto profil custom (Hak Istimewa Top 10)"
                >
                  <Camera className="h-4 w-4" /> {isUploadingPhoto ? "Mengunggah…" : "Foto Profil Custom"}
                  <span className="t-[9px] bg-purple-400/30 px-1.5 py-0.5 rounded font-bold">TOP 10</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                navigator.clipboard.writeText(typeof window !== "undefined" ? `${window.location.origin}/profile/${user.id}` : "");
                toastSuccess("Link Disalin!", "Link profil berhasil disalin ke clipboard.");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-350 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer"
            >
              <Share2 className="h-4 w-4" /> Bagikan Profil
            </button>

            {isOwnProfile && (
              <>
                <button
                  onClick={onOpenStatus}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-indigo-900/50 border border-zinc-700/80 hover:border-indigo-500/50 text-indigo-300 px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Bell className="h-4 w-4" /> Notifikasi &amp; Status
                </button>
                <button
                  onClick={onOpenReport}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-red-900/50 border border-zinc-700/80 hover:border-red-500/50 text-red-300 px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Flag className="h-4 w-4" /> Lapor Isu
                </button>
                {/* UU PDP: hak ekspor & hapus harus punya pintunya sendiri. */}
                <Link
                  href="/profile/privacy"
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-emerald-900/40 border border-zinc-700/80 hover:border-emerald-500/50 text-emerald-300 px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" /> Privasi &amp; Data
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Gamified Level Progress Board */}
        <div className="w-full md:w-72 bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center text-xs font-extrabold text-zinc-400 mb-2">
              <span>PROGRESS LEVEL</span>
              <span className="text-indigo-400">{progressPercent}%</span>
            </div>
            {/* Level progress bar */}
            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 font-medium">
              {user.points >= 500
                ? "Kamu telah mencapai puncak ilmu tertinggi!"
                : `Butuh ${pointsNeededForNext} poin lagi untuk naik ke Level ${level + 1}`
              }
            </p>
          </div>

          <div className="border-t border-white/5 pt-4 mt-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-zinc-400 font-bold uppercase">AKUN DIBUAT</p>
              <p className="text-xs font-extrabold text-zinc-200 mt-0.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                {new Date(user.createdAt).toLocaleDateString("id-ID", { month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-400 font-bold uppercase">LENCANA</p>
              <p className="text-xs font-extrabold text-zinc-200 mt-0.5 text-indigo-300 flex items-center justify-end gap-1">
                <Award className="h-3.5 w-3.5 text-indigo-400" />
                {badgeCount.unlocked} / {badgeCount.total}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
