// components/profile/ProfileClient.tsx
// ─── Perakitan halaman profil ──────────────────────────────────────────────────
//
// File ini dulu 1700+ baris: banner, empat tab, lima modal, dan semua handler
// dalam satu komponen. Setiap perubahan pada salah satu modal berarti membaca
// keseluruhan file untuk memastikan tidak ada yang lain yang membaca state
// yang dipegangnya. Sekarang ia hanya merakit bagian-bagian itu dan mengelola
// dua hal yang benar-benar milik seluruh halaman: tab aktif dan avatar
// terpilih (yang dipakai bersama oleh header dan picker).
//
// Yang **tidak** ada di sini lagi: semua evaluasi lencana (M14e — server), dan
// semua angka spesialis (SQL, lihat props `specialtyStats`).
"use client";

import { useState } from "react";
import {
  Sparkles, BookOpen, HelpCircle, Clock,
} from "lucide-react";
import type { BadgeDisplay, SpecialtyStats } from "@/lib/badges";
import { AVATAR_OPTIONS, AvatarOption } from "@/lib/avatars";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import {
  ADMIN_DEFAULT_BIO, STUDENT_DEFAULT_BIO, DEFAULT_MOTTO,
} from "./types";
import type {
  UserProfile, UserModule, UserQuestion, PointLog, ProfileStatusItem,
} from "./types";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileStatsGrid } from "./ProfileStatsGrid";
import { ProfileSummaryPanel } from "./ProfileSummaryPanel";
import { ProfileModulesPanel } from "./ProfileModulesPanel";
import { ProfileQuestionsPanel } from "./ProfileQuestionsPanel";
import { ProfilePointsLog } from "./ProfilePointsLog";
import {
  EditProfileModal, AvatarPickerModal, StatusModal, ReportModal, CertificateModal,
} from "./ProfileModals";

interface ProfileClientProps {
  user: UserProfile;
  userModules: UserModule[];
  userQuestions: UserQuestion[];
  pointLogs: PointLog[];
  /**
   * Enam angka lencana spesialis, dihitung SQL di server (`getSpecialtyStats`).
   *
   * Dulu angka-angka ini diturunkan di sini dari `pointLogs` — yang hanya berisi
   * 20 baris terakhir, dan yang menyaring `action LIKE 'quiz_completed%'` padahal
   * tidak ada penulis di seluruh `src/` yang pernah menulis aksi itu. Hasilnya
   * `quizTotal` dan `hardQuizzes` selalu 0, sehingga tiga lencana mustahil
   * terbuka. Sekarang server yang menghitung, dan halaman peringkat memakai
   * fungsi yang sama — dua permukaan tidak bisa lagi berbeda pendapat.
   */
  specialtyStats: SpecialtyStats;
  /**
   * Seluruh katalog lencana, sudah dievaluasi server.
   *
   * Setiap entri membawa `unlocked` dan `redacted` — keduanya diputuskan
   * `toBadgeDisplays()` di `src/lib/badges/evaluate.ts`. Komponen ini tidak
   * menghitung apa pun: dulu ia menyusun `badgeUnlockData` dari `userModules`
   * dan `userQuestions`, sehingga `approvedModules` di sini dan `approvedMods`
   * di `specialtyStats` berasal dari dua sumber berbeda untuk angka yang sama.
   */
  badgeDisplays: BadgeDisplay[];
  isOwnProfile: boolean;
}

export default function ProfileClient({
  user, userModules, userQuestions, pointLogs, specialtyStats, badgeDisplays,
  isOwnProfile,
}: ProfileClientProps) {
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();

  // Local States
  const [activeTab, setActiveTab] = useState<"summary" | "modules" | "questions" | "logs">("summary");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption>(() => {
    // Priority: DB (avatarIndex) → points-based default.
    //
    // Sebelumnya ada satu cabang lagi di antaranya: `localStorage["nawa_avatar_<id>"]`.
    // Itu murni redundansi — kolom `avatar_index` sudah menyimpan pilihan yang
    // sama di server — dan lebih buruk daripada redundansi: salinan lokal itu
    // **menutupi** nilai server, jadi pilihan avatar yang diubah dari perangkat
    // lain (atau setelah akun dianonimkan) tetap terlihat seperti yang lama.
    if (user.avatarIndex !== null && user.avatarIndex !== undefined) {
      return AVATAR_OPTIONS[user.avatarIndex] ?? AVATAR_OPTIONS[user.points % AVATAR_OPTIONS.length];
    }
    return AVATAR_OPTIONS[user.points % AVATAR_OPTIONS.length];
  });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Modals
  const [isEditing, setIsEditing] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [statusData, setStatusData] = useState<ProfileStatusItem[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const bio = user.bio ?? (user.role === "admin" ? ADMIN_DEFAULT_BIO : STUDENT_DEFAULT_BIO);
  const motto = user.motto ?? DEFAULT_MOTTO;

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch("/api/profile/status");
      const data = await res.json();
      if (data.success || data.data) setStatusData(data.data || []);
    } catch {
      toastError("Gagal", "Gagal mengambil data status.");
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Save selected avatar
  const handleSelectAvatar = async (avatar: AvatarOption) => {
    const previous = selectedAvatar;
    setSelectedAvatar(avatar);
    setShowAvatarPicker(false);
    const idx = AVATAR_OPTIONS.findIndex((a) => a.svg === avatar.svg);
    if (idx === -1) return;

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarIndex: idx }),
      });
      // `fetch` only rejects on a network failure — a 400 or a 429 resolves
      // normally. Without this check a rejected avatar was announced as saved
      // and the picker kept showing it until the next reload.
      if (!res.ok) throw new Error(`avatar update failed: ${res.status}`);
      toastSuccess("Berhasil", "Avatar berhasil diperbarui.");
      router.refresh();
    } catch {
      setSelectedAvatar(previous);
      toastError("Gagal", "Gagal menyimpan avatar.");
    }
  };

  const unlockedCount = badgeDisplays.filter((b) => b.unlocked).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      <ProfileHeader
        user={user}
        specialtyStats={specialtyStats}
        badgeCount={{ unlocked: unlockedCount, total: badgeDisplays.length }}
        isOwnProfile={isOwnProfile}
        selectedAvatar={selectedAvatar}
        onSelectAvatar={() => setShowAvatarPicker(true)}
        onEditProfile={() => setIsEditing(true)}
        onOpenStatus={() => {
          fetchStatus();
          setShowStatusModal(true);
        }}
        onOpenReport={() => setShowReportModal(true)}
        onOpenCertificate={() => setShowCertificate(true)}
      />

      <ProfileStatsGrid
        user={user}
        userModules={userModules}
        userQuestions={userQuestions}
      />

      {/* 🔍 Navigation Tabs */}
      <div className="border border-zinc-200 dark:border-zinc-800 flex flex-nowrap overflow-x-auto gap-1 sm:gap-2 mb-8 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-2xl max-w-full lg:max-w-3xl snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          onClick={() => setActiveTab("summary")}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer snap-start ${
            activeTab === "summary"
              ? "bg-white dark:bg-zinc-900 text-nawa-primary dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Sparkles className="h-4 w-4" /> Ringkasan
        </button>
        <button
          onClick={() => setActiveTab("modules")}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer snap-start ${
            activeTab === "modules"
              ? "bg-white dark:bg-zinc-900 text-nawa-primary dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Modul Saya ({userModules.length})
        </button>
        <button
          onClick={() => setActiveTab("questions")}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer snap-start ${
            activeTab === "questions"
              ? "bg-white dark:bg-zinc-900 text-nawa-primary dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <HelpCircle className="h-4 w-4" /> Soal Saya ({userQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer snap-start ${
            activeTab === "logs"
              ? "bg-white dark:bg-zinc-900 text-nawa-primary dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Clock className="h-4 w-4" /> Riwayat Poin
        </button>
      </div>

      {/* 🌟 Tab Content Panels */}

      {/* 1. Ringkasan Panel */}
      {activeTab === "summary" && (
        <ProfileSummaryPanel
          badgeDisplays={badgeDisplays}
          specialtyStats={specialtyStats}
          userModules={userModules}
          userQuestions={userQuestions}
        />
      )}

      {/* 2. Modul Saya Panel */}
      {activeTab === "modules" && <ProfileModulesPanel modules={userModules} />}

      {/* 3. Soal Saya Panel */}
      {activeTab === "questions" && <ProfileQuestionsPanel questions={userQuestions} />}

      {/* 4. Riwayat Poin Panel */}
      {activeTab === "logs" && <ProfilePointsLog logs={pointLogs} />}

      {/* ─── Modals ────────────────────────────────────────────────── */}

      {isEditing && (
        <EditProfileModal
          bio={bio}
          motto={motto}
          onClose={() => setIsEditing(false)}
        />
      )}

      {showAvatarPicker && (
        <AvatarPickerModal
          selectedAvatar={selectedAvatar}
          onSelect={handleSelectAvatar}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {showStatusModal && (
        <StatusModal
          items={statusData}
          isLoading={isLoadingStatus}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      {showReportModal && <ReportModal onClose={() => setShowReportModal(false)} />}

      {showCertificate && (
        <CertificateModal
          user={user}
          onClose={() => setShowCertificate(false)}
        />
      )}

    </div>
  );
}
