// components/submit/DrivePickerModal.tsx
// ─── Modal picker Google Drive (simulator) ───────────────────────────────────
//
// Modal ini hanya memilih berkas dari daftar tiruan dan menyerahkannya ke
// induk. Tidak ada state yang disimpan di sini selain query pencarian.
"use client";

import { useState } from "react";
import { X, Search, FileText, ArrowRight, ShieldCheck } from "lucide-react";
import { MOCK_DRIVE_FILES } from "./types";
import type { MockDriveFile } from "./types";

interface DrivePickerModalProps {
  onSelect: (file: MockDriveFile) => void;
  onClose: () => void;
}

export function DrivePickerModal({ onSelect, onClose }: DrivePickerModalProps) {
  const [driveSearch, setDriveSearch] = useState("");

  const filteredDriveFiles = MOCK_DRIVE_FILES.filter(file =>
    file.name.toLowerCase().includes(driveSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
      <div className="max-w-xl w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-950">
              {/* Custom Google Drive color style */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M19.3496 14.6508L14.6508 19.3496L19.3496 14.6508Z" fill="currentColor"/>
                <path d="M8.8296 2.45L15.17 2.45L22.35 14.88L16 14.88L8.8296 2.45Z" fill="#FFC107"/>
                <path d="M1.6496 15.15L8.8296 2.45L16 14.88L8.82 27.3L1.6496 15.15Z" fill="#00E676"/>
                <path d="M16 14.88L23.17 27.3L8.82 27.3L16 14.88Z" fill="#29B6F6"/>
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-zinc-900 dark:text-white">Pilih dari Google Drive</h4>
              <p className="text-xs text-zinc-500">File dokumen pembelajaran terhubung</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari file modul Anda..."
              value={driveSearch}
              onChange={(e) => setDriveSearch(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-10 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredDriveFiles.length > 0 ? (
            filteredDriveFiles.map((file, idx) => (
              <div
                key={idx}
                onClick={() => onSelect(file)}
                className="p-3 border border-zinc-100 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-nawa-primary hover:bg-indigo-50/10 dark:hover:bg-indigo-950/20 rounded-xl cursor-pointer flex items-center justify-between group transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 group-hover:text-nawa-primary dark:group-hover:text-indigo-400 transition-colors">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-nawa-primary dark:group-hover:text-indigo-400 transition-colors line-clamp-1">{file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] px-1.5 py-0.5 rounded font-bold">{file.type}</span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{file.size}</span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
              Tidak ada file yang cocok dengan pencarian Anda
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between text-xs text-zinc-400">
          <span>Google Drive API v3 (Simulator)</span>
          <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-nawa-success" /> Terenkripsi Aman</span>
        </div>
      </div>
    </div>
  );
}
