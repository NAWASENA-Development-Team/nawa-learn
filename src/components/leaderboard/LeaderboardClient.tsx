// components/leaderboard/LeaderboardClient.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Trophy, 
  Search, 
  Sparkles, 
  Award, 
  Crown, 
  Smile,
  ArrowRight
} from "lucide-react";
import { AVATAR_OPTIONS, AvatarOption } from "@/lib/avatars";

interface LeaderboardUser {
  id: string;
  name: string;
  points: number;
  avatarIndex: number | null;
  photoUrl: string | null;
}

interface LoggedInUserStats {
  id: string;
  name: string;
  points: number;
  rank: number;
  avatarIndex: number | null;
  photoUrl: string | null;
}

interface LeaderboardClientProps {
  topUsers: LeaderboardUser[];
  loggedInUser: LoggedInUserStats | null;
  totalStudents: number;
}

export default function LeaderboardClient({ 
  topUsers, 
  loggedInUser, 
  totalStudents 
}: LeaderboardClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "top3" | "top10">("all");

  // Resolve avatar + photo for a user using DB data (no localStorage needed)
  const getPodiumAvatar = (user: LeaderboardUser): { avatar: AvatarOption; photo: string | null } => {
    const avatar =
      user.avatarIndex !== null && user.avatarIndex !== undefined
        ? (AVATAR_OPTIONS[user.avatarIndex] ?? AVATAR_OPTIONS[user.points % AVATAR_OPTIONS.length])
        : AVATAR_OPTIONS[user.points % AVATAR_OPTIONS.length];
    return { avatar, photo: user.photoUrl ?? null };
  };

  // ── Helpers matching ProfileClient ──

  // Calculate Level
  const getLevel = (points: number) => Math.floor(points / 50) + 1;

  // Gelar Belajar (matches ProfileClient.getPlayfulRankTitle by level)
  const getPlayfulTitle = (points: number) => {
    const lvl = getLevel(points);
    if (lvl >= 10) return "Cendekiawan Agung 🔮";
    if (lvl >= 7)  return "Ksatria Buku Senior 🧙‍♂️";
    if (lvl >= 4)  return "Pakar Modul Sekolah 🧠";
    if (lvl >= 2)  return "Prajurit Belajar Aktif ⚡";
    return "Pemula Berbakat 🌱";
  };

  // Specialty badge for Top-3 podium (points-based, matches ProfileClient.getSpecialtyBadge fallback chain)
  const getPodiumBadge = (points: number) => {
    if (points >= 300) return {
      name: "Grand Archivist", desc: "Penjaga Arsip Agung NAWA-LEARN",
      gradient: "from-indigo-500 via-purple-500 to-pink-500",
      border: "border-purple-400/50", icon: "📚", glow: "shadow-purple-500/40",
    };
    if (points >= 200) return {
      name: "Scholar Prime", desc: "Kontributor Multi-Disiplin",
      gradient: "from-emerald-400 via-teal-500 to-cyan-500",
      border: "border-teal-400/50", icon: "🧠", glow: "shadow-teal-500/40",
    };
    if (points >= 100) return {
      name: "Quiz Dominator", desc: "Maestro Latihan CBT SMAN 2",
      gradient: "from-cyan-500 via-blue-500 to-indigo-600",
      border: "border-cyan-400/50", icon: "🎯", glow: "shadow-cyan-500/40",
    };
    return {
      name: "Legend Scholar", desc: "Legenda Platform NAWA-LEARN",
      gradient: "from-amber-400 via-yellow-400 to-amber-300",
      border: "border-amber-400/50", icon: "👑", glow: "shadow-amber-400/40",
    };
  };

  // Avatar frame gradient (matches ProfileClient.getAvatarFrame gradient)
  const podiumFrameGradient = (rank: number) => {
    if (rank === 1) return "from-amber-400 via-yellow-300 to-amber-500";
    if (rank <= 3)  return "from-amber-300 via-orange-200 to-amber-400";
    return "from-purple-400 via-fuchsia-400 to-purple-600";
  };

  // Podium Data (Top 3)
  const podiumData = useMemo(() => {
    const first  = topUsers[0] || null;
    const second = topUsers[1] || null;
    const third  = topUsers[2] || null;
    return { first, second, third };
  }, [topUsers]);

  // Rest of the list (Rank 4+)
  const restUsers = useMemo(() => topUsers.slice(3), [topUsers]);

  // Filter & Search Logic
  const filteredUsers = useMemo(() => {
    return topUsers.filter((user, index) => {
      const rank = index + 1;
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (filterType === "top3") {
        return matchesSearch && rank <= 3;
      }
      if (filterType === "top10") {
        return matchesSearch && rank <= 10;
      }
      return matchesSearch;
    });
  }, [topUsers, searchQuery, filterType]);

  // Interactive user rank comparison card text
  const userRankMessage = useMemo(() => {
    if (!loggedInUser) return null;
    const isTop10 = loggedInUser.rank <= 10;
    
    if (loggedInUser.points === 0) {
      return {
        text: "Kamu belum terdaftar di papan peringkat karena belum mengunggah materi belajar. Mulai bagikan modul pertamamu untuk unjuk gigi! 🚀",
        emoji: "🌱"
      };
    }
    
    if (loggedInUser.rank === 1) {
      return {
        text: "Luar biasa! Kamu memegang takhta tertinggi di SMAN 2 Jonggol! Pertahankan prestasimu dan terus bantu teman-teman belajar! 👑🔥",
        emoji: "👑"
      };
    }
    
    if (isTop10) {
      return {
        text: `Keren! Kamu mantap berada di peringkat 10 besar (#${loggedInUser.rank} sekolah). Sedikit usaha lagi untuk merebut podium teratas! 🌟⚡`,
        emoji: "🏆"
      };
    }

    // Find points needed to catch up the person right ahead
    const personAhead = topUsers[loggedInUser.rank - 2];
    const pointsNeeded = personAhead ? (personAhead.points - loggedInUser.points) + 5 : 10;

    return {
      text: `Kamu berada di peringkat #${loggedInUser.rank} dari ${totalStudents} siswa. Hanya butuh sekitar +${pointsNeeded} poin lagi untuk menyalip peringkat di atasmu! Semangat kontribusi! 💪🚀`,
      emoji: "🔥"
    };
  }, [loggedInUser, topUsers, totalStudents]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* 🚀 Playful Banner Header */}
      <div className="mb-10 text-center relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent p-8 sm:p-10 border border-amber-100/50 dark:border-zinc-800/80 rounded-3xl">
        {/* Glow circles backgrounds */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 text-xs px-3 py-1 rounded-full font-bold mb-4 border border-amber-200/60 dark:border-amber-900/40">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Papan Skor Apresiasi OSIS Nawasena
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-white mt-1">
            Rebut Takhta <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">Leaderboard!</span> ⚡
          </h1>
          
          <p className="mt-3 text-sm sm:text-base text-zinc-650 dark:text-zinc-400 leading-relaxed max-w-2xl">
            Apresiasi eksklusif untuk kontributor modul ringkasan catatan estetik dan pembuat latihan soal terseru di SMAN 2 Jonggol. Bagikan ilmumu, kumpulkan poin, dan naikkan level scholarmu!
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs font-semibold text-zinc-550 dark:text-zinc-400">
            <span className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
              📁 +50 Poin / Modul Disetujui
            </span>
            <span className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
              📋 +20 Poin / Soal Disetujui
            </span>
          </div>
        </div>
      </div>

      {/* 🏆 Juara Podium — Profile-style avatar + frame + specialty badge */}
      {topUsers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end max-w-4xl mx-auto mb-14 px-2 sm:px-0">

          {/* ─── Helper: renders a single podium card ─────────────────── */}
          {/* Rank 2 — Left */}
          {podiumData.second && (() => {
            const u = podiumData.second;
            const { avatar, photo } = getPodiumAvatar(u);
            const badge = getPodiumBadge(u.points);
            const lvl = getLevel(u.points);
            return (
              <div className="order-2 md:order-1 flex flex-col items-center gap-3 group">

                {/* Floating rank label */}
                <div className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest shadow">
                  🥈 Peringkat 2
                </div>

                {/* Avatar with spinning profile frame */}
                <div className="relative">
                  <div className={`absolute -inset-2 rounded-[26px] bg-gradient-to-br ${podiumFrameGradient(2)} opacity-80`} />
                  <div className={`relative w-24 h-24 rounded-[22px] bg-gradient-to-br ${avatar.bg} flex items-center justify-center shadow-xl border-4 border-white/10 overflow-hidden shadow-zinc-400/30 z-10 transition-transform duration-300 group-hover:scale-105`}>
                    {photo
                      ? <img src={photo} alt="foto" className="w-full h-full object-cover" />
                      : (avatar as any).svg
                        ? <img src={(avatar as any).svg} alt={avatar.label} className="w-full h-full object-cover" />
                        : <span className="text-5xl">{(avatar as any).emoji}</span>
                    }
                  </div>
                </div>

                {/* Specialty badge pill */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${badge.gradient} border ${badge.border} shadow-lg ${badge.glow}`}>
                  <span className="text-sm">{badge.icon}</span>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white tracking-wider uppercase leading-none">{badge.name}</p>
                    <p className="text-[8px] text-white/70 font-semibold leading-none mt-0.5">{badge.desc}</p>
                  </div>
                </div>

                {/* Info card */}
                <div className="w-full text-center p-5 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-md flex flex-col items-center relative overflow-hidden hover:border-zinc-350 dark:hover:border-zinc-700 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-zinc-400/5 rounded-full blur-xl pointer-events-none" />
                  <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 truncate max-w-[160px] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <Link href={`/profile/${u.id}`}>{u.name}</Link>
                  </h3>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full mt-1.5 border border-zinc-200 dark:border-zinc-700">
                    Level {lvl}
                  </span>
                  <p className="text-[9px] text-zinc-400 font-medium mt-1">{getPlayfulTitle(u.points)}</p>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-zinc-700 dark:text-zinc-300">{u.points}</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-400 block mt-0.5">V-POINT</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── Rank 1 — Center (tallest, golden) ─────────────────────── */}
          {podiumData.first && (() => {
            const u = podiumData.first;
            const { avatar, photo } = getPodiumAvatar(u);
            const badge = getPodiumBadge(u.points);
            const lvl = getLevel(u.points);
            return (
              <div className="order-1 md:order-2 flex flex-col items-center gap-3 group">

                {/* Floating crown */}
                <div className="animate-bounce mb-0">
                  <Crown className="h-8 w-8 text-yellow-500 drop-shadow-lg" />
                </div>

                {/* Rank label */}
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-900 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest shadow border border-yellow-400 animate-pulse">
                  👑 CHAMPION
                </div>

                {/* Avatar with spinning amber frame */}
                <div className="relative">
                  <div className={`absolute -inset-2.5 rounded-[30px] bg-gradient-to-br ${podiumFrameGradient(1)} animate-[spin_4s_linear_infinite] opacity-80`} />
                  <div className={`relative w-28 h-28 rounded-[24px] bg-gradient-to-br ${avatar.bg} flex items-center justify-center shadow-2xl border-4 border-white/10 overflow-hidden shadow-yellow-500/30 z-10 transition-transform duration-300 group-hover:scale-105`}>
                    {photo
                      ? <img src={photo} alt="foto" className="w-full h-full object-cover" />
                      : (avatar as any).svg
                        ? <img src={(avatar as any).svg} alt={avatar.label} className="w-full h-full object-cover" />
                        : <span className="text-6xl">{(avatar as any).emoji}</span>
                    }
                  </div>
                  {/* #1 badge overlaid */}
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-zinc-900 font-black text-[9px] px-2 py-0.5 rounded-lg border border-yellow-300 shadow-md z-20 uppercase tracking-wide">
                    #1 🏆
                  </div>
                </div>

                {/* Specialty badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${badge.gradient} border ${badge.border} shadow-lg ${badge.glow}`}>
                  <span className="text-base">{badge.icon}</span>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white tracking-wider uppercase leading-none">{badge.name}</p>
                    <p className="text-[8px] text-white/70 font-semibold leading-none mt-0.5">{badge.desc}</p>
                  </div>
                  <Sparkles className="h-3 w-3 text-white/80 animate-pulse" />
                </div>

                {/* Info card */}
                <div className="w-full text-center p-6 bg-gradient-to-b from-amber-500/10 via-yellow-400/5 to-transparent border-2 border-yellow-400/80 dark:border-yellow-500/40 rounded-3xl shadow-xl flex flex-col items-center relative overflow-hidden hover:border-yellow-400 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/[0.05] rounded-full blur-xl pointer-events-none" />
                  <h3 className="font-black text-lg text-zinc-900 dark:text-white truncate max-w-[200px] hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                    <Link href={`/profile/${u.id}`}>{u.name}</Link>
                  </h3>
                  <span className="text-[10px] text-amber-900 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full mt-1.5 border border-amber-200/50 dark:border-amber-900/50">
                    Level {lvl}
                  </span>
                  <p className="text-[9px] text-amber-800 dark:text-amber-500 font-bold mt-1">{getPlayfulTitle(u.points)}</p>
                  <div className="mt-3">
                    <span className="text-3xl font-black text-amber-600 dark:text-yellow-500">{u.points}</span>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-500 block mt-0.5">V-POINT</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── Rank 3 — Right ─────────────────────────────────────────── */}
          {podiumData.third && (() => {
            const u = podiumData.third;
            const { avatar, photo } = getPodiumAvatar(u);
            const badge = getPodiumBadge(u.points);
            const lvl = getLevel(u.points);
            return (
              <div className="order-3 flex flex-col items-center gap-3 group">

                {/* Floating rank label */}
                <div className="bg-orange-100 dark:bg-orange-950/50 text-orange-900 dark:text-orange-300 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest shadow border border-orange-200/60 dark:border-orange-900/40">
                  🥉 Peringkat 3
                </div>

                {/* Avatar with amber frame */}
                <div className="relative">
                  <div className={`absolute -inset-2 rounded-[26px] bg-gradient-to-br ${podiumFrameGradient(3)} opacity-80`} />
                  <div className={`relative w-24 h-24 rounded-[22px] bg-gradient-to-br ${avatar.bg} flex items-center justify-center shadow-xl border-4 border-white/10 overflow-hidden shadow-orange-400/20 z-10 transition-transform duration-300 group-hover:scale-105`}>
                    {photo
                      ? <img src={photo} alt="foto" className="w-full h-full object-cover" />
                      : (avatar as any).svg
                        ? <img src={(avatar as any).svg} alt={avatar.label} className="w-full h-full object-cover" />
                        : <span className="text-5xl">{(avatar as any).emoji}</span>
                    }
                  </div>
                </div>

                {/* Specialty badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${badge.gradient} border ${badge.border} shadow-lg ${badge.glow}`}>
                  <span className="text-sm">{badge.icon}</span>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white tracking-wider uppercase leading-none">{badge.name}</p>
                    <p className="text-[8px] text-white/70 font-semibold leading-none mt-0.5">{badge.desc}</p>
                  </div>
                </div>

                {/* Info card */}
                <div className="w-full text-center p-5 bg-gradient-to-b from-orange-50 to-white dark:from-zinc-900 dark:to-zinc-950 border-2 border-orange-200/60 dark:border-zinc-800 rounded-3xl shadow-md flex flex-col items-center relative overflow-hidden hover:border-orange-300 dark:hover:border-zinc-700 transition-all duration-300">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-orange-400/5 rounded-full blur-xl pointer-events-none" />
                  <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 truncate max-w-[160px] hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <Link href={`/profile/${u.id}`}>{u.name}</Link>
                  </h3>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full mt-1.5 border border-zinc-200 dark:border-zinc-700">
                    Level {lvl}
                  </span>
                  <p className="text-[9px] text-zinc-400 font-medium mt-1">{getPlayfulTitle(u.points)}</p>
                  <div className="mt-3">
                    <span className="text-2xl font-black text-orange-700 dark:text-orange-400">{u.points}</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-orange-400 block mt-0.5">V-POINT</span>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      )}

      {/* 🔍 Search and Filters Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Cari kontributor sekolah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-9 pr-4 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-500 dark:text-white transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 bg-zinc-50 dark:bg-zinc-950 p-1 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full sm:w-auto overflow-x-auto shrink-0">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
              filterType === "all"
                ? "bg-white dark:bg-zinc-850 text-amber-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Semua Siswa
          </button>
          <button
            onClick={() => setFilterType("top10")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
              filterType === "top10"
                ? "bg-white dark:bg-zinc-850 text-amber-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Top 10 Besar
          </button>
          <button
            onClick={() => setFilterType("top3")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
              filterType === "top3"
                ? "bg-white dark:bg-zinc-850 text-amber-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-800"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Juara Podium 🏆
          </button>
        </div>
      </div>

      {/* 📋 Dynamic Leaderboard List (Rank 4+) */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-left">
          
          {/* Header titles */}
          <div className="grid grid-cols-12 p-4 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
            <div className="col-span-2 sm:col-span-1 text-center">POSISI</div>
            <div className="col-span-7 sm:col-span-8 pl-2">KONTRIBUTOR</div>
            <div className="col-span-3 text-right pr-4">V-POINT</div>
          </div>

          {filteredUsers.map((user, index) => {
            const rank = index + 1;
            const isPodium = rank <= 3;
            const isTop10 = rank <= 10;
            const isTop50 = rank <= 50;

            // Row accent: border-left color based on tier
            const rowAccent = loggedInUser && loggedInUser.id === user.id
              ? "bg-amber-500/5 dark:bg-amber-500/5 border-l-4 border-amber-500"
              : rank === 1
                ? "border-l-4 border-yellow-400"
                : rank === 2
                  ? "border-l-4 border-zinc-400"
                  : rank === 3
                    ? "border-l-4 border-orange-400"
                    : isTop10
                      ? "border-l-4 border-purple-400/60"
                      : isTop50
                        ? "border-l-4 border-cyan-400/40"
                        : "";

            // Frame pill label for special tiers
            const framePill = rank === 1
              ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-900 ml-1 shrink-0 animate-pulse">GOLD</span>
              : rank <= 3
                ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-400 to-amber-500 text-white ml-1 shrink-0">TOP 3</span>
                : isTop10
                  ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-purple-500 to-indigo-500 text-white ml-1 shrink-0">TOP 10</span>
                  : isTop50
                    ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-cyan-500 to-teal-500 text-white ml-1 shrink-0">TOP 50</span>
                    : null;
            
            return (
              <div 
                key={user.id} 
                className={`grid grid-cols-12 items-center p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group ${rowAccent}`}
              >
                {/* Position column */}
                <div className="col-span-2 sm:col-span-1 flex justify-center">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-xs sm:text-sm
                    ${rank === 1 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500" : 
                      rank === 2 ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400" : 
                      rank === 3 ? "bg-orange-100 text-orange-850 dark:bg-orange-900/30 dark:text-orange-500" : 
                      isTop10 ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                      isTop50 ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" :
                      "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-650"}`}
                  >
                    {rank}
                  </div>
                </div>

                {/* Name & Details column */}
                <div className="col-span-7 sm:col-span-8 pl-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <div className="flex items-center gap-1">
                      <h3 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <Link href={`/profile/${user.id}`}>
                          {user.name}
                        </Link>
                      </h3>
                      {framePill}
                    </div>
                    
                    <div className="flex gap-1.5 items-center">
                      <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded text-zinc-550 dark:text-zinc-400 font-bold shrink-0">
                        Level {getLevel(user.points)}
                      </span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium truncate hidden md:inline">
                        • {getPlayfulTitle(user.points)}
                      </span>
                    </div>

                    {loggedInUser && loggedInUser.id === user.id && (
                      <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[8px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase border border-amber-200/50 dark:border-amber-900/40 w-fit shrink-0">
                        Kamu
                      </span>
                    )}
                  </div>
                </div>

                {/* Points column */}
                <div className="col-span-3 text-right pr-4">
                  <div className={`text-lg sm:text-xl font-black ${
                    isPodium 
                      ? "text-amber-600 dark:text-yellow-500" 
                      : isTop10
                        ? "text-purple-600 dark:text-purple-400"
                        : isTop50
                          ? "text-cyan-600 dark:text-cyan-400"
                          : "text-indigo-600 dark:text-indigo-500 group-hover:scale-105 transition-transform"
                  }`}>
                    {user.points}
                  </div>
                  <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">
                    Poin
                  </div>
                </div>

              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="p-12 text-center text-zinc-500">
              <Smile className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
              Belum ada data kontributor yang cocok dengan pencarian Anda.
            </div>
          )}
        </div>
      </div>

      {/* 🔔 Gamified rule card / encouragement banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg shadow-indigo-500/10 mb-12">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="text-center sm:text-left relative z-10">
          <span className="bg-white/20 text-white font-bold text-[10px] px-2.5 py-1 rounded-full uppercase border border-white/10 tracking-widest">INGIN MASUK PODIUM?</span>
          <h4 className="text-xl sm:text-2xl font-black mt-3">Tulis & Bagikan Modul Belajarmu!</h4>
          <p className="text-xs text-indigo-100 mt-1 max-w-sm sm:max-w-md leading-relaxed">
            Dapatkan poin dari setiap modul atau soal yang disetujui reviewer. Modul sains dan materi UTBK sangat disukai teman-temanmu!
          </p>
        </div>
        <Link 
          href="/submit"
          className="shrink-0 bg-white hover:bg-zinc-100 text-indigo-700 font-black text-xs px-5 py-3.5 rounded-2xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
        >
          Unggah Karya Sekarang <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* 🚨 4. Personalized Logged-in User Info Overlay Banner (Sticky / Float at the bottom if logged in) */}
      {userRankMessage && (
        <div className="sticky bottom-6 left-0 right-0 max-w-4xl mx-auto z-40 px-4">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-amber-300 dark:border-amber-900/40 p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center gap-4 justify-between animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <span className="text-3xl shrink-0">{userRankMessage.emoji}</span>
              <div>
                <h4 className="font-extrabold text-xs text-zinc-500 uppercase tracking-widest">Kabar Peringkat Kamu</h4>
                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1 leading-normal sm:leading-relaxed">
                  {userRankMessage.text}
                </p>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              <Link
                href="/profile"
                className="w-full sm:w-auto text-center bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 whitespace-nowrap"
              >
                Lihat Profil Saya
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
