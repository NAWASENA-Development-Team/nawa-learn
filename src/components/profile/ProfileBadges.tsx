// components/profile/ProfileBadges.tsx
// ─── Panel "Lencana Pencapaian" (tab Ringkasan) ────────────────────────────────
//
// Lencana: **tidak ada** evaluasi di sini.
//
// Sebelum M14e blok ini membangun `badgeUnlockData` dari `userModules` dan
// `userQuestions` lalu menjalankan `badge.unlockCondition(...)` untuk 85
// lencana di browser. Dua akibatnya:
//
//   1. `approvedModules`/`approvedQuestions`/`totalDownloads` di sini berasal
//      dari baris yang kebetulan dimuat halaman, sementara `approvedMods` di
//      `specialtyStats` berasal dari SQL. Untuk profil sendiri daftar barisnya
//      mencakup modul `pending` (disaring lagi di sini), untuk profil orang
//      lain tidak — satu angka, dua definisi.
//   2. Seluruh katalog, termasuk delapan `unlockCondition` lencana rahasia,
//      ikut ke bundel browser. Syarat yang seharusnya dirahasiakan bisa dibaca
//      dari DevTools.
//
// Sekarang server mengirim daftar yang sudah selesai; yang tersisa hanya
// penyaringan untuk tampilan.
import { Lock, Award } from "lucide-react";
import { BADGE_CATEGORY_ORDER, getRarityColor } from "@/lib/badges";
import type { BadgeDisplay } from "@/lib/badges";
import { BADGE_CATEGORY_TITLES } from "./types";

export function ProfileBadges({ badgeDisplays }: { badgeDisplays: BadgeDisplay[] }) {
  const unlockedCount = badgeDisplays.filter((badge) => badge.unlocked).length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-500" /> Lencana Pencapaian
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Buka lencana khusus dengan aktif berkontribusi di komunitas SMAN 2 Jonggol.
          </p>
        </div>
        <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs px-3 py-1.5 rounded-xl font-bold border border-indigo-100 dark:border-indigo-950">
          {unlockedCount} / {badgeDisplays.length} Terbuka
        </span>
      </div>

      {/* Badge Categories */}
      <div className="space-y-8">
        {BADGE_CATEGORY_ORDER.map((category) => {
          const categoryBadges = badgeDisplays.filter((b) => b.category === category);
          const categoryUnlocked = categoryBadges.filter((b) => b.unlocked);
          // Lencana rahasia yang belum dibuka tiba di sini dalam bentuk
          // yang sudah diperah server (judul "???", ikon "❓", syarat
          // "???"), jadi tampilan ini tidak perlu tahu peran siapa pun.
          // Dulu keputusannya memakai `user.role` — peran **pemilik
          // profil**, bukan penontonnya — sehingga seorang siswa yang
          // membuka profil moderator melihat syarat rahasia itu.
          const categoryHasMystery = categoryBadges.some((b) => b.redacted);

          return (
            <div key={category}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">
                  {BADGE_CATEGORY_TITLES[category]}
                  {categoryHasMystery && (
                    <span className="ml-2 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">Rahasia</span>
                  )}
                </h3>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {categoryUnlocked.length} / {categoryBadges.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-2xl border transition-all duration-300 relative group flex gap-3 items-start ${
                      badge.unlocked
                        ? `bg-gradient-to-br ${getRarityColor(badge.rarity)} border-opacity-50 border-white shadow-md hover:shadow-lg`
                        : badge.redacted
                          ? "bg-zinc-900/80 dark:bg-zinc-950 border-zinc-700 dark:border-zinc-800"
                          : "bg-zinc-50/50 dark:bg-zinc-950/40 border-zinc-150 dark:border-zinc-850 opacity-60"
                    }`}
                    title={badge.description}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 flex-none ${
                      badge.unlocked
                        ? "bg-white/20 text-white shadow-sm"
                        : badge.redacted
                          ? "bg-zinc-800 text-zinc-600"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                    }`}>
                      {badge.unlocked ? badge.icon : badge.redacted ? "❓" : <Lock className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />}
                    </div>

                    <div className="text-left flex-1 min-w-0">
                      <h4 className={`font-extrabold text-sm flex items-center gap-1.5 ${
                        badge.unlocked
                          ? "text-white"
                          : badge.redacted
                            ? "text-zinc-500 dark:text-zinc-600"
                            : "text-zinc-950 dark:text-zinc-100"
                      }`}>
                        {badge.title}
                        {badge.unlocked && <span className="text-xs">✓</span>}
                      </h4>
                      <p className={`text-[11px] mt-0.5 leading-snug ${
                        badge.unlocked
                          ? "text-white/80"
                          : badge.redacted
                            ? "text-zinc-600 dark:text-zinc-700"
                            : "text-zinc-500 dark:text-zinc-400"
                      }`}>
                        {badge.description}
                      </p>

                      {!badge.unlocked && !badge.redacted && (
                        <div className="mt-2 text-[10px] text-zinc-600 dark:text-zinc-400 font-semibold bg-zinc-100/60 dark:bg-zinc-800/60 px-2 py-0.5 rounded-lg inline-block">
                          {badge.howToUnlock}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
