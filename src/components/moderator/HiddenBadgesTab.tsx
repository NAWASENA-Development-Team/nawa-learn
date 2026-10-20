// components/moderator/HiddenBadgesTab.tsx
// ─── Tab 3: monitor lencana tersembunyi ──────────────────────────────────────
//
// Semua angka di sini sudah dievaluasi server (`GET /api/moderator/hidden-
// badges`): `requirement` ditulis di katalog server dan hanya dikirim ke
// moderator. Komponen ini tidak punya `unlockCondition` untuk dijalankan —
// dan itu tujuannya: kedelapan syarat rahasia tidak boleh ikut ke bundel
// browser (M14e).
"use client";

import { Eye, ChevronDown } from "lucide-react";
import { getRarityColor } from "@/lib/badges";
import type { BadgeDisplay } from "@/lib/badges";
import type { HiddenBadgeHolder } from "./types";

interface HiddenBadgesTabProps {
  hiddenBadges: BadgeDisplay[];
  badgeHolders: Record<string, HiddenBadgeHolder[]>;
  isLoadingBadges: boolean;
  expandedBadge: string | null;
  onToggleExpand: (badgeId: string) => void;
}

export function HiddenBadgesTab({
  hiddenBadges, badgeHolders, isLoadingBadges, expandedBadge, onToggleExpand,
}: HiddenBadgesTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl px-5 py-3 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
        <Eye className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Halaman ini hanya terlihat oleh moderator. Lencana tersembunyi <strong>tidak ditampilkan</strong> kepada
          siswa — mereka hanya melihat slot <em>&quot;???&quot;</em> di profil. Pantau siapa saja yang berhasil
          membukanya di sini.
        </span>
      </div>

      {isLoadingBadges ? (
        <div className="p-12 text-center text-zinc-550 flex flex-col items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-amber-150 border-t-amber-500 animate-spin mb-3" />
          <p className="text-xs font-bold">Memuat data lencana tersembunyi...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hiddenBadges.map((badge) => {
            // Pemegangnya sudah dihitung server. Komponen ini tidak punya
            // `unlockCondition` untuk dijalankan — dan itu tujuannya.
            const holders = badgeHolders[badge.id] ?? [];

            const isExpanded = expandedBadge === badge.id;

            return (
              <div
                key={badge.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Badge header row */}
                <button
                  onClick={() => onToggleExpand(badge.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-gradient-to-br ${getRarityColor(badge.rarity)} shadow-sm`}>
                    {badge.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{badge.title}</h4>
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        Tersembunyi
                      </span>
                      <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold px-2 py-0.5 rounded capitalize">
                        {badge.rarity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{badge.description}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 font-semibold mt-1">
                      Syarat rahasia: {badge.requirement ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 pr-1">
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {holders.length}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-semibold">pemegang</span>
                    <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Holders list (expandable) */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pb-4 pt-3">
                    {holders.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">Belum ada siswa yang membuka lencana ini.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                          {holders.length} Siswa Pemegang Lencana
                        </p>
                        {holders.map((u, idx) => (
                          <div key={u.id} className="flex items-center gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl">
                            <span className="text-xs font-black text-zinc-400 w-5 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">{u.name}</p>
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                                {u.points} VP · {u.approvedModules} modul · {u.approvedQuestions} soal
                              </p>
                            </div>
                            <a
                              href={`/profile/${u.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                            >
                              Profil ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
