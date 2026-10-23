// components/modules/ModulesLibraryClient.tsx
"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Search,
  BookOpen,
  Download,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Filter,
  ArrowRight,
  SlidersHorizontal,
  GraduationCap,
  Bookmark,
  BookmarkCheck,
  AlertTriangle,
} from "lucide-react";
import ModuleReader from "@/components/modules/ModuleReader";
import type { ModuleSource } from "@/lib/moduleSource";

interface Module {
  id: string;
  title: string;
  subject: string;
  grade: string;
  category: string;
  downloads: number;
  uploaderName: string | null;
  createdAt: string; // ISO string from server
  /**
   * Bagaimana modul ini dibaca — ditentukan di server oleh `resolveModuleSource`.
   *
   * Sebelum M21 komponen ini memegang `contentUrl` mentah, termasuk tiga PDF
   * base64 sepanjang ±1 MB yang ikut di payload halaman. Sekarang halaman hanya
   * mengirim deskriptor kecil (`kind` + `src`), dan `src` untuk baris lama adalah
   * rute `/api/modules/<id>/file` — bukan isi filenya.
   */
  source: ModuleSource;
}

interface ModulesLibraryClientProps {
  initialModules: Module[];
  /**
   * The reader's own bookmarked module ids, read from the database by the page.
   *
   * These used to come from a single global `localStorage` key (`nawa_bookmarks`)
   * with no user id in it, so on a shared school computer one student opened the
   * library and saw another student's saved modules. Bookmarks belong to an
   * account, so the server is the only place that can answer this.
   */
  initialBookmarkedIds: string[];
}

export default function ModulesLibraryClient({
  initialModules,
  initialBookmarkedIds,
}: ModulesLibraryClientProps) {
  const [modulesList, setModulesList] = useState<Module[]>(initialModules);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [selectedGrade, setSelectedGrade] = useState<string>("Semua");
  const [sortBy, setSortBy] = useState<"newest" | "downloads">("newest");

  // Reader Modal State
  const [selectedReaderModule, setSelectedReaderModule] = useState<Module | null>(null);

  // ─── Bookmark State ─────────────────────────────────────────────────────────────
  // Seeded from the server, not from `localStorage`: lihat catatan pada prop
  // `initialBookmarkedIds`.
  const [bookmarks, setBookmarks] = useState<string[]>(initialBookmarkedIds);
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

  /**
   * Kirim **keadaan yang diminta**, bukan "balikkan".
   *
   * Toggle di server tidak idempoten: satu klik yang terkirim dua kali akan
   * mengembalikan penanda ke keadaan semula tanpa ada yang menyadarinya. Di sini
   * UI berubah lebih dulu (tombol harus terasa langsung merespons) lalu
   * dikembalikan kalau server menolak, sehingga yang terlihat selalu sama dengan
   * yang tersimpan.
   */
  const toggleBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wasBookmarked = bookmarks.includes(id);
    const next = !wasBookmarked;

    // Idempotent set/delete rather than append/filter: a revert must not be able
    // to add a second copy of an id that is already in the list.
    const apply = (target: boolean) =>
      setBookmarks((prev) => {
        const ids = new Set(prev);
        if (target) ids.add(id);
        else ids.delete(id);
        return [...ids];
      });

    apply(next);

    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: id, bookmarked: next }),
      });
      if (!res.ok) throw new Error(`bookmark failed: ${res.status}`);
    } catch (err) {
      console.error("Gagal menyimpan penanda:", err);
      apply(wasBookmarked);
    }
  };

  /**
   * Membuka modul **tidak** lagi dihitung sebagai unduhan.
   *
   * Sampai M20 setiap klik "buka" menaikkan `modules.downloads`, sehingga angka
   * itu berarti "pernah dibuka" — dan siswa yang membaca sekali di layar
   * terhitung sama dengan siswa yang menyimpan berkasnya. Sekarang hitungannya
   * hanya bertambah saat tombol Unduh ditekan, jadi angka di kartu akhirnya
   * menjawab pertanyaan yang ditulis di atasnya.
   */
  const handleDownload = (moduleId: string) => {
    setModulesList((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, downloads: m.downloads + 1 } : m)),
    );

    void fetch("/api/modules/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId }),
    }).catch((err) => {
      console.error("Gagal menambah hitungan download:", err);
    });
  };

  // Unique lists for filtering
  const categories = ["Semua", "UTBK", "Olimpiade", "Reguler"];
  const grades = ["Semua", "X", "XI", "XII", "Umum"];

  // Filter & Sort Logic
  const filteredAndSortedModules = useMemo(() => {
    return modulesList
      .filter(mod => {
        const matchesSearch = 
          mod.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          mod.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (mod.uploaderName && mod.uploaderName.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesCategory = selectedCategory === "Semua" || mod.category === selectedCategory;
        const matchesGrade = selectedGrade === "Semua" || mod.grade === selectedGrade;
        const matchesBookmark = showBookmarksOnly ? bookmarks.includes(mod.id) : true;

        return matchesSearch && matchesCategory && matchesGrade && matchesBookmark;
      })
      .sort((a, b) => {
        if (sortBy === "downloads") {
          return b.downloads - a.downloads;
        } else {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [modulesList, searchQuery, selectedCategory, selectedGrade, sortBy, bookmarks, showBookmarksOnly]);

  /**
   * Label di kartu dibaca dari `source.kind`, bukan dari string URL.
   *
   * `kind` sudah memutuskan hal yang sama sekali berbeda dengan `startsWith`:
   * apakah bytes-nya milik kita dan bisa dirender, atau hanya tautan yang harus
   * diserahkan ke peramban. Dua tempat yang menebak dari URL adalah cara
   * keduanya mulai berbeda pendapat.
   */
  const getFileTypeDetails = (kind: ModuleSource["kind"]) => {
    if (kind === "pdf-data" || kind === "pdf-blob") {
      return { label: "PDF", color: "bg-red-50 text-red-600 border-red-100", icon: FileText };
    }
    if (kind === "image-data" || kind === "image-blob") {
      return { label: "Foto", color: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: ImageIcon };
    }
    if (kind === "unknown") {
      return {
        label: "Rusak",
        color: "bg-amber-50 text-amber-700 border-amber-200",
        icon: AlertTriangle,
      };
    }
    return { label: "Tautan", color: "bg-indigo-50 text-nawa-primary border-indigo-100", icon: ExternalLink };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 text-center sm:text-left relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent p-6 sm:p-8 border border-indigo-100/50 dark:border-zinc-800/80 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl relative z-10">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Perpustakaan Modul &amp; Catatan Belajar SMAN 2 Jonggol
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
            Koleksi materi pelajaran terkurasi, ringkasan rumus, dan catatan sebaya untuk persiapan PTS, PAS, dan UTBK-SNBT.
          </p>
        </div>
        <div className="shrink-0 relative z-10 flex justify-center md:justify-end">
          <Link
            href="/submit"
            className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-nawa-primary to-nawa-secondary hover:from-nawa-primary-hover hover:to-nawa-secondary-hover text-white px-5 py-3 text-sm font-bold shadow-md shadow-indigo-500/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
          >
            Kontribusi Modul <ArrowRight className="h-4.5 w-4.5" />
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-5 w-5 text-zinc-400" />
            <input 
              type="text" 
              aria-label="Cari judul modul"
              placeholder="Cari judul modul..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-11 pr-4 py-2.5 text-sm rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4" /> Urutkan:
            </span>
            <div className="inline-flex bg-zinc-50 dark:bg-zinc-950 p-1 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <button
                onClick={() => setSortBy("newest")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  sortBy === "newest"
                    ? "bg-white dark:bg-zinc-800 text-nawa-primary dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                Terbaru
              </button>
              <button
                onClick={() => setSortBy("downloads")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  sortBy === "downloads"
                    ? "bg-white dark:bg-zinc-800 text-nawa-primary dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                Terpopuler
              </button>
            </div>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex flex-col gap-3">
          {/* Category Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 min-w-[70px] flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Kategori:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                    selectedCategory === cat
                      ? "bg-nawa-primary border-nawa-primary text-white shadow-md shadow-nawa-primary/10 scale-[1.02]"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {cat === "Semua" ? "Semua Kategori" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grade Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 min-w-[70px] flex items-center gap-1">
              <GraduationCap className="h-4 w-4" /> Kelas:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {grades.map((grd) => (
                <button
                  key={grd}
                  onClick={() => setSelectedGrade(grd)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                    selectedGrade === grd
                      ? "bg-nawa-primary border-nawa-primary text-white shadow-md shadow-nawa-primary/10 scale-[1.02]"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {grd === "Semua" ? "Semua Kelas" : `Kelas ${grd}`}
                </button>
              ))}
            </div>
          </div>

          {/* Bookmark Filter */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all shadow-sm ${
                showBookmarksOnly 
                  ? "bg-nawa-primary border-nawa-primary text-white shadow-indigo-500/20" 
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {showBookmarksOnly ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              Tersimpan
            </button>
          </div>
        </div>
      </div>

      {/* Modules Grid */}
      {filteredAndSortedModules.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm max-w-2xl mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-nawa-primary dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Tidak ada modul ditemukan</h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Coba ubah kata kunci pencarian Anda atau bersihkan filter kelas dan kategori untuk menemukan materi belajar.
          </p>
          <button 
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("Semua");
              setSelectedGrade("Semua");
              setShowBookmarksOnly(false);
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-nawa-primary hover:bg-nawa-primary-hover px-5 py-2.5 text-xs font-bold text-white shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
          >
            Reset Semua Pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedModules.map((mod) => {
            const fileDetails = getFileTypeDetails(mod.source.kind);
            const FileIcon = fileDetails.icon;

            return (
              <div 
                key={mod.id} 
                className="group relative border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm bg-white dark:bg-zinc-900/60 hover:shadow-xl hover:border-indigo-400 dark:hover:border-indigo-950 hover:bg-gradient-to-b hover:from-white hover:to-indigo-50/5 dark:hover:from-zinc-900 dark:hover:to-indigo-950/10 transition-all duration-300 flex flex-col justify-between"
              >
                {/* Visual Glow Indicator */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/0 to-transparent group-hover:via-indigo-500 rounded-t-2xl transition-all duration-500" />
                
                <div>
                  {/* Card Header badges */}
                  <div className="flex justify-between items-center mb-4">
                    <span className="inline-flex items-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 text-[10px] font-bold text-nawa-primary-hover dark:text-indigo-400 border border-indigo-100 dark:border-indigo-950/80">
                      {mod.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${fileDetails.color}`}>
                        <FileIcon className="h-3 w-3" /> {fileDetails.label}
                      </span>
                      <span className="text-[10px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-lg text-zinc-600 font-semibold">
                        Kelas {mod.grade}
                      </span>
                    </div>
                  </div>

                  {/* Title & Subject */}
                  <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 mb-1 group-hover:text-nawa-primary dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {mod.title}
                  </h3>
                  <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400/80 mb-4">
                    {mod.subject}
                  </p>
                </div>

                {/* Footer and Interactive Button */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 mt-4 flex items-center justify-between">
                  {/* Contributor badge */}
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-nawa-primary dark:text-indigo-400 border border-indigo-100 dark:border-indigo-950/50 flex items-center justify-center font-bold text-[10px] uppercase">
                      {mod.uploaderName ? mod.uploaderName.charAt(0) : "A"}
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">KONTRIBUTOR</p>
                      <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">
                        {mod.uploaderName || "Anonim"}
                      </p>
                    </div>
                  </div>

                  {/* Downloads Indicator & Action Button */}
                  <div className="flex items-center gap-2.5">
                    <div className="text-right shrink-0">
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">DIUNDUH</p>
                      <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 flex items-center gap-1 justify-end">
                        <Download className="h-3 w-3 text-zinc-400 group-hover:text-indigo-500 transition-colors" /> {mod.downloads}
                      </p>
                    </div>

                    <button
                      onClick={(e) => toggleBookmark(mod.id, e)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all cursor-pointer border shadow-sm hover:scale-105 active:scale-95 ${
                        bookmarks.includes(mod.id)
                          ? "bg-amber-100 border-amber-200 text-amber-600 dark:bg-amber-900/30 dark:border-amber-800 dark:text-nawa-warning"
                          : "bg-white border-zinc-200 text-zinc-400 hover:text-nawa-warning dark:bg-zinc-800 dark:border-zinc-700 dark:hover:text-amber-400"
                      }`}
                      title="Simpan Modul"
                    >
                      {bookmarks.includes(mod.id) ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
                    </button>

                    <button 
                      type="button"
                      onClick={() => setSelectedReaderModule(mod)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-nawa-primary hover:bg-nawa-primary-hover text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer border border-nawa-primary-hover"
                      title="Baca modul"
                      aria-label={`Baca modul: ${mod.title}`}
                    >
                      <BookOpen className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📖 NAWA-READER — see ModuleReader for why this is no longer an <embed>. */}
      {selectedReaderModule && (
        <ModuleReader
          module={selectedReaderModule}
          onClose={() => setSelectedReaderModule(null)}
          onDownload={() => handleDownload(selectedReaderModule.id)}
        />
      )}
    </div>
  );
}
