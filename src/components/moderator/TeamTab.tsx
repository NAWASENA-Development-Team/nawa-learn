// components/moderator/TeamTab.tsx
// ─── Tab 5: siapa yang menjaga platform ──────────────────────────────────────
//
// Tab ini ada karena staf manusia disembunyikan dari papan peringkat (M17).
// Sebelumnya daftar moderator bisa "dilihat" dengan membuka papan itu; sekarang
// tidak bisa lagi, dan pemegang kursi yang baru duduk tidak punya cara lain untuk
// tahu kepada siapa ia bertanya. Datanya datang dari `GET /api/moderator/team`,
// yang menyusun dua kelompok dari dua definisi yang sudah ada — `IS_HUMAN_STAFF`
// untuk staf, `getPodium()` untuk kursi — sehingga tab ini tidak pernah punya
// definisi "moderator" versinya sendiri.
//
// Yang **tidak** ditampilkan: alamat surel. Panel ini dibaca kursi musim juga.
"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, ShieldCheck, Trophy, Users } from "lucide-react";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import type { TeamSeatMember, TeamStaffMember } from "./types";

interface TeamTabProps {
  staff: TeamStaffMember[];
  seats: TeamSeatMember[];
  isLoadingTeam: boolean;
  /** Muat gagal. Daftar kosong dari galat bukan bukti "belum ada staf". */
  hasError: boolean;
}

/** Avatar yang dipakai: pilihan pengguna bila ada, kalau tidak yang pertama. */
function avatarFor(member: { avatarIndex: number | null }) {
  if (member.avatarIndex === null || member.avatarIndex === undefined) {
    return AVATAR_OPTIONS[0];
  }
  return AVATAR_OPTIONS[member.avatarIndex] ?? AVATAR_OPTIONS[0];
}

function MemberAvatar({
  member,
  className,
}: {
  member: { avatarIndex: number | null; photoUrl: string | null };
  className: string;
}) {
  const avatar = avatarFor(member);
  return (
    <div className={`relative overflow-hidden rounded-full shrink-0 ${className}`}>
      {member.photoUrl ? (
        <Image src={member.photoUrl} alt="Foto profil" fill sizes="48px" className="object-cover" />
      ) : (
        <Image src={avatar.svg} alt={avatar.label} fill sizes="48px" className="object-cover" />
      )}
    </div>
  );
}

export function TeamTab({ staff, seats, isLoadingTeam, hasError }: TeamTabProps) {
  if (isLoadingTeam) {
    return (
      <div className="p-12 text-center text-zinc-600 flex flex-col items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-indigo-100 border-t-nawa-primary animate-spin mb-3" />
        <p className="text-xs font-bold">Memuat daftar tim...</p>
      </div>
    );
  }

  // Dua daftar kosong bisa berarti "belum ada yang diangkat" atau "muat gagal".
  // Menampilkan kalimat pertama untuk yang kedua adalah klaim palsu tentang
  // platform, jadi galat punya tampilannya sendiri.
  if (hasError) {
    return (
      <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
        <p className="text-sm font-extrabold text-zinc-900 dark:text-white mb-1">
          Daftar tim gagal dimuat
        </p>
        <p className="text-xs text-zinc-600">
          Muat ulang halaman ini. Kalau tetap gagal, periksa log server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl px-5 py-3 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-300">
        <Users className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Staf pengelola <strong>tidak tampil di papan peringkat</strong> dan profilnya tidak dapat dibuka siswa.
          Halaman ini satu-satunya tempat daftar mereka terlihat — dan hanya oleh peninjau.
        </span>
      </div>

      {/* 1. Staf manusia */}
      <section>
        <h2 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-nawa-primary dark:text-indigo-400" />
          Staf Pengelola ({staff.length})
        </h2>

        {staff.length === 0 ? (
          <p className="text-xs text-zinc-500 italic bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-6 text-center">
            Belum ada staf yang diangkat lewat <code className="font-mono">npm run db:promote</code>.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {staff.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm"
              >
                <MemberAvatar member={member} className="h-10 w-10 border border-zinc-200 dark:border-zinc-700" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">{member.name}</p>
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mt-0.5 ${
                      member.role === "admin"
                        ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400"
                        : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {member.role === "admin" ? "Admin" : "Moderator"}
                  </span>
                </div>
                <Link
                  href={`/profile/${member.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-nawa-primary dark:text-indigo-400 hover:underline shrink-0 inline-flex items-center gap-0.5"
                >
                  Profil <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Kursi musim berjalan */}
      <section>
        <h2 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-nawa-warning" />
          Dewan Podium Musim Ini ({seats.length})
        </h2>

        {seats.length === 0 ? (
          <p className="text-xs text-zinc-500 italic bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-6 text-center">
            Belum ada pemegang kursi musim ini — podium terisi setelah ada poin musim.
          </p>
        ) : (
          <div className="space-y-2">
            {seats.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm"
              >
                <span className="text-xs font-black text-zinc-400 w-5 text-center shrink-0">
                  {member.seatNumber}
                </span>
                <MemberAvatar member={member} className="h-10 w-10 border border-zinc-200 dark:border-zinc-700" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-white truncate">{member.name}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                    Kursi #{member.seatNumber} · {member.points} poin musim
                  </p>
                </div>
                <Link
                  href={`/profile/${member.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-nawa-primary dark:text-indigo-400 hover:underline shrink-0 inline-flex items-center gap-0.5"
                >
                  Profil <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
          Kursi berakhir bersama musimnya dan tidak diwariskan: daftar ini mengikuti papan peringkat musim berjalan,
          bukan riwayat pengangkatan.
        </p>
      </section>
    </div>
  );
}
