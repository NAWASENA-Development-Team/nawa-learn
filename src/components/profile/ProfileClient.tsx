// components/profile/ProfileClient.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
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
  Star,
  Crown,
  Flame
} from "lucide-react";
import { BADGES, Badge, getDaysOldAccount, getRarityColor, getRarityTextColor, BadgeUnlockData } from "@/lib/badges";
import { AVATAR_OPTIONS, AvatarOption } from "@/lib/avatars";

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
  
  // Fire-and-forget helper: persist profile changes to DB so other users can see them
  const saveToDb = (data: Partial<{ avatarIndex: number; photoUrl: string | null; bio: string; motto: string }>) => {
    fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(err => console.error('Profile save to DB failed:', err));
  };

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
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(bio);
  const [editMotto, setEditMotto] = useState(motto);
  
  // Certificate state
  const [showCertificate, setShowCertificate] = useState(false);
  
  // Leveling Calculations
  const POINTS_PER_LEVEL = 50;
  const level = Math.floor(user.points / POINTS_PER_LEVEL) + 1;
  const pointsInCurrentLevel = user.points % POINTS_PER_LEVEL;
  const progressPercent = Math.min(100, Math.floor((pointsInCurrentLevel / POINTS_PER_LEVEL) * 100));
  const pointsNeededForNext = POINTS_PER_LEVEL - pointsInCurrentLevel;

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
      alert("Ukuran foto maksimal 2MB!");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCustomPhoto(dataUrl);
      if (typeof window !== "undefined") {
        localStorage.setItem(`nawa_photo_${user.id}`, dataUrl);
      }
      saveToDb({ photoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };
  const handleRemovePhoto = () => {
    setCustomPhoto(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`nawa_photo_${user.id}`);
    }
    saveToDb({ photoUrl: null });
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

  // Get specialty badge for Top 3 (based on contribution type)
  const getSpecialtyBadge = () => {
    if (user.rank > 3) return null;
    const hardQuizzes = pointLogs.filter(l =>
      l.action === "quiz_completed_sulit" || l.action === "quiz_completed_sangat sulit"
    ).length;
    const approvedMods = userModules.filter(m => m.status === "approved").length;
    const quizTotal = pointLogs.filter(l => l.action.startsWith("quiz_completed")).length;
    const diverseSubjects = new Set(userModules.filter(m => m.status === "approved").map(m => m.subject)).size;

    if (hardQuizzes >= 2) return {
      name: "Rule Breaker",
      desc: "Penakluk Ujian Sulit",
      gradient: "from-red-500 via-orange-500 to-yellow-400",
      border: "border-orange-400/50",
      icon: "⚡",
      glow: "shadow-orange-500/40",
    };
    if (approvedMods >= 3) return {
      name: "Grand Archivist",
      desc: "Penjaga Arsip Agung NAWA-LEARN",
      gradient: "from-indigo-500 via-purple-500 to-pink-500",
      border: "border-purple-400/50",
      icon: "📚",
      glow: "shadow-purple-500/40",
    };
    if (diverseSubjects >= 3) return {
      name: "Scholar Prime",
      desc: "Kontributor Multi-Disiplin",
      gradient: "from-emerald-400 via-teal-500 to-cyan-500",
      border: "border-teal-400/50",
      icon: "🧠",
      glow: "shadow-teal-500/40",
    };
    if (quizTotal >= 5) return {
      name: "Quiz Dominator",
      desc: "Maestro Latihan CBT SMAN 2",
      gradient: "from-cyan-500 via-blue-500 to-indigo-600",
      border: "border-cyan-400/50",
      icon: "🎯",
      glow: "shadow-cyan-500/40",
    };
    return {
      name: "Legend Scholar",
      desc: "Legenda Platform NAWA-LEARN",
      gradient: "from-amber-400 via-yellow-400 to-amber-300",
      border: "border-amber-400/50",
      icon: "👑",
      glow: "shadow-amber-400/40",
    };
  };

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
  const specialtyBadge = getSpecialtyBadge();
  const secretAchievement = getSecretAchievement();

  // Save selected avatar
  const handleSelectAvatar = (avatar: AvatarOption) => {
    setSelectedAvatar(avatar);
    setShowAvatarPicker(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(`nawa_avatar_${user.id}`, JSON.stringify(avatar));
    }
    const idx = AVATAR_OPTIONS.findIndex(a => a.svg === avatar.svg);
    if (idx !== -1) saveToDb({ avatarIndex: idx });
  };

  // Generate random bio
  const handleGenerateBio = () => {
    const randomIdx = Math.floor(Math.random() * PLAYFUL_BIOS.length);
    setEditBio(PLAYFUL_BIOS[randomIdx]);
  };

  // Save profile edits
  const handleSaveProfile = () => {
    setBio(editBio);
    setMotto(editMotto);
    setIsEditing(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(`nawa_bio_${user.id}`, editBio);
      localStorage.setItem(`nawa_motto_${user.id}`, editMotto);
    }
    saveToDb({ bio: editBio, motto: editMotto });
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
                <img src={customPhoto} alt="Custom photo" className="w-full h-full object-cover" />
              ) : (selectedAvatar as any).svg ? (
                <img src={(selectedAvatar as any).svg} alt={selectedAvatar.label} className="w-full h-full object-cover" />
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

            {/* Verification / Special Badge */}
            {user.role === "admin" && (
              <span className="absolute -top-3 -right-3 bg-rose-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase border border-rose-400 flex items-center gap-0.5 shadow-md">
                <Shield className="h-3 w-3" /> ADMIN
              </span>
            )}
            {user.role === "moderator" && (
              <span className="absolute -top-3 -right-3 bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase border border-amber-400 flex items-center gap-0.5 shadow-md">
                <UserCheck className="h-3 w-3" /> REVIEWER
              </span>
            )}
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
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {user.name}
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
                  navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "");
                  alert("Link profil berhasil disalin ke clipboard! 📋");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-350 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer"
              >
                <Share2 className="h-4 w-4" /> Bagikan Profil
              </button>
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
      <div className="border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-1 sm:gap-2 mb-8 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-2xl max-w-2xl">
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "summary"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <Sparkles className="h-4 w-4" /> Ringkasan
        </button>
        <button
          onClick={() => setActiveTab("modules")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "modules"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Modul Saya ({userModules.length})
        </button>
        <button
          onClick={() => setActiveTab("questions")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "questions"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
              : "text-zinc-550 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <HelpCircle className="h-4 w-4" /> Soal Saya ({userQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                {(["contribution", "learning", "milestone", "social", "special"] as const).map((category) => {
                  const categoryBadges = BADGES.filter(b => b.category === category);
                  const categoryUnlocked = unlockedBadges.filter(b => b.category === category);
                  
                  const categoryTitles: Record<typeof category, string> = {
                    contribution: "🎁 Lencana Kontribusi",
                    learning: "📚 Lencana Pembelajaran",
                    milestone: "🎯 Lencana Pencapaian",
                    social: "🤝 Lencana Sosial",
                    special: "⭐ Lencana Khusus"
                  };

                  return (
                    <div key={category}>
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                          {categoryTitles[category]}
                        </h3>
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                          {categoryUnlocked.length} / {categoryBadges.length}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {categoryBadges.map((badge) => {
                          const isUnlocked = unlockedBadges.some(b => b.id === badge.id);
                          return (
                            <div
                              key={badge.id}
                              className={`p-4 rounded-2xl border transition-all duration-300 relative group flex gap-3 items-start ${
                                isUnlocked
                                  ? `bg-gradient-to-br ${getRarityColor(badge.rarity)} border-opacity-50 border-white shadow-md hover:shadow-lg`
                                  : "bg-zinc-50/50 dark:bg-zinc-950/40 border-zinc-150 dark:border-zinc-850 opacity-60"
                              }`}
                              title={badge.description}
                            >
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 flex-none ${
                                isUnlocked
                                  ? "bg-white/20 text-white shadow-sm"
                                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                              }`}>
                                {isUnlocked ? badge.icon : <Lock className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />}
                              </div>

                              <div className="text-left flex-1 min-w-0">
                                <h4 className={`font-extrabold text-sm flex items-center gap-1.5 ${
                                  isUnlocked
                                    ? "text-white"
                                    : "text-zinc-950 dark:text-zinc-100"
                                }`}>
                                  {badge.title}
                                  {isUnlocked && <span className="text-xs">✓</span>}
                                </h4>
                                <p className={`text-[11px] mt-0.5 leading-snug ${
                                  isUnlocked
                                    ? "text-white/80"
                                    : "text-zinc-500 dark:text-zinc-400"
                                }`}>
                                  {badge.description}
                                </p>
                                
                                {!isUnlocked && (
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

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📁</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-850 dark:text-zinc-200">Total Modul Pending</h4>
                      <p className="text-[10px] text-zinc-400">Dalam tinjauan OSIS</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                    {userModules.filter(m => m.status === "pending").length} berkas
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📥</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-850 dark:text-zinc-200">Total Unduhan Karya</h4>
                      <p className="text-[10px] text-zinc-400">Diunduh siswa lain</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                    {userModules.reduce((acc, m) => acc + m.downloads, 0)} kali
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">📋</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-850 dark:text-zinc-200">Soal Latihan Pending</h4>
                      <p className="text-[10px] text-zinc-400">Verifikasi kesulitan</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                    {userQuestions.filter(q => q.status === "pending").length} soal
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-bold uppercase">
                    <th className="pb-3 pt-1">Judul Modul</th>
                    <th className="pb-3 pt-1">Pelajaran</th>
                    <th className="pb-3 pt-1">Kelas / Kategori</th>
                    <th className="pb-3 pt-1 text-center">Unduhan</th>
                    <th className="pb-3 pt-1">Status</th>
                    <th className="pb-3 pt-1 text-right">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                  {userModules.map((mod) => (
                    <tr key={mod.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-colors">
                      <td className="py-4 font-bold text-zinc-900 dark:text-zinc-100 max-w-[220px] truncate">
                        {mod.title}
                      </td>
                      <td className="py-4 font-semibold text-indigo-600 dark:text-indigo-400">
                        {mod.subject}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-lg text-zinc-600 dark:text-zinc-450 font-bold">
                            {mod.grade}
                          </span>
                          <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 px-2 py-0.5 rounded-lg text-indigo-700 dark:text-indigo-400 font-bold">
                            {mod.category}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-center font-bold text-zinc-700 dark:text-zinc-300">
                        {mod.downloads}
                      </td>
                      <td className="py-4">
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
                      </td>
                      <td className="py-4 text-right text-zinc-400 text-xs font-semibold">
                        {new Date(mod.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <div className="space-y-4">
              {userQuestions.map((q) => (
                <div 
                  key={q.id} 
                  className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-indigo-400 transition-all bg-zinc-50/30 dark:bg-zinc-950/20 text-left"
                >
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[10px] font-bold border uppercase
                      ${q.difficulty === "mudah" ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-450 dark:border-emerald-900/40" : 
                        q.difficulty === "sedang" ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-450 dark:border-amber-900/40" : 
                        "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-450 dark:border-rose-900/40"}`}
                    >
                      Kesulitan: {q.difficulty}
                    </span>

                    <div className="flex items-center gap-2">
                      {q.status === "approved" && (
                        <span className="inline-flex items-center gap-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                          Disetujui
                        </span>
                      )}
                      {q.status === "pending" && (
                        <span className="inline-flex items-center gap-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
                          Tinjauan
                        </span>
                      )}
                      {q.status === "rejected" && (
                        <span className="inline-flex items-center gap-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 px-2 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-400">
                          Ditolak
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400 font-semibold">
                        {new Date(q.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>

                  <p className="font-semibold text-zinc-900 dark:text-zinc-150 line-clamp-2">
                    {q.questionText}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Riwayat Poin Panel */}
      {activeTab === "logs" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="mb-6 pb-4 border-b border-zinc-150 dark:border-zinc-850">
            <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white">
              ⏱️ Catatan Riwayat Perolehan Poin
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Riwayat lengkap kapan dan bagaimana kamu mendapatkan V-Point di platform.
            </p>
          </div>

          {pointLogs.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
              <span className="text-4xl">⏱️</span>
              <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-3">Belum ada riwayat perolehan poin</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                Unggah modul belajar perdana untuk mengklaim poin pertamamu senilai 50 poin!
              </p>
            </div>
          ) : (
            <div className="relative border-l border-zinc-200 dark:border-zinc-800 pl-6 space-y-6 max-w-3xl text-left ml-4">
              {pointLogs.map((log) => (
                <div key={log.id} className="relative">
                  {/* Timeline bullet */}
                  <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900 
                    ${log.delta > 0 ? "bg-amber-500" : "bg-rose-500"}`} 
                  />

                  <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-zinc-850 dark:text-zinc-100">
                        {log.action}
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-semibold mt-1">
                        {new Date(log.createdAt).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} WIB
                      </p>
                    </div>

                    <span className={`font-black text-lg ${log.delta > 0 ? "text-amber-500 dark:text-amber-400" : "text-rose-500"}`}>
                      {log.delta > 0 ? `+${log.delta}` : log.delta} Poin
                    </span>
                  </div>
                </div>
              ))}
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
                    <img src={av.svg} alt={av.label} className="w-full h-full object-cover" />
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

      {/* 🏆 3. HIGH-FIDELITY APPRECIATION CERTIFICATE MODAL */}
      {showCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300">
          <div className="max-w-3xl w-full bg-white text-zinc-900 border-8 border-amber-500/80 p-6 sm:p-10 rounded-2xl shadow-2xl relative flex flex-col items-center justify-between text-center select-none overflow-hidden my-8 animate-in zoom-in-95 duration-300">
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
            <div className="relative z-10 mt-10 pt-4 border-t border-zinc-150 w-full flex items-center justify-between max-w-xl text-xs gap-3">
              <button
                onClick={() => setShowCertificate(false)}
                className="bg-zinc-200 hover:bg-zinc-250 text-zinc-700 font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
              >
                Kembali Ke Profil
              </button>

              <button
                onClick={() => {
                  window.print();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer border border-indigo-700"
              >
                <Download className="h-4 w-4" /> Cetak / Unduh Sertifikat
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
