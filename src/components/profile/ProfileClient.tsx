// components/profile/ProfileClient.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Trophy, 
  BookOpen, 
  HelpCircle, 
  Calendar, 
  Sparkles, 
  Award, 
  Download, 
  Edit3, 
  Check, 
  ChevronRight, 
  Clock, 
  Shield,
  FileText,
  Bookmark,
  Share2,
  Lock,
  ArrowRight,
  TrendingUp,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Camera,
  MessageSquare,
  Star,
  Flag,
  Bell,
  Crown,
  Flame,
  Target
} from "lucide-react";
import { BADGES, Badge, getDaysOldAccount, getRarityColor, getRarityTextColor, BadgeUnlockData, getSpecialtyBadge } from "@/lib/badges";
import { AVATAR_OPTIONS, AvatarOption } from "@/lib/avatars";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";

// Inline level helpers — linear scaling, safe for client bundle (no server deps)
const calcLevel = (pts: number) => Math.floor((1 + Math.sqrt(1 + (4 * pts) / 25)) / 2);
const calcLevelThreshold = (lvl: number) => 25 * lvl * (lvl - 1);

interface UserProfile {
  id: string;
  clerkId: string;
  name: string;
  email: string;
  role: "guest" | "student" | "contributor" | "moderator" | "admin";
  points: number;
  createdAt: string; // ISO string
  rank: number;
  totalStudents: number;
  // Profile customisation — stored in DB so other users can see them
  avatarIndex: number | null;
  photoUrl: string | null;
  bio: string | null;
  motto: string | null;
  // Level rewards
  levelFrame: string | null;   // "wood" | "bronze" | "silver" | "gold" | null
}

interface UserModule {
  id: string;
  title: string;
  subject: string;
  grade: string;
  category: string;
  downloads: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface UserQuestion {
  id: string;
  questionText: string;
  difficulty: "mudah" | "sedang" | "sulit";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface PointLog {
  id: string;
  action: string;
  delta: number;
  createdAt: string;
}

interface ProfileClientProps {
  user: UserProfile;
  userModules: UserModule[];
  userQuestions: UserQuestion[];
  pointLogs: PointLog[];
  isOwnProfile: boolean;
}

// AVATAR_OPTIONS is imported from @/lib/avatars

// Playful Bios list for generator
const PLAYFUL_BIOS = [
  "Siswa teladan SMAN 2 Jonggol yang hobi belajar sambil dengerin lagu pop alternatif. 🎧",
  "Pencari ilmu sejati. Musuh bebuyutan soal kalkulus, tapi bersahabat baik dengan biologi sel. 🧬",
  "Menyelesaikan limit fungsi aljabar lebih cepat daripada menyeduh mi instan. ⚡",
  "Kolektor V-Point NAWA-LEARN teraktif! Mari majukan literasi digital sekolah kita! 📚",
  "Tidur nyenyak adalah mitos, rumus fisika adalah realitas. Pejuang UTBK jalur undangan! 🎓",
];

export default function ProfileClient({ 
  user, 
  userModules, 
  userQuestions, 
  pointLogs, 
  isOwnProfile 
}: ProfileClientProps) {
  
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();

  // Local States
  const [activeTab, setActiveTab] = useState<"summary" | "modules" | "questions" | "logs">("summary");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption>(() => {
    // Priority: DB (avatarIndex) → localStorage JSON → points-based default
    if (user.avatarIndex !== null && user.avatarIndex !== undefined) {
      return AVATAR_OPTIONS[user.avatarIndex] ?? AVATAR_OPTIONS[user.points % AVATAR_OPTIONS.length];
    }
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`nawa_avatar_${user.id}`);
      if (saved) {
        try { return JSON.parse(saved) as AvatarOption; } catch {}
      }
    }
    return AVATAR_OPTIONS[user.points % AVATAR_OPTIONS.length];
  });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  const [bio, setBio] = useState(() => {
    // Priority: DB → localStorage → role-based default
    if (user.bio) return user.bio;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`nawa_bio_${user.id}`);
      if (saved) return saved;
    }
    return user.role === "admin" 
      ? "Administrator Platform NAWA-LEARN SMAN 2 Jonggol. Siap menyaring modul-modul berkualitas!" 
      : "Siswa aktif SMAN 2 Jonggol. Senang berbagi catatan dan belajar bersama teman-teman.";
  });
  const [motto, setMotto] = useState(() => {
    // Priority: DB → localStorage → default
    if (user.motto) return user.motto;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`nawa_motto_${user.id}`);
      if (saved) return saved;
    }
    return "Belajar hari ini, memimpin esok hari!";
  });

  // Sync state if user prop changes from router.refresh()
  useEffect(() => {
    if (user.bio && user.bio !== bio) setBio(user.bio);
    if (user.motto && user.motto !== motto) setMotto(user.motto);
    if (user.name && user.name !== editName) setEditName(user.name);
  }, [user.bio, user.motto, user.name]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(bio);
  const [editMotto, setEditMotto] = useState(motto);
  const [isSaving, setIsSaving] = useState(false);

  // Status & Report Modals
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [reportType, setReportType] = useState("bug");
  const [reportDesc, setReportDesc] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  
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
  const [customPhoto, setCustomPhoto] = useState<string | null>(() => {
    // Priority: DB → localStorage
    if (user.photoUrl) return user.photoUrl;
    if (typeof window !== "undefined") {
      return localStorage.getItem(`nawa_photo_${user.id}`);
    }
    return null;
  });
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toastError("Foto Terlalu Besar", "Ukuran foto maksimal 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setCustomPhoto(dataUrl);
      if (typeof window !== "undefined") {
        localStorage.setItem(`nawa_photo_${user.id}`, dataUrl);
      }
      try {
        const res = await fetch('/api/profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoUrl: dataUrl }),
        });
        if (!res.ok) {
          throw new Error("Gagal menyimpan foto ke server. Ukuran mungkin terlalu besar.");
        }
        toastSuccess("Berhasil", "Foto profil berhasil diperbarui.");
        router.refresh();
      } catch (err: any) {
        console.error('Photo save to DB failed:', err);
        toastError("Gagal Menyimpan", err.message || "Gagal menyimpan foto profil.");
      }
    };
    reader.readAsDataURL(file);
  };
  const handleRemovePhoto = async () => {
    setCustomPhoto(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`nawa_photo_${user.id}`);
    }
    try {
      await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: null }),
      });
      router.refresh();
    } catch (err) {
      console.error('Photo remove failed:', err);
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
      wood:   { gradient: "from-amber-800 via-yellow-700 to-amber-600",         label: "Frame Kayu"     },
      bronze: { gradient: "from-amber-600 via-orange-500 to-amber-700",         label: "Frame Perunggu" },
      silver: { gradient: "from-slate-400 via-zinc-300 to-slate-500",           label: "Frame Silver"   },
      gold:   { gradient: "from-yellow-400 via-amber-300 to-yellow-600",        label: "Frame Emas"     },
    };
    return map[frame] ?? null;
  };
  const levelFrameStyle = getLevelFrameStyle(user.levelFrame);

  // Get specialty badge for Top 3 (based on contribution type)
  const userSpecialtyBadge = getSpecialtyBadge({
    hardQuizzes: pointLogs.filter(l => l.action === "quiz_completed_sulit" || l.action === "quiz_completed_sangat sulit").length,
    approvedMods: userModules.filter(m => m.status === "approved").length,
    quizTotal: pointLogs.filter(l => l.action.startsWith("quiz_completed")).length,
    diverseSubjects: new Set(userModules.filter(m => m.status === "approved").map(m => m.subject)).size,
    approvedQuestions: userQuestions ? userQuestions.filter(q => q.status === "approved").length : 0,
    totalDownloads: userModules.reduce((a, m) => a + m.downloads, 0),
  }, user.rank);

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

  const submitReport = async () => {
    if (!reportDesc.trim()) return toastError("Peringatan", "Deskripsi laporan tidak boleh kosong.");
    setIsSubmittingReport(true);
    try {
      const res = await fetch("/api/profile/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueType: reportType, description: reportDesc })
      });
      if (res.ok) {
        toastSuccess("Berhasil", "Laporan berhasil dikirim.");
        setShowReportModal(false);
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

  // ─── Render functions ───────────────────────────────────────────────────────
  // Get secret achievement for Top 100
  const getSecretAchievement = () => {
    if (user.rank > 100) return null;
    const quizTotal = pointLogs.filter(l => l.action.startsWith("quiz_completed")).length;
    const hardQuizzes = pointLogs.filter(l =>
      l.action === "quiz_completed_sulit" || l.action === "quiz_completed_sangat sulit"
    ).length;
    const approvedMods = userModules.filter(m => m.status === "approved").length;
    const diverseSubjects = new Set(userModules.filter(m => m.status === "approved").map(m => m.subject)).size;
    const totalDownloads = userModules.reduce((a, m) => a + m.downloads, 0);

    if (hardQuizzes >= 5) return { name: "Bane of Easy Mode", desc: "Menyelesaikan 5+ kuis sulit", icon: "💀", color: "text-red-400", bg: "bg-red-950/30 border-red-900/50" };
    if (approvedMods >= 5) return { name: "Living Library", desc: "5+ modul disetujui", icon: "🏛️", color: "text-purple-400", bg: "bg-purple-950/30 border-purple-900/50" };
    if (totalDownloads >= 100) return { name: "Viral Scholar", desc: "Modul diunduh 100+ kali", icon: "🌊", color: "text-cyan-400", bg: "bg-cyan-950/30 border-cyan-900/50" };
    if (diverseSubjects >= 4) return { name: "Polymath Prodigy", desc: "Kontribusi di 4+ mata pelajaran", icon: "🔬", color: "text-green-400", bg: "bg-green-950/30 border-green-900/50" };
    if (quizTotal >= 10) return { name: "Eternal Student", desc: "Menyelesaikan 10+ kuis", icon: "🔄", color: "text-blue-400", bg: "bg-blue-950/30 border-blue-900/50" };
    if (user.rank <= 10) return { name: "The Chosen Few", desc: "Masuk dalam 10 besar", icon: "🌟", color: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/50" };
    if (user.rank <= 50) return { name: "Silent Powerhouse", desc: "Masuk dalam 50 besar", icon: "⚡", color: "text-indigo-400", bg: "bg-indigo-950/30 border-indigo-900/50" };
    return { name: "The Century Club", desc: "Masuk dalam 100 besar", icon: "🎖️", color: "text-zinc-300", bg: "bg-zinc-800/50 border-zinc-700/50" };
  };

  const avatarFrame = getAvatarFrame(user.rank);
  const specialtyBadge = userSpecialtyBadge;
  const secretAchievement = getSecretAchievement();

  // Save selected avatar
  const handleSelectAvatar = async (avatar: AvatarOption) => {
    setSelectedAvatar(avatar);
    setShowAvatarPicker(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(`nawa_avatar_${user.id}`, JSON.stringify(avatar));
    }
    const idx = AVATAR_OPTIONS.findIndex(a => a.svg === avatar.svg);
    if (idx !== -1) {
      try {
        await fetch('/api/profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarIndex: idx }),
        });
        toastSuccess("Berhasil", "Avatar berhasil diperbarui.");
        router.refresh();
      } catch (err) {
        toastError("Gagal", "Gagal menyimpan avatar.");
      }
    }
  };

  // Generate random bio
  const handleGenerateBio = () => {
    const randomIdx = Math.floor(Math.random() * PLAYFUL_BIOS.length);
    setEditBio(PLAYFUL_BIOS[randomIdx]);
  };

  // Save profile edits
  const handleSaveProfile = async () => {
    const isNameChanged = editName !== user.name;
    const isBioChanged = editBio !== bio;
    const isMottoChanged = editMotto !== motto;

    if (!isNameChanged && !isBioChanged && !isMottoChanged) {
      setIsEditing(false);
      return;
    }

    setBio(editBio);
    setMotto(editMotto);
    setIsEditing(false);
    
    if (typeof window !== "undefined") {
      localStorage.setItem(`nawa_bio_${user.id}`, editBio);
      localStorage.setItem(`nawa_motto_${user.id}`, editMotto);
    }
    
    try {
      // Update bio and motto in our DB
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: editBio, motto: editMotto }),
      });
      
      if (!res.ok) {
        toastError("Gagal", "Gagal menyimpan perubahan profil ke server.");
        return;
      }
      
      toastSuccess("Tersimpan!", "Profil berhasil diperbarui.");
      router.refresh();
    } catch (err) {
      console.error('Profile save to DB failed:', err);
      toastError("Gagal", "Terjadi kesalahan jaringan.");
    }
  };

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
        format: [canvas.width, canvas.height]
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

  // Calculate badge unlock data
  const badgeUnlockData = useMemo<BadgeUnlockData>(() => {
    const modulesBySubject: Record<string, number> = {};
    userModules.forEach(m => {
      if (m.status === "approved") {
        modulesBySubject[m.subject] = (modulesBySubject[m.subject] || 0) + 1;
      }
    });

    return {
      points: user.points,
      rank: user.rank,
      totalStudents: user.totalStudents,
      approvedModules: userModules.filter(m => m.status === "approved").length,
      approvedQuestions: userQuestions.filter(q => q.status === "approved").length,
      totalDownloads: userModules.reduce((acc, m) => acc + m.downloads, 0),
      modulesBySubject,
      questionsCreated: userQuestions.length,
      accountAgeInDays: getDaysOldAccount(user.createdAt),
      createdAt: user.createdAt
    };
  }, [user, userModules, userQuestions]);

  // Evaluate which badges are unlocked
  const unlockedBadges = useMemo(() => {
    return BADGES.filter(badge => badge.unlockCondition(badgeUnlockData));
  }, [badgeUnlockData]);

  const unlockedCount = unlockedBadges.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* 🌟 Profile Main Banner & Header Section */}
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
              ) : (selectedAvatar as any).svg ? (
                <Image src={(selectedAvatar as any).svg} alt={selectedAvatar.label} fill className="object-cover" />
              ) : (
                <span className="text-6xl">{(selectedAvatar as any).emoji}</span>
              )}
              
              {isOwnProfile && !customPhoto && (
                <button
                  onClick={() => setShowAvatarPicker(true)}
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
              <span className="absolute -top-3 -left-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-900 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase border border-amber-300 shadow-md shadow-amber-500/30">
                #{user.rank} 🏆
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
                <span className="text-[9px] font-normal opacity-70">— {secretAchievement.desc}</span>
              </div>
            )}

            {/* Playful Motto */}
            <p className="italic text-zinc-300 text-sm mt-3 bg-white/5 border border-white/5 px-4 py-2 rounded-2xl max-w-xl mx-auto md:mx-0 leading-relaxed font-sans">
              "{motto}"
            </p>

            {/* Playful Short Bio */}
            <p className="text-zinc-400 text-sm mt-3 max-w-xl">
              {bio}
            </p>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3 justify-center md:justify-start">
              {isOwnProfile && (
                <button
                  onClick={() => {
                    setEditName(user.name);
                    setEditBio(bio);
                    setEditMotto(motto);
                    setIsEditing(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Edit3 className="h-4 w-4 text-indigo-300" /> Edit Bio & Motto
                </button>
              )}

              {user.points > 0 && (
                <button
                  onClick={() => setShowCertificate(true)}
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
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white px-4 py-2.5 text-xs font-black shadow-lg shadow-purple-500/20 border border-purple-400/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                    title="Unggah foto profil custom (Hak Istimewa Top 10)"
                  >
                    <Camera className="h-4 w-4" /> Foto Profil Custom
                    <span className="text-[9px] bg-purple-400/30 px-1.5 py-0.5 rounded font-bold">TOP 10</span>
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
                    onClick={() => {
                      fetchStatus();
                      setShowStatusModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-indigo-900/50 border border-zinc-700/80 hover:border-indigo-500/50 text-indigo-300 px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    <Bell className="h-4 w-4" /> Notifikasi & Status
                  </button>
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-red-900/50 border border-zinc-700/80 hover:border-red-500/50 text-red-300 px-4 py-2.5 text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    <Flag className="h-4 w-4" /> Lapor Isu
                  </button>
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
                  ? "Kamu telah mencapai puncak ilmu tertinggi! 👑" 
                  : `Butuh ${pointsNeededForNext} poin lagi untuk naik ke Level ${level + 1} 🚀`
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
                <p className="text-xs font-extrabold text-zinc-200 mt-0.5 text-indigo-300">
                  🏆 {unlockedCount} / {BADGES.length}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 🚀 Statistics Dashboard grid (elegant & playful card grids) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        
        {/* Total Points Card (Gold) */}
        <div className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 p-5 sm:p-6 border border-amber-200/60 dark:border-amber-900/30 rounded-3xl shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner font-bold">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">V-Point</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform duration-200">
            {user.points}
          </p>
          <div className="mt-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500 font-medium">
            Meningkat lewat unggah modul & latihan.
          </div>
        </div>

        {/* Leaderboard Rank Card (Indigo/Blue) */}
        <div className="group relative overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/10 p-5 sm:p-6 border border-indigo-200/60 dark:border-indigo-900/30 rounded-3xl shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner font-bold">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">Peringkat Sekolah</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform duration-200">
            {user.points > 0 ? `#${user.rank}` : "—"}
          </p>
          <div className="mt-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500 font-medium">
            {user.points > 0 
              ? `Peringkat #${user.rank} dari ${user.totalStudents} siswa.`
              : "Unggah modul untuk masuk papan peringkat!"
            }
          </div>
        </div>

        {/* Total Modules Uploaded (Purple) */}
        <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/20 dark:to-fuchsia-950/10 p-5 sm:p-6 border border-purple-200/60 dark:border-purple-900/30 rounded-3xl shadow-sm hover:shadow-md hover:border-purple-400 dark:hover:border-purple-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner font-bold">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">Modul Dibagikan</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform duration-200">
            {userModules.length}
          </p>
          <div className="mt-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500 font-medium">
            {userModules.filter(m => m.status === "approved").length} disetujui • {userModules.filter(m => m.status === "pending").length} verifikasi
          </div>
        </div>

        {/* Practice Questions created (Emerald) */}
        <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/10 p-5 sm:p-6 border border-emerald-200/60 dark:border-emerald-900/30 rounded-3xl shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-700/80 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner font-bold">
              <HelpCircle className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">Soal Latihan</span>
          </div>
          <p className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform duration-200">
            {userQuestions.length}
          </p>
          <div className="mt-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500 font-medium">
            {userQuestions.filter(q => q.status === "approved").length} disetujui • {userQuestions.filter(q => q.status === "pending").length} verifikasi
          </div>
        </div>

      </div>

      {/* 🔍 Navigation Tabs */}
      <div className="border border-zinc-200 dark:border-zinc-800 flex flex-nowrap overflow-x-auto gap-1 sm:gap-2 mb-8 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-2xl max-w-full lg:max-w-3xl snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          onClick={() => setActiveTab("summary")}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer snap-start ${
            activeTab === "summary"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Sparkles className="h-4 w-4" /> Ringkasan
        </button>
        <button
          onClick={() => setActiveTab("modules")}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer snap-start ${
            activeTab === "modules"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Modul Saya ({userModules.length})
        </button>
        <button
          onClick={() => setActiveTab("questions")}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer snap-start ${
            activeTab === "questions"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <HelpCircle className="h-4 w-4" /> Soal Saya ({userQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer snap-start ${
            activeTab === "logs"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Clock className="h-4 w-4" /> Riwayat Poin
        </button>
      </div>

      {/* 🌟 Tab Content Panels */}
      
      {/* 1. Ringkasan Panel */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Achievements List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                    🎖️ Lencana Pencapaian
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Buka lencana khusus dengan aktif berkontribusi di komunitas SMAN 2 Jonggol.
                  </p>
                </div>
                <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs px-3 py-1.5 rounded-xl font-bold border border-indigo-100 dark:border-indigo-950">
                  {unlockedCount} / {BADGES.length} Terbuka
                </span>
              </div>

              {/* Badge Categories */}
              <div className="space-y-8">
                {(["contribution", "learning", "milestone", "social", "special", "hidden"] as const).map((category) => {
                  const isMod = user.role === "moderator" || user.role === "admin";
                  const categoryBadges = BADGES.filter(b => b.category === category);
                  // For non-moderators, hidden category badges are always shown as locked mystery slots
                  const categoryUnlocked = unlockedBadges.filter(b => b.category === category);

                  const categoryTitles: Record<typeof category, string> = {
                    contribution: "🎁 Lencana Kontribusi",
                    learning: "📚 Lencana Pembelajaran",
                    milestone: "🎯 Lencana Pencapaian",
                    social: "🤝 Lencana Sosial",
                    special: "⭐ Lencana Khusus",
                    hidden: "🔒 Lencana Tersembunyi",
                  };

                  return (
                    <div key={category}>
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                          {categoryTitles[category]}
                          {category === "hidden" && !isMod && (
                            <span className="ml-2 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">Rahasia</span>
                          )}
                        </h3>
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                          {isMod ? `${categoryUnlocked.length} / ${categoryBadges.length}` : (
                            category === "hidden" ? `? / ${categoryBadges.length}` : `${categoryUnlocked.length} / ${categoryBadges.length}`
                          )}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {categoryBadges.map((badge) => {
                          const isUnlocked = unlockedBadges.some(b => b.id === badge.id);
                          // For hidden badges: non-moderators see a mystery slot ONLY if they haven't unlocked it yet!
                          const isHiddenFromUser = badge.hidden && !isMod && !isUnlocked;
                          const showAsUnlocked = isUnlocked;

                          return (
                            <div
                              key={badge.id}
                              className={`p-4 rounded-2xl border transition-all duration-300 relative group flex gap-3 items-start ${
                                showAsUnlocked
                                  ? `bg-gradient-to-br ${getRarityColor(badge.rarity)} border-opacity-50 border-white shadow-md hover:shadow-lg`
                                  : isHiddenFromUser
                                    ? "bg-zinc-900/80 dark:bg-zinc-950 border-zinc-700 dark:border-zinc-800"
                                    : "bg-zinc-50/50 dark:bg-zinc-950/40 border-zinc-150 dark:border-zinc-850 opacity-60"
                              }`}
                              title={isHiddenFromUser ? "Lencana misterius — cara membukanya hanya diketahui moderator" : badge.description}
                            >
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 flex-none ${
                                showAsUnlocked
                                  ? "bg-white/20 text-white shadow-sm"
                                  : isHiddenFromUser
                                    ? "bg-zinc-800 text-zinc-600"
                                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                              }`}>
                                {showAsUnlocked ? badge.icon : isHiddenFromUser ? "❓" : <Lock className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />}
                              </div>

                              <div className="text-left flex-1 min-w-0">
                                <h4 className={`font-extrabold text-sm flex items-center gap-1.5 ${
                                  showAsUnlocked
                                    ? "text-white"
                                    : isHiddenFromUser
                                      ? "text-zinc-500 dark:text-zinc-600"
                                      : "text-zinc-950 dark:text-zinc-100"
                                }`}>
                                  {isHiddenFromUser ? "???" : badge.title}
                                  {showAsUnlocked && <span className="text-xs">✓</span>}
                                </h4>
                                <p className={`text-[11px] mt-0.5 leading-snug ${
                                  showAsUnlocked
                                    ? "text-white/80"
                                    : isHiddenFromUser
                                      ? "text-zinc-600 dark:text-zinc-700"
                                      : "text-zinc-500 dark:text-zinc-400"
                                }`}>
                                  {isHiddenFromUser ? "Cara membuka lencana ini hanya diketahui moderator." : badge.description}
                                </p>
                                
                                {!showAsUnlocked && !isHiddenFromUser && (
                                  <div className="mt-2 text-[10px] text-zinc-600 dark:text-zinc-400 font-semibold bg-zinc-100/60 dark:bg-zinc-800/60 px-2 py-0.5 rounded-lg inline-block">
                                    {badge.howToUnlock}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Playful learning resources reminder */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg shadow-indigo-500/10">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="text-center sm:text-left relative z-10">
                <span className="bg-white/20 text-white font-bold text-[10px] px-2.5 py-1 rounded-full uppercase border border-white/10 tracking-widest">Ayo Kontribusi!</span>
                <h4 className="text-xl sm:text-2xl font-black mt-3">Ingin menaikkan level & poinmu?</h4>
                <p className="text-xs text-indigo-100 mt-1 max-w-sm sm:max-w-md leading-relaxed">
                  Unggah rangkuman rumus kreatif, catatan pelajaran estetik, atau latihan soal menarik. Dapatkan 50 poin setiap modul/soal disetujui!
                </p>
              </div>
              <Link 
                href="/submit"
                className="shrink-0 bg-white hover:bg-zinc-100 text-indigo-700 font-black text-xs px-5 py-3.5 rounded-2xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
              >
                Unggah Catatan <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right sidebar: Contribution details */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                📊 Statistik Singkat
              </h3>

              <div className="space-y-3">
                <div className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 shadow-sm hover:shadow-md cursor-default">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">
                      📁
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-850 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Total Modul Pending</h4>
                      <p className="text-[10px] text-zinc-500">Dalam tinjauan OSIS</p>
                    </div>
                  </div>
                  <span className="font-black text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    {userModules.filter(m => m.status === "pending").length} <span className="text-[10px] text-zinc-400 font-semibold uppercase">Berkas</span>
                  </span>
                </div>

                <div className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-300 shadow-sm hover:shadow-md cursor-default">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">
                      📥
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-850 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Total Unduhan Karya</h4>
                      <p className="text-[10px] text-zinc-500">Diunduh siswa lain</p>
                    </div>
                  </div>
                  <span className="font-black text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    {userModules.reduce((acc, m) => acc + m.downloads, 0)} <span className="text-[10px] text-zinc-400 font-semibold uppercase">Kali</span>
                  </span>
                </div>

                <div className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-amber-400 dark:hover:border-amber-500 transition-all duration-300 shadow-sm hover:shadow-md cursor-default">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform">
                      📋
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-850 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Soal Latihan Pending</h4>
                      <p className="text-[10px] text-zinc-500">Verifikasi kesulitan</p>
                    </div>
                  </div>
                  <span className="font-black text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    {userQuestions.filter(q => q.status === "pending").length} <span className="text-[10px] text-zinc-400 font-semibold uppercase">Soal</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick info card about Nawasena */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm text-center relative overflow-hidden">
              <span className="text-4xl">🕊️</span>
              <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white mt-3">OSIS NAWASENA SMAN 2 Jonggol</h4>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Platform NAWA-LEARN digagas oleh Divisi ICT OSIS Nawasena SMAN 2 Jonggol untuk mempermudah kolaborasi belajar antar siswa. Terima kasih telah menjadi kontributor aktif!
              </p>
              <div className="border-t border-zinc-100 dark:border-zinc-850 mt-4 pt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                Kabinet Nawasena • Divisi ICT SMAN 2 Jonggol
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 2. Modul Saya Panel */}
      {activeTab === "modules" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-150 dark:border-zinc-850">
            <div>
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                📚 Modul Yang Kamu Unggah
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Daftar lengkap catatan pelajaran, rangkuman, dan modul yang telah kamu kontribusikan.
              </p>
            </div>
            <Link 
              href="/submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
            >
              + Unggah Modul Baru
            </Link>
          </div>

          {userModules.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <span className="text-4xl">📚</span>
              <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-3">Belum ada modul yang diunggah</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                Bagikan modul pelajaranmu sekarang dan dapatkan V-Point dari komunitas NAWA-LEARN.
              </p>
              <Link 
                href="/submit" 
                className="mt-4 inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs px-4.5 py-2.5 rounded-xl font-bold border border-indigo-100 dark:border-indigo-900 transition-all cursor-pointer"
              >
                Mulai Berbagi Sekarang <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {userModules.map((mod) => (
                <div key={mod.id} className="group relative bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col h-full overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/15 transition-all" />
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shadow-sm">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{mod.subject}</span>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-bold text-zinc-600 dark:text-zinc-400">{mod.grade}</span>
                          <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">{mod.category}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      {mod.status === "approved" && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Disetujui
                        </span>
                      )}
                      {mod.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Tinjauan
                        </span>
                      )}
                      {mod.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                          <XCircle className="h-3 w-3" /> Ditolak
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-2 leading-snug relative z-10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {mod.title}
                  </h4>
                  
                  <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 relative z-10">
                    <span className="font-semibold">{new Date(mod.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <Download className="h-3.5 w-3.5 text-indigo-500" /> {mod.downloads} Unduhan
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Soal Saya Panel */}
      {activeTab === "questions" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-150 dark:border-zinc-850">
            <div>
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                📝 Soal Latihan Yang Kamu Buat
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Daftar pertanyaan dan soal latihan ujian yang telah kamu tambahkan ke bank soal sekolah.
              </p>
            </div>
            <Link 
              href="/submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
            >
              + Buat Soal Baru
            </Link>
          </div>

          {userQuestions.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <span className="text-4xl">📝</span>
              <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-3">Belum ada soal yang dibuat</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                Bantu teman-teman berlatih materi dengan membuat pertanyaan pilihan ganda yang bermutu tinggi.
              </p>
              <Link 
                href="/submit" 
                className="mt-4 inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs px-4.5 py-2.5 rounded-xl font-bold border border-indigo-100 dark:border-indigo-900 transition-all cursor-pointer"
              >
                Buat Soal Latihan Sekarang <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userQuestions.map((q) => (
                <div 
                  key={q.id} 
                  className="group relative bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col h-full overflow-hidden text-left"
                >
                  <div className="absolute -right-8 -top-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/15 transition-all" />
                  
                  <div className="flex justify-between items-start gap-4 mb-4 relative z-10">
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black tracking-wider uppercase border shadow-sm
                      ${q.difficulty === "mudah" ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60" : 
                        q.difficulty === "sedang" ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/60" : 
                        "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60"}`}
                    >
                      Kesulitan: {q.difficulty}
                    </span>

                    <div>
                      {q.status === "approved" && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Disetujui
                        </span>
                      )}
                      {q.status === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Tinjauan
                        </span>
                      )}
                      {q.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                          <XCircle className="h-3 w-3" /> Ditolak
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 line-clamp-3 leading-relaxed relative z-10 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors mb-4">
                    "{q.questionText}"
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-semibold relative z-10">
                    <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                      <HelpCircle className="h-3.5 w-3.5 text-emerald-500" /> Kuis CBT
                    </span>
                    <span>{new Date(q.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Riwayat Poin Panel */}
      {activeTab === "logs" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="mb-8 pb-4 border-b border-zinc-150 dark:border-zinc-850 flex items-center justify-between relative z-10">
            <div>
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                <span className="p-1.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Clock className="w-5 h-5" />
                </span>
                Jejak Petualanganmu
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                Riwayat lengkap bagaimana kamu mengumpulkan V-Point di NAWA-LEARN.
              </p>
            </div>
          </div>

          {pointLogs.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/50">
              <span className="text-5xl block animate-bounce">⏱️</span>
              <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-4">Belum ada riwayat perolehan poin</h4>
              <p className="text-xs text-zinc-500 mt-2 max-w-xs mx-auto">
                Unggah modul belajar perdana untuk mengklaim poin pertamamu senilai 50 poin!
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-amber-500/20 dark:border-amber-500/20 pl-6 sm:pl-8 space-y-6 sm:space-y-8 max-w-3xl text-left ml-4 sm:ml-6">
              {pointLogs.map((log) => {
                // Determine format
                let actionText = log.action.replace(/_/g, " ");
                let ActionIcon = Target;
                let iconColor = "text-zinc-500 dark:text-zinc-400";
                let iconBg = "bg-zinc-100 dark:bg-zinc-800";
                
                if (log.action.includes("quiz_completed")) {
                  const diff = log.action.split("_").pop() || "";
                  actionText = `Menyelesaikan Kuis CBT ${diff ? `(${diff.charAt(0).toUpperCase() + diff.slice(1)})` : ""}`;
                  ActionIcon = Target;
                  iconColor = "text-blue-500 dark:text-blue-400";
                  iconBg = "bg-blue-100 dark:bg-blue-900/30 border-blue-500/20";
                } else if (log.action === "module_approved") {
                  actionText = "Modul Berhasil Disetujui";
                  ActionIcon = BookOpen;
                  iconColor = "text-emerald-500 dark:text-emerald-400";
                  iconBg = "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500/20";
                } else if (log.action === "question_approved") {
                  actionText = "Soal CBT Berhasil Disetujui";
                  ActionIcon = Edit3;
                  iconColor = "text-purple-500 dark:text-purple-400";
                  iconBg = "bg-purple-100 dark:bg-purple-900/30 border-purple-500/20";
                } else if (log.action.includes("rejected")) {
                  actionText = log.action.includes("module") ? "Modul Ditolak" : "Soal Ditolak";
                  ActionIcon = XCircle;
                  iconColor = "text-rose-500 dark:text-rose-400";
                  iconBg = "bg-rose-100 dark:bg-rose-900/30 border-rose-500/20";
                } else if (log.action === "module_downloaded") {
                  actionText = "Seseorang Mengunduh Modulmu";
                  ActionIcon = Share2;
                  iconColor = "text-sky-500 dark:text-sky-400";
                  iconBg = "bg-sky-100 dark:bg-sky-900/30 border-sky-500/20";
                } else if (log.action === "daily_login") {
                  actionText = "Login Harian";
                  ActionIcon = Calendar;
                  iconColor = "text-amber-500 dark:text-amber-400";
                  iconBg = "bg-amber-100 dark:bg-amber-900/30 border-amber-500/20";
                }

                const isPositive = log.delta > 0;
                const pointColor = isPositive ? "text-amber-500 dark:text-amber-400" : "text-rose-500 dark:text-rose-400";
                const pointBg = isPositive ? "bg-amber-100/50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50" : "bg-rose-100/50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/50";

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline bullet */}
                    <span className={`absolute -left-[33px] sm:-left-[41px] top-4 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900 
                      ${isPositive ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-500/50" : "bg-gradient-to-br from-rose-400 to-rose-600 shadow-sm shadow-rose-500/50"} 
                      transition-transform duration-300 group-hover:scale-125`} 
                    />

                    <div className="bg-zinc-50/80 hover:bg-white dark:bg-zinc-950/50 dark:hover:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-amber-300/50 dark:hover:border-amber-700/50 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 shadow-sm hover:shadow-md">
                      
                      <div className="flex items-center gap-4">
                        <div className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-[14px] border ${iconBg} ${iconColor} shadow-inner`}>
                          <ActionIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white capitalize">
                            {actionText}
                          </h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold tracking-wide uppercase">
                              {new Date(log.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`shrink-0 self-start sm:self-auto px-4 py-2 rounded-xl border ${pointBg} flex items-center gap-1.5`}>
                        <Star className={`w-3.5 h-3.5 ${pointColor} ${isPositive ? "fill-amber-500/50" : "fill-rose-500/50"}`} />
                        <span className={`font-black text-sm sm:text-base ${pointColor}`}>
                          {isPositive ? `+${log.delta}` : log.delta} Poin
                        </span>
                      </div>
                      
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 🎒 1. EDIT PROFILE MODAL */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-4">
              Sunting Bio & Motto Belajar
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
                    onClick={handleGenerateBio} 
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    🎲 Acak Bio Lucu
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
                onClick={() => setIsEditing(false)}
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
      )}

      {/* 🎒 2. AVATAR PICKER MODAL */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-2">
              Pilih Lencana Avatar Kamu 🏷️
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              Lencana avatar lucu mencerminkan semangat belajarmu di SMAN 2 Jonggol!
            </p>

            <div className="grid grid-cols-4 gap-4 mb-6 max-h-96 overflow-y-auto">
              {AVATAR_OPTIONS.map((av, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectAvatar(av)}
                  className={`group aspect-square rounded-2xl bg-gradient-to-br ${av.bg} flex flex-col items-center justify-center shadow-md border-2 transition-all hover:scale-110 active:scale-95 cursor-pointer overflow-hidden ${
                    (selectedAvatar as any).svg === av.svg || (selectedAvatar as any).emoji === (av as any).emoji
                      ? "border-indigo-600 scale-105 shadow-lg shadow-indigo-600/10" 
                      : "border-transparent"
                  }`}
                  title={av.label}
                >
                  {av.svg ? (
                    <Image src={av.svg} alt={av.label} fill className="object-cover" />
                  ) : (
                    <>
                      <span className="transition-transform group-hover:rotate-6 text-4xl">{(av as any).emoji}</span>
                      <span className="text-[8px] text-white/80 font-black tracking-tighter uppercase mt-1">
                        {av.label.split(" ")[0]}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAvatarPicker(false)}
              className="w-full bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* 🛎️ Cek Status / Notifikasi Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Status & Notifikasi</h3>
                  <p className="text-xs text-zinc-400 font-medium">Lacak status kontribusi modul dan soal Anda</p>
                </div>
              </div>
              <button onClick={() => setShowStatusModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingStatus ? (
                <div className="flex justify-center items-center py-10">
                  <div className="h-6 w-6 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                </div>
              ) : statusData.length === 0 ? (
                <div className="text-center py-10">
                  <AlertCircle className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm font-medium">Belum ada riwayat kontribusi atau laporan.</p>
                </div>
              ) : (
                statusData.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-zinc-800 bg-zinc-800/30 flex flex-col gap-2 relative overflow-hidden group">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-800 px-2 py-0.5 rounded-md mb-1.5 inline-block">
                          {item.type === "module" ? "Modul" : item.type === "question" ? "Soal CBT" : "Laporan"}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-200 leading-snug">{item.title}</h4>
                      </div>
                      <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border ${
                        item.status === "approved" || item.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
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
                        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🚩 Lapor Isu Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
              <div className="flex justify-between items-start mb-2">
                <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
                  <Flag className="h-5 w-5" />
                </div>
                <button onClick={() => setShowReportModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <h3 className="text-xl font-black text-white mt-3">Lapor Isu & Kendala</h3>
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
                  <option value="bug">🐛 Bug Sistem / Error</option>
                  <option value="content">📝 Kesalahan Konten (Modul/Soal)</option>
                  <option value="other">💡 Lainnya / Saran</option>
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
      )}

      {/* 🏆 3. HIGH-FIDELITY APPRECIATION CERTIFICATE MODAL */}
      {showCertificate && (
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
                ID KONTRIBUTOR: {user.id.slice(0, 8).toUpperCase()}-{user.clerkId.slice(-4).toUpperCase()}
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
                onClick={() => setShowCertificate(false)}
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
      )}

    </div>
  );
}
