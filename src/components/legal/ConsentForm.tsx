// src/components/legal/ConsentForm.tsx
// ─── Kotak centang persetujuan ────────────────────────────────────────────────
// Satu-satunya cara sebuah akun memperoleh `consent_accepted_at`. Halaman
// /consent (server) memastikan formulir ini hanya tampil saat persetujuan masih
// dibutuhkan; komponen ini yang mengirimnya.
//
// Detail yang disengaja: kotak centangnya **tidak tercentang secara bawaan** dan
// tombolnya nonaktif sampai dicentang. Sebuah kotak yang sudah tercentang
// menghasilkan persetujuan yang tidak pernah benar-benar diberikan, dan itu
// persis hal yang UU PDP melarang.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, ExternalLink, FileText } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { POLICY_PATHS, POLICY_VERSION, PRIVACY_CONTACT_EMAIL } from "@/lib/policy";

export default function ConsentForm() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!checked || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/consent/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `policyVersion` sengaja dikirim apa adanya dari konstanta yang sama
        // dengan yang diuji server: body yang menyebut versi lain ditolak 400,
        // jadi tidak ada gunanya menawar di sini.
        body: JSON.stringify({ accept: true, policyVersion: POLICY_VERSION }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        toastError(
          "Gagal menyimpan",
          body.error ?? "Terjadi kesalahan. Coba lagi sebentar lagi.",
        );
        return;
      }

      // `replace` bukan `push`: tombol "kembali" tidak boleh mengembalikan
      // pengguna ke layar persetujuan yang sudah ia lewati.
      router.replace("/modules");
      router.refresh();
    } catch {
      toastError("Gagal menyimpan", "Tidak bisa menghubungi server. Periksa koneksimu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-10">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-nawa-primary dark:bg-indigo-500 flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              Sebelum mulai, satu hal dulu
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-semibold">
              Kebijakan versi {POLICY_VERSION}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          NAWA-LEARN menyimpan sedikit data tentang kamu — nama tampilan, surel, profil yang
          kamu isi sendiri, karya yang kamu unggah, dan aktivitas belajarmu. Semuanya kami
          jelaskan dengan bahasa sehari-hari, tanpa pasal berbelit. Kami tidak menjual datamu
          dan tidak memasang iklan.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href={POLICY_PATHS.privacy}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-200 transition-colors hover:border-indigo-400 hover:text-nawa-primary dark:hover:text-indigo-400"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-500" /> Kebijakan Privasi
            </span>
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
          <Link
            href={POLICY_PATHS.terms}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-200 transition-colors hover:border-indigo-400 hover:text-nawa-primary dark:hover:text-indigo-400"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" /> Ketentuan Layanan
            </span>
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="flex items-start gap-3 cursor-pointer rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 transition-colors hover:border-indigo-300 dark:hover:border-nawa-primary-hover">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-300 text-nawa-primary accent-nawa-primary cursor-pointer"
            />
            <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Saya sudah membaca dan <strong>menyetujui</strong> Kebijakan Privasi dan
              Ketentuan Layanan NAWA-LEARN, dan saya mengizinkan platform ini menyimpan data
              tersebut untuk menjalankan fitur-fiturnya.
            </span>
          </label>

          <button
            type="submit"
            disabled={!checked || isSubmitting}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-nawa-primary hover:bg-nawa-primary-hover disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white px-5 py-3 text-sm font-extrabold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…
              </>
            ) : (
              "Setuju & lanjutkan"
            )}
          </button>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
          Kamu bisa menarik persetujuan kapan saja dengan menghapus akunmu di halaman
          privasi profil. Pertanyaan soal data:{" "}
          <a
            href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
            className="font-bold text-nawa-primary hover:underline dark:text-indigo-400"
          >
            {PRIVACY_CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
