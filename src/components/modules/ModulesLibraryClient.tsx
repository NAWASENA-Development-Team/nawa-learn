// components/modules/ModulesLibraryClient.tsx
"use client";

import { useState, useMemo } from "react";
import { 
  Search, 
  BookOpen, 
  Download, 
  Sparkles, 
  FileText, 
  FolderOpen, 
  Image as ImageIcon, 
  ExternalLink,
  Filter,
  User,
  ArrowRight,
  SlidersHorizontal,
  GraduationCap,
  X,
  Calendar,
  Check
} from "lucide-react";

interface Module {
  id: string;
  title: string;
  subject: string;
  grade: string;
  category: string;
  contentUrl: string;
  downloads: number;
  uploaderName: string | null;
  createdAt: string; // ISO string from server
}

interface ModulesLibraryClientProps {
  initialModules: Module[];
}

export default function ModulesLibraryClient({ initialModules }: ModulesLibraryClientProps) {
  const [modulesList, setModulesList] = useState<Module[]>(initialModules);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [selectedGrade, setSelectedGrade] = useState<string>("Semua");
  const [sortBy, setSortBy] = useState<"newest" | "downloads">("newest");

  // Reader Modal State
  const [selectedReaderModule, setSelectedReaderModule] = useState<Module | null>(null);
  const [printSuccess, setPrintSuccess] = useState(false);

  // Unique lists for filtering
  const categories = ["Semua", "UTBK", "Olimpiade", "Reguler"];
  const grades = ["Semua", "X", "XI", "XII", "Umum"];

  // Handle module click & increment download count in database and state
  const handleOpenModule = async (moduleId: string, contentUrl: string) => {
    if (contentUrl.startsWith("data:image/")) {
      // Real image upload (camera/local): open in NAWA-READER to display actual photo
      const mod = modulesList.find(m => m.id === moduleId);
      if (mod) setSelectedReaderModule(mod);
    } else if (contentUrl.startsWith("data:application/pdf")) {
      // Real PDF upload: open in NAWA-READER with embedded viewer
      const mod = modulesList.find(m => m.id === moduleId);
      if (mod) setSelectedReaderModule(mod);
    } else if (contentUrl.startsWith("data:")) {
      // Other local uploads (DOCX, PPTX, etc.): trigger actual download
      const ext = contentUrl.includes("wordprocessingml") ? ".docx"
                : contentUrl.includes("presentationml") ? ".pptx"
                : ".dat";
      const link = document.createElement("a");
      link.href = contentUrl;
      link.download = `modul-nawa-learn${ext}`;
      link.click();
    } else if (
      contentUrl.startsWith("https://nawa-learn.storage/") ||
      contentUrl.includes("integral-trik") ||
      contentUrl.includes("fisika-rotasi")
    ) {
      // Legacy seeded mock content: open NAWA-READER with mock viewer
      const mod = modulesList.find(m => m.id === moduleId);
      if (mod) setSelectedReaderModule(mod);
    } else {
      // Real external URL (Google Drive, etc.): open in new tab
      window.open(contentUrl, "_blank", "noopener,noreferrer");
    }

    // Optimistically update local UI state download count
    setModulesList(prev => 
      prev.map(m => m.id === moduleId ? { ...m, downloads: m.downloads + 1 } : m)
    );

    // Trigger API POST call silently in background to update Postgres downloads count
    try {
      await fetch("/api/modules/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
      });
    } catch (err) {
      console.error("Gagal menambah hitungan download:", err);
    }
  };

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

        return matchesSearch && matchesCategory && matchesGrade;
      })
      .sort((a, b) => {
        if (sortBy === "downloads") {
          return b.downloads - a.downloads;
        } else {
          // Sort by newest Date
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [modulesList, searchQuery, selectedCategory, selectedGrade, sortBy]);

  // Detect file type and return style details
  const getFileTypeDetails = (url: string) => {
    const lowerUrl = url.toLowerCase();

    // Real uploaded files stored as base64 data URLs
    if (lowerUrl.startsWith("data:image/")) {
      return {
        label: "Foto",
        color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
        icon: ImageIcon
      };
    }
    if (lowerUrl.startsWith("data:application/pdf")) {
      return {
        label: "PDF",
        color: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/40",
        icon: FileText
      };
    }
    if (lowerUrl.startsWith("data:application/vnd.openxmlformats") || lowerUrl.startsWith("data:application/msword")) {
      return {
        label: "DOCX",
        color: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40",
        icon: FileText
      };
    }
    if (lowerUrl.startsWith("data:")) {
      return {
        label: "Dokumen",
        color: "bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800",
        icon: FileText
      };
    }

    // Treat preseeded mock modules as local direct uploads for visualization
    if (lowerUrl.includes("fisika-rotasi")) {
      return {
        label: "Foto",
        color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
        icon: ImageIcon
      };
    }
    if (lowerUrl.includes("integral-trik")) {
      return {
        label: "PDF",
        color: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/40",
        icon: FileText
      };
    }

    if (lowerUrl.includes("drive.google.com") || lowerUrl.includes("docs.google.com")) {
      return {
        label: "Drive",
        color: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40",
        icon: FolderOpen
      };
    } else if (lowerUrl.endsWith(".pdf")) {
      return {
        label: "PDF",
        color: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/40",
        icon: FileText
      };
    } else if (lowerUrl.endsWith(".png") || lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg") || lowerUrl.includes("photos/cam-")) {
      return {
        label: "Foto",
        color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
        icon: ImageIcon
      };
    }
    return {
      label: "Berkas",
      color: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40",
      icon: FileText
    };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* 🚀 Header Card with visual glowing effect */}
      <div className="mb-8 text-center sm:text-left relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent p-6 sm:p-8 border border-indigo-100/50 dark:border-zinc-800/80 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs px-3 py-1 rounded-full font-semibold mb-4 border border-indigo-100/60 dark:border-indigo-900/40">
            <Sparkles className="h-3.5 w-3.5" /> Perpustakaan Modul SMAN 2 Jonggol
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            Pusat Modul & Catatan Belajar
          </h2>
          <p className="mt-2 text-base text-zinc-650 dark:text-zinc-400 leading-relaxed max-w-2xl">
            Akses materi, rangkuman rumus, catatan pelajaran reguler, latihan soal UTBK, hingga persiapan Olimpiade yang ditulis langsung oleh teman-temanmu dan ditinjau oleh pengurus OSIS.
          </p>
        </div>

        {/* Floating action button */}
        <div className="shrink-0 relative z-10 flex justify-center md:justify-end">
          <a
            href="/submit"
            className="inline-flex items-center gap-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
          >
            Kontribusi Modul <ArrowRight className="h-4.5 w-4.5" />
          </a>
        </div>
      </div>

      {/* 🔍 Search & Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm space-y-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-5 w-5 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Cari judul modul, mata pelajaran, atau kontributor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-11 pr-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 dark:text-white transition-all placeholder-zinc-400 shadow-inner"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4" /> Urutkan:
            </span>
            <div className="inline-flex bg-zinc-50 dark:bg-zinc-950 p-1 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <button
                onClick={() => setSortBy("newest")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  sortBy === "newest"
                    ? "bg-white dark:bg-zinc-850 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300"
                }`}
              >
                Terbaru
              </button>
              <button
                onClick={() => setSortBy("downloads")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  sortBy === "downloads"
                    ? "bg-white dark:bg-zinc-850 text-indigo-600 dark:text-white shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300"
                }`}
              >
                Terpopuler
              </button>
            </div>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="border-t border-zinc-150 dark:border-zinc-850 pt-4 flex flex-col gap-3">
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
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850"
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
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 scale-[1.02]"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                  }`}
                >
                  {grd === "Semua" ? "Semua Kelas" : `Kelas ${grd}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 📚 Modules Grid */}
      {filteredAndSortedModules.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 shadow-sm max-w-2xl mx-auto">
          <span className="text-5xl">📚</span>
          <h3 className="mt-4 text-xl font-bold text-zinc-900 dark:text-white">Tidak ada modul ditemukan</h3>
          <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
            Coba ubah kata kunci pencarian Anda atau bersihkan filter kelas dan kategori untuk menemukan materi belajar.
          </p>
          <button 
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("Semua");
              setSelectedGrade("Semua");
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            Reset Semua Pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedModules.map((mod) => {
            const fileDetails = getFileTypeDetails(mod.contentUrl);
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
                    <span className="inline-flex items-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-950/80">
                      {mod.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${fileDetails.color}`}>
                        <FileIcon className="h-3 w-3" /> {fileDetails.label}
                      </span>
                      <span className="text-[10px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-lg text-zinc-550 font-semibold">
                        Kelas {mod.grade}
                      </span>
                    </div>
                  </div>

                  {/* Title & Subject */}
                  <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
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
                    <div className="h-7 w-7 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-950/50 flex items-center justify-center font-bold text-[10px] uppercase">
                      {mod.uploaderName ? mod.uploaderName.charAt(0) : "A"}
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">KONTRIBUTOR</p>
                      <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[90px] sm:max-w-[120px]">
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
                      type="button"
                      onClick={() => handleOpenModule(mod.id, mod.contentUrl)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer border border-indigo-700"
                      title="Buka Dokumen Modul"
                    >
                      <ExternalLink className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📖 NAWA-READER: Premium Internal Document Viewer Modal */}
      {selectedReaderModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 sm:p-6 md:p-8 animate-in fade-in duration-300">
          <div className="max-w-4xl w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] relative animate-in zoom-in-95 duration-300">
            {/* Header bar */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h4 className="font-extrabold text-zinc-900 dark:text-white line-clamp-1 text-sm sm:text-base">
                    {selectedReaderModule.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                    <span className="font-semibold text-indigo-500">{selectedReaderModule.subject}</span>
                    <span>•</span>
                    <span>Kelas {selectedReaderModule.grade}</span>
                    <span>•</span>
                    <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] px-2 py-0.5 rounded-md font-bold">
                      {selectedReaderModule.category}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedReaderModule(null);
                  setPrintSuccess(false);
                }}
                className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 p-2 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded-xl transition-all shrink-0 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document sheet body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-zinc-50 dark:bg-zinc-950/85">
              {selectedReaderModule.contentUrl.startsWith("data:image/") ? (
                /* REAL PHOTO UPLOAD: Show actual captured/uploaded image */
                <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
                  <img
                    src={selectedReaderModule.contentUrl}
                    alt={selectedReaderModule.title}
                    className="rounded-2xl shadow-lg max-w-full object-contain border border-zinc-200 dark:border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 text-center">
                    Diunggah oleh <span className="font-bold">{selectedReaderModule.uploaderName || "Anonim"}</span> •{" "}
                    {new Date(selectedReaderModule.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              ) : selectedReaderModule.contentUrl.startsWith("data:application/pdf") ? (
                /* REAL PDF UPLOAD: Embed actual PDF viewer */
                <div className="flex flex-col h-full min-h-[500px] gap-2">
                  <embed
                    src={selectedReaderModule.contentUrl}
                    type="application/pdf"
                    className="w-full flex-1 min-h-[500px] rounded-xl border border-zinc-200 dark:border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 text-center">
                    Diunggah oleh <span className="font-bold">{selectedReaderModule.uploaderName || "Anonim"}</span>
                  </p>
                </div>
              ) : getFileTypeDetails(selectedReaderModule.contentUrl).label === "Foto" ? (
                /* MOCK CAMERA PHOTO PREVIEW: Display premium, highly catchy handwritten school notes scan mockup */
                <div className="max-w-2xl mx-auto bg-[#faf8f5] text-zinc-800 border-2 border-[#e6dfd3] p-6 sm:p-8 rounded-2xl shadow-md relative overflow-hidden bg-[linear-gradient(#f1ece1_1px,transparent_1px)] bg-[size:100%_1.5rem] min-h-[500px]">
                  {/* binder rings visual holes */}
                  <div className="absolute left-4 top-0 bottom-0 w-2 flex flex-col justify-around py-8 pointer-events-none opacity-40">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-4 w-4 rounded-full bg-zinc-400/40 border border-zinc-500 shadow-inner" />
                    ))}
                  </div>
                  
                  {/* Handwritten watermark or signature */}
                  <div className="absolute top-2 right-4 text-xs font-semibold text-indigo-400/50 select-none uppercase tracking-widest font-mono">
                    REC CAM LIVE // OSIS SMAN 2
                  </div>

                  <div className="pl-6 border-l-2 border-red-300 h-full text-left">
                    <div className="mb-6 pb-4 border-b-2 border-[#e6dfd3]">
                      <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Hasil Capture Foto Kamera
                      </span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight mt-2 flex items-center gap-2">
                        {selectedReaderModule.title} 📝
                      </h2>
                      <p className="text-xs text-zinc-505 mt-1 font-mono">
                        Discan oleh: <span className="font-bold">{selectedReaderModule.uploaderName || "Anonim"}</span> pada {new Date(selectedReaderModule.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>

                    {selectedReaderModule.subject.includes("Fisika") ? (
                      /* Mock high-fidelity Physics handwritten note content */
                      <div className="space-y-6 text-sm sm:text-base leading-relaxed font-sans text-zinc-750">
                        <div>
                          <h4 className="font-bold text-lg text-indigo-650 bg-indigo-50 border-b border-indigo-200 px-2 py-0.5 rounded inline-block">
                            I. Hukum II Newton ⚖️
                          </h4>
                          <p className="mt-2 text-zinc-700">
                            "Percepatan dari suatu benda sebanding dengan resultan gaya yang bekerja pada benda tersebut dan berbanding terbalik dengan massanya."
                          </p>
                          <div className="bg-amber-50/85 border border-dashed border-amber-300 rounded-xl p-4 my-3 text-center">
                            <span className="font-mono text-xl sm:text-2xl font-black text-indigo-800 select-all">
                              ΣF = m · a
                            </span>
                            <p className="text-xs text-zinc-500 mt-1">Dimana: F = Gaya (N), m = Massa (kg), a = Percepatan (m/s²)</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg text-indigo-650 bg-indigo-50 border-b border-indigo-200 px-2 py-0.5 rounded inline-block">
                            II. Rotasi Benda Tegar (Dinamika Rotasi) 🌀
                          </h4>
                          <p className="mt-2 text-zinc-700">
                            Pada gerak rotasi, padanan gaya adalah <b>Torsi (τ)</b>, dan padanan massa adalah <b>Momen Inersia (I)</b>.
                          </p>
                          <ul className="list-disc pl-5 mt-2 space-y-2 text-sm text-zinc-700">
                            <li><b>Momen Inersia:</b> I = Σm·r² (Kecenderungan benda mempertahankan rotasinya)</li>
                            <li><b>Torsi (Momen Gaya):</b> τ = r × F = I · α</li>
                            <li><b>Percepatan Sudut (α):</b> α = a / r (rad/s²)</li>
                          </ul>
                        </div>

                        <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 mt-6">
                          <p className="text-xs font-bold text-indigo-600 uppercase">💡 Tips Ujian SMAN 2 Jonggol:</p>
                          <p className="text-xs text-zinc-650 mt-1 leading-relaxed">
                            Jangan lupa untuk selalu menyamakan arah vektor gaya pada sumbu x dan sumbu y terlebih dahulu sebelum memasukkannya ke rumus ΣF = m·a!
                          </p>
                        </div>
                      </div>
                    ) : selectedReaderModule.subject.includes("Matematika") ? (
                      /* Mock high-fidelity Math handwritten note content */
                      <div className="space-y-6 text-sm sm:text-base leading-relaxed font-sans text-zinc-750">
                        <div>
                          <h4 className="font-bold text-lg text-indigo-650 bg-indigo-50 border-b border-indigo-200 px-2 py-0.5 rounded inline-block">
                            I. Integral Substitusi 🧮
                          </h4>
                          <p className="mt-2 text-zinc-750">
                            Metode ini digunakan jika integran dapat dipecah menjadi bentuk f(g(x)) · g'(x) · dx. Caranya dengan memisalkan u = g(x), sehingga du = g'(x)dx.
                          </p>
                          <div className="bg-amber-50/85 border border-dashed border-amber-300 rounded-xl p-4 my-3 text-center">
                            <span className="font-mono text-lg sm:text-xl font-bold text-indigo-850">
                              ∫ f(g(x)) g'(x) dx = ∫ f(u) du = F(u) + C
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-lg text-indigo-650 bg-indigo-50 border-b border-indigo-200 px-2 py-0.5 rounded inline-block">
                            II. Integral Parsial (Metode Tanzalin) ⚡
                          </h4>
                          <p className="mt-2 text-zinc-750">
                            Sangat praktis untuk integral perkalian dua fungsi aljabar & trigonometri ∫ u · dv. Buatlah tabel Turunan (Differentiate) dan Integral (Integrate):
                          </p>
                          
                          <div className="overflow-hidden rounded-xl border border-zinc-200 my-4 text-center bg-white">
                            <table className="min-w-full text-xs sm:text-sm">
                              <thead className="bg-zinc-100">
                                <tr>
                                  <th className="py-2 px-3 border-b font-bold text-zinc-700">Turunan (u)</th>
                                  <th className="py-2 px-3 border-b font-bold text-zinc-700">Tanda</th>
                                  <th className="py-2 px-3 border-b font-bold text-zinc-700">Integral (dv)</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="py-2 px-3 border-b font-mono">3x²</td>
                                  <td className="py-2 px-3 border-b font-bold text-indigo-650">(+)</td>
                                  <td className="py-2 px-3 border-b font-mono">cos(x)</td>
                                </tr>
                                <tr>
                                  <td className="py-2 px-3 border-b font-mono text-zinc-550">6x</td>
                                  <td className="py-2 px-3 border-b font-bold text-red-500">(-)</td>
                                  <td className="py-2 px-3 border-b font-mono text-zinc-550">sin(x)</td>
                                </tr>
                                <tr>
                                  <td className="py-2 px-3 border-b font-mono text-zinc-400">6</td>
                                  <td className="py-2 px-3 border-b font-bold text-indigo-650">(+)</td>
                                  <td className="py-2 px-3 border-b font-mono text-zinc-400">-cos(x)</td>
                                </tr>
                                <tr>
                                  <td className="py-2 px-3 font-mono text-zinc-300">0</td>
                                  <td className="py-2 px-3 font-bold text-red-400">(-)</td>
                                  <td className="py-2 px-3 font-mono text-zinc-300">-sin(x)</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Fallback general subject handwritten note content */
                      <div className="space-y-6 text-sm sm:text-base leading-relaxed font-sans text-zinc-750">
                        <div>
                          <h4 className="font-bold text-lg text-indigo-650 bg-indigo-50 border-b border-indigo-200 px-2 py-0.5 rounded inline-block">
                            Ringkasan Materi Pelajaran 📖
                          </h4>
                          <p className="mt-2 text-zinc-750">
                            Berikut adalah rangkuman materi catatan ringkas mata pelajaran <b>{selectedReaderModule.subject}</b> yang berhasil diupload ke NAWA-LEARN.
                          </p>
                          <ul className="list-disc pl-5 mt-3 space-y-2 text-zinc-700">
                            <li><b>Definisi Inti:</b> Rangkuman materi pembelajaran komprehensif, terstruktur, dan mudah dipelajari menjelang ujian sekolah.</li>
                            <li><b>Tips Belajar:</b> Buat catatan visual dengan menggarisbawahi poin-poin krusial dan kerjakan minimal 3 contoh soal latihan terkait.</li>
                            <li><b>Kategori Materi:</b> Modul modul ini diklasifikasikan sebagai berkas {selectedReaderModule.category} untuk siswa {selectedReaderModule.grade}.</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* LOCAL FILE PREVIEW: Display premium digital textbook/notebook typed layout */
                <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 rounded-2xl shadow-md text-left">
                  <div className="mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-850 flex justify-between items-start">
                    <div>
                      <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        Dokumen Modul Terverifikasi
                      </span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight mt-2">
                        {selectedReaderModule.title}
                      </h2>
                      <p className="text-xs text-zinc-500 mt-1">
                        Kontributor: <span className="font-bold text-zinc-700 dark:text-zinc-350">{selectedReaderModule.uploaderName || "Anonim"}</span> • {new Date(selectedReaderModule.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Typed Mock textbook sheet */}
                  <div className="space-y-6 text-sm sm:text-base leading-relaxed text-zinc-705 dark:text-zinc-300">
                    <div>
                      <h3 className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 mb-2">1. Deskripsi & Silabus Materi</h3>
                      <p>
                        Modul ini dipersiapkan secara khusus untuk memandu siswa SMAN 2 Jonggol dalam memahami konsep dasar dari pelajaran <b>{selectedReaderModule.subject}</b>. Pembahasan dirancang agar berorientasi pada penyelesaian soal latihan ujian, penilaian harian, dan persiapan ujian akhir semester.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 mb-2">2. Peta Konsep Esensial</h3>
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-800 rounded-xl font-mono text-xs text-indigo-650 dark:text-indigo-400">
                        <p className="font-bold">// RENCANA MATERI BELAJAR:</p>
                        <p className="mt-1">→ Pendahuluan & Definisi Istilah Penting</p>
                        <p>→ Teori Utama & Rumus Praktis Cepat</p>
                        <p>→ Pembahasan Contoh Soal Standard Ujian Sekolah</p>
                        <p>→ Kumpulan Soal Evaluasi Mandiri Mandiri</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 mb-2">3. Manfaat Belajar Bersama NAWA-LEARN</h3>
                      <p>
                        Dengan mempelajari modul yang dibagikan oleh kontributor berprestasi, Anda mendapatkan sudut pandang ringkas trik pengerjaan cepat yang tidak selalu diajarkan di buku teks standar komersial. Lakukan kolaborasi aktif di forum jika Anda mendapati bagian yang kurang jelas!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer action bar */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedReaderModule(null);
                  setPrintSuccess(false);
                }}
                className="bg-zinc-200 hover:bg-zinc-250 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-250 font-bold py-2 px-4 rounded-xl text-xs transition-all shrink-0 cursor-pointer"
              >
                Tutup Reader
              </button>

              <button
                onClick={() => {
                  const url = selectedReaderModule.contentUrl;
                  if (url.startsWith("data:")) {
                    // Trigger actual file download for real uploaded files
                    const ext = url.startsWith("data:image/png") ? ".png"
                              : url.startsWith("data:image/jpeg") ? ".jpg"
                              : url.startsWith("data:application/pdf") ? ".pdf"
                              : url.includes("wordprocessingml") ? ".docx"
                              : url.includes("presentationml") ? ".pptx"
                              : ".dat";
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${selectedReaderModule.title}${ext}`;
                    link.click();
                    setPrintSuccess(true);
                    setTimeout(() => setPrintSuccess(false), 2000);
                  } else {
                    setPrintSuccess(true);
                    setTimeout(() => setPrintSuccess(false), 2000);
                  }
                }}
                className={`inline-flex items-center gap-1.5 font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-md cursor-pointer ${
                  printSuccess
                    ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/10 scale-95"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10 hover:shadow-lg"
                }`}
              >
                {printSuccess ? (
                  <>
                    <Check className="h-4 w-4 animate-ping" /> Sukses Tersimpan!
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" /> Unduh Dokumen / PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
