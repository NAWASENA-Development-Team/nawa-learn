"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { 
  Map as MapIcon, 
  BookOpen, 
  Play, 
  Award, 
  ArrowRight, 
  CheckCircle2, 
  Search,
  BookMarked,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import { AVATAR_OPTIONS } from "@/lib/avatars";

interface ModuleData {
  id: string;
  title: string;
  subject: string;
  grade: string;
  category: string;
  downloads: number;
  createdAt: Date;
}

interface TopContributor {
  id: string;
  name: string;
  points: number;
  avatarIndex: number | null;
  photoUrl: string | null;
}

interface PathsClientProps {
  allModules: ModuleData[];
  topContributors: TopContributor[];
}

export default function PathsClient({ allModules, topContributors }: PathsClientProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>("Semua Kelas");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Last read module tracking
  const [lastReadId, setLastReadId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nawa_last_read_module");
      if (saved) setLastReadId(saved);
    }
  }, []);

  const lastReadModule = useMemo(() => {
    if (!lastReadId) return null;
    return allModules.find(m => m.id === lastReadId) || null;
  }, [allModules, lastReadId]);

  // Extract unique grades
  const grades = useMemo(() => {
    const g = new Set(allModules.map(m => m.grade));
    return ["Semua Kelas", ...Array.from(g).sort()];
  }, [allModules]);

  // Group modules by Subject
  const filteredModules = useMemo(() => {
    return allModules.filter(m => {
      const matchGrade = selectedGrade === "Semua Kelas" || m.grade === selectedGrade;
      const matchSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchGrade && matchSearch;
    });
  }, [allModules, selectedGrade, searchQuery]);

  const pathsBySubject = useMemo(() => {
    const grouped = new Map<string, ModuleData[]>();
    filteredModules.forEach(m => {
      if (!grouped.has(m.subject)) {
        grouped.set(m.subject, []);
      }
      grouped.get(m.subject)!.push(m);
    });
    
    // Sort each subject's modules by category then chronologically
    grouped.forEach((mods, subject) => {
      mods.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    });

    return Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredModules]);

  // Avatar helper
  const getAvatar = (user: TopContributor) => {
    const avatar = user.avatarIndex !== null && user.avatarIndex !== undefined
        ? (AVATAR_OPTIONS[user.avatarIndex] ?? AVATAR_OPTIONS[user.points % AVATAR_OPTIONS.length])
        : AVATAR_OPTIONS[user.points % AVATAR_OPTIONS.length];
    return { avatar, photo: user.photoUrl ?? null };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="mb-10 text-center relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent p-8 sm:p-10 border border-indigo-100/50 dark:border-zinc-800/80 rounded-3xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-400 text-xs px-3 py-1 rounded-full font-bold mb-4 border border-indigo-200/60 dark:border-indigo-900/40">
            <MapIcon className="h-3.5 w-3.5" /> Struktur Kurikulum NAWA
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-white mt-1">
            Jalur Belajar <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">Terarah</span> 🎯
          </h1>
          
          <p className="mt-3 text-sm sm:text-base text-zinc-650 dark:text-zinc-400 leading-relaxed max-w-2xl">
            Pilih kelas dan mata pelajaranmu. Belajar lebih terstruktur dari modul dasar hingga lanjutan yang disusun oleh kontributor terbaik SMAN 2 Jonggol.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column: Continue Learning & Contributors */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Continue Learning Widget */}
          {lastReadModule && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                <Play className="h-10 w-10 text-indigo-500" />
              </div>
              <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Lanjutkan Belajar
              </h3>
              <p className="text-[10px] font-bold text-zinc-400 uppercase bg-zinc-100 dark:bg-zinc-800 inline-block px-2 py-0.5 rounded-full mb-2">
                {lastReadModule.subject} • {lastReadModule.grade}
              </p>
              <h4 className="font-bold text-zinc-900 dark:text-white text-sm line-clamp-2 mb-4">
                {lastReadModule.title}
              </h4>
              <Link 
                href={`/modules?search=${encodeURIComponent(lastReadModule.title)}`}
                className="w-full inline-flex justify-center items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-95"
              >
                Lanjutkan <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Top Contributors Widget */}
          <div className="bg-gradient-to-b from-amber-50 to-white dark:from-zinc-900 dark:to-zinc-950 rounded-3xl p-5 border border-amber-200/60 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xs font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Kontributor Path
            </h3>
            <div className="space-y-3">
              {topContributors.map((user, idx) => {
                const { avatar, photo } = getAvatar(user);
                return (
                  <Link key={user.id} href={`/profile/${user.id}`} className="flex items-center gap-3 hover:bg-white dark:hover:bg-zinc-800 p-2 -mx-2 rounded-xl transition-colors">
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm border border-zinc-200 dark:border-zinc-700">
                      {photo ? (
                        <Image src={photo} alt={user.name} fill className="object-cover" />
                      ) : (avatar as any).svg ? (
                        <Image src={(avatar as any).svg} alt={avatar.label} fill className="object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${avatar.bg} flex items-center justify-center text-sm`}>
                          {(avatar as any).emoji}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{user.name}</h4>
                      <p className="text-[10px] text-zinc-500 truncate">{user.points} V-Points</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Main Paths */}
        <div className="lg:col-span-3">
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex overflow-x-auto gap-2 pb-2 sm:pb-0 hide-scrollbar flex-1">
              {grades.map(grade => (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                    selectedGrade === grade 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" 
                      : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Cari materi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 pl-9 pr-4 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Paths Grid */}
          {pathsBySubject.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 border-dashed">
              <BookMarked className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Belum Ada Materi</h3>
              <p className="text-sm text-zinc-500 mt-2">Tidak ada jalur belajar yang cocok dengan filter Anda.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pathsBySubject.map(([subject, modules]) => (
                <div key={subject} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Subject Header */}
                  <div className="bg-zinc-50 dark:bg-zinc-950/50 p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        {subject}
                      </h2>
                      <p className="text-xs text-zinc-500 font-medium mt-1">
                        {modules.length} Modul Terstruktur
                      </p>
                    </div>
                    <div className="bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 h-10 w-10 rounded-2xl flex items-center justify-center font-black text-sm border border-indigo-200/50 dark:border-indigo-900/50">
                      {modules.length}
                    </div>
                  </div>

                  {/* Modules Timeline */}
                  <div className="p-5 sm:p-6 relative">
                    <div className="absolute left-[39px] sm:left-[43px] top-6 bottom-6 w-0.5 bg-zinc-200 dark:bg-zinc-800" />
                    
                    <div className="space-y-6 relative">
                      {modules.map((module, idx) => (
                        <div key={module.id} className="flex gap-4 group">
                          {/* Timeline dot */}
                          <div className="relative flex flex-col items-center mt-1 shrink-0">
                            <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border-2 border-indigo-500 dark:border-indigo-400 flex items-center justify-center z-10 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                              {idx + 1}
                            </div>
                          </div>
                          
                          {/* Module Card */}
                          <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl p-4 border border-zinc-200/50 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-colors group-hover:bg-white dark:group-hover:bg-zinc-800/80 shadow-sm cursor-pointer"
                               onClick={() => {
                                 // Save to local storage for "Continue Learning"
                                 if (typeof window !== "undefined") {
                                   localStorage.setItem("nawa_last_read_module", module.id);
                                 }
                                 window.location.href = `/modules?search=${encodeURIComponent(module.title)}`;
                               }}>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-[9px] uppercase tracking-wider font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded">
                                {module.category}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded">
                                {module.grade}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {module.title}
                            </h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
