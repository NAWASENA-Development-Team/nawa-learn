// src/components/profile/PrivacyClient.tsx
// ─── Pusat kendali data pribadi (UU PDP) ──────────────────────────────────────
// Tiga hak subjek data, dalam satu halaman:
//
//   1. Tahu  — kartu status persetujuan: versi apa yang tersimpan, kapan.
//   2. Bawa  — "Ekspor data saya", JSON (lengkap) atau CSV (untuk Excel).
//   3. Hapus — "Hapus akun saya", dua langkah, dengan frasa yang harus diketik.
//
// Komponen ini **tidak** menyimpan logika hak apa pun; ia hanya memanggil route
// yang sudah memilikinya. Yang penting di sini adalah permukaan penggunanya:
// sebuah hak yang secara teknis ada tetapi tidak punya tombol sama saja dengan
// hak yang tidak ada.
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Download,
  FileSpreadsheet,
  FileJson,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  Database,
  Mail,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { POLICY_PATHS, PRIVACY_CONTACT_EMAIL } from "@/lib/policy";
import { DELETE_ACCOUNT_CONFIRMATION } from "@/lib/accountConstants";

export interface RetentionRow {
  label: string;
  windowMonths: number;
}

interface PrivacyClientProps {
  name: string;
  email: string;
  policyVersion: string;
  consentVersion: string | null;
  consentAcceptedAt: string | null;
  consentIsCurrent: boolean;
  retention: RetentionRow[];
}

/** "24 bulan" → "2 tahun", supaya tabelnya terbaca tanpa menghitung. */
function humanWindow(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "1 tahun" : `${years} tahun`;
  }
  return `${months} bulan`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function PrivacyClient({
  name,
  email,
  policyVersion,
  consentVersion,
  consentAcceptedAt,
  consentIsCurrent,
  retention,
}: PrivacyClientProps) {
  const { success, error: toastError } = useToast();

  const [downloading, setDownloading] = useState<"json" | "csv" | null>(null);

  // Penghapusan dua langkah. `step` mengendalikan seberapa jauh pengguna sudah
  // masuk, `typed` adalah frasa yang sedang ia ketik. Tombolnya hanya aktif saat
  // frasa itu sama persis.
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirmationMatches = typed === DELETE_ACCOUNT_CONFIRMATION;

  async function handleExport(format: "json" | "csv") {
    if (downloading) return;
    setDownloading(format);
    try {
      const response = await fetch(`/api/profile/export?format=${format}`, {
        method: "GET",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        toastError(
          "Gagal mengunduh",
          response.status === 429
            ? "Terlalu sering mengunduh. Tunggu sebentar lagi."
            : (body.error ?? "Terjadi kesalahan saat menyiapkan berkas."),
        );
        return;
      }

      // Dibaca sebagai blob lalu diklik lewat <a download>, bukan diarahkan
      // langsung ke URL-nya: dengan cara ini kegagalan (401/429/500) tetap bisa
      // ditangkap dan diberitahukan, bukan berakhir sebagai tab kosong.
      const blob = await response.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nawa-learn-data-${stamp}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      success("Berkas disiapkan", `Data kamu diunduh sebagai ${format.toUpperCase()}.`);
    } catch {
      toastError("Gagal mengunduh", "Tidak bisa menghubungi server. Periksa koneksimu.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleDelete() {
    if (!confirmationMatches || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: DELETE_ACCOUNT_CONFIRMATION }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        toastError(
          "Gagal menghapus",
          response.status === 429
            ? "Terlalu banyak percobaan. Tunggu sebentar lagi."
            : (body.error ?? "Terjadi kesalahan. Coba lagi sebentar lagi."),
        );
        setDeleting(false);
        return;
      }

      // Akun Clerk-nya sudah hilang, jadi tidak ada lagi sesi yang valid.
      // Memuat ulang ke beranda membuat proxy menilai ulang sesi yang tinggal
      // sampah ini dan mengarahkan ke halaman masuk.
      //
      // Ini sengaja **bukan** `router.push("/")`: navigasi klien tidak memuat
      // ulang bundel Clerk, sehingga `useUser()` masih memegang objek user yang
      // sudah dihapus dan halaman berikutnya dirender seolah sesinya hidup.
      // Aturan lint-nya ada untuk mencegah reload tak sengaja, bukan yang ini.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch {
      toastError("Gagal menghapus", "Tidak bisa menghubungi server. Periksa koneksimu.");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      {/* ── Kepala ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shadow-sm">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            Privasi &amp; Data Saya
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-semibold">
            {name} · {email}
          </p>
        </div>
      </div>

      {/* ── Status persetujuan ─────────────────────────────────────────────── */}
      <section className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Persetujuan yang tersimpan
        </h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              Versi kebijakan
            </dt>
            <dd className="mt-1 text-lg font-black text-zinc-900 dark:text-white">
              {consentVersion ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              Disetujui pada
            </dt>
            <dd className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-200">
              {formatDate(consentAcceptedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              Status
            </dt>
            <dd className="mt-1">
              {consentIsCurrent ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Berlaku (v{policyVersion})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-extrabold text-amber-700 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" /> Perlu diperbarui
                </span>
              )}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Kamu bisa membaca dokumen yang kamu setujui kapan saja:{" "}
          <Link
            href={POLICY_PATHS.privacy}
            target="_blank"
            className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Kebijakan Privasi
          </Link>{" "}
          dan{" "}
          <Link
            href={POLICY_PATHS.terms}
            target="_blank"
            className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Ketentuan Layanan
          </Link>
          . Pertanyaan soal data bisa dikirim ke{" "}
          <a
            href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
            className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <Mail className="h-3 w-3" /> {PRIVACY_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      {/* ── Ekspor ─────────────────────────────────────────────────────────── */}
      <section className="mt-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <Download className="h-4 w-4 text-indigo-500" /> Ekspor data saya
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Unduh semua yang NAWA-LEARN simpan tentang akunmu: profil, modul dan soal yang kamu
          unggah, ujian buatanmu, riwayat poin, pengajuan moderasi, dan laporanmu. Berkasnya
          bisa kamu simpan sendiri sebagai cadangan.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleExport("json")}
            disabled={downloading !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white px-4 py-3 text-sm font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            {downloading === "json" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4" />
            )}
            Unduh JSON
            <span className="text-[10px] font-bold opacity-80">(lengkap)</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            disabled={downloading !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-60 disabled:cursor-wait text-zinc-700 dark:text-zinc-200 px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
          >
            {downloading === "csv" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Unduh CSV
            <span className="text-[10px] font-bold opacity-80">(Excel)</span>
          </button>
        </div>
      </section>

      {/* ── Retensi ────────────────────────────────────────────────────────── */}
      <section className="mt-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <Database className="h-4 w-4 text-sky-500" /> Berapa lama data disimpan
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Setelah masa ini, catatan tersebut dihapus otomatis oleh tugas terjadwal. Modul dan
          soal yang kamu unggah tidak ikut terhapus — itu isi perpustakaan yang dibaca siswa
          lain — tetapi namamu dilepas saat akunmu dihapus.
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2.5 font-extrabold">Jenis data</th>
                <th className="px-4 py-2.5 font-extrabold">Masa simpan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {retention.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-200">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 font-black text-zinc-900 dark:text-white">
                    {humanWindow(row.windowMonths)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Zona bahaya ────────────────────────────────────────────────────── */}
      <section className="mt-5 rounded-3xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" /> Hapus akun saya
        </h2>

        {step === "idle" ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              Menghapus akun itu <strong>permanen</strong>. Kamu akan kehilangan akses masuk,
              poinmu, dan riwayat aktivitasmu. Modul dan soal yang pernah kamu unggah tetap ada
              di perpustakaan, tetapi namamu diganti menjadi <em>&ldquo;Anonim&rdquo;</em>.
              Sebaiknya unduh dulu ekspor datamu di atas.
            </p>
            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-zinc-950 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-[0.98] text-red-600 dark:text-red-400 px-4 py-2.5 text-sm font-bold transition-all cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Saya ingin menghapus akun
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              Untuk memastikan ini benar-benar kamu dan bukan klik yang salah, ketik{" "}
              <code className="rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 font-black text-red-600 dark:text-red-400">
                {DELETE_ACCOUNT_CONFIRMATION}
              </code>{" "}
              di bawah ini.
            </p>

            <label className="mt-3 block">
              <span className="sr-only">Frasa konfirmasi</span>
              <input
                type="text"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={DELETE_ACCOUNT_CONFIRMATION}
                className="w-full rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm font-bold tracking-wide text-zinc-900 dark:text-white outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={!confirmationMatches || deleting}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white px-4 py-2.5 text-sm font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Menghapus…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Hapus akun saya secara permanen
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("idle");
                  setTyped("");
                }}
                disabled={deleting}
                className="text-sm font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
            </div>
          </>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Kembali ke{" "}
        <Link
          href="/profile"
          className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          profilmu
        </Link>
        .
      </p>
    </div>
  );
}
