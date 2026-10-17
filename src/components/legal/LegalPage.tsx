// src/components/legal/LegalPage.tsx
// ─── Kerangka halaman kebijakan (server component) ────────────────────────────
// /privacy dan /terms berbagi tata letak yang sama supaya keduanya tidak pernah
// berbeda soal hal-hal yang mudah lupa: nomor versi, tanggal berlaku, dan alamat
// kontak. Halaman hanya menyumbang isi bagian-bagiannya.
//
// Kedua halaman ini publik (lihat PUBLIC_ROUTES di src/proxy.ts) karena calon
// pengguna harus bisa membacanya *sebelum* punya akun.
import Link from "next/link";
import { POLICY_EFFECTIVE_DATE, POLICY_PATHS, POLICY_VERSION, PRIVACY_CONTACT_EMAIL } from "@/lib/policy";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          NAWA-LEARN · SMAN 2 Jonggol
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{intro}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-bold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300">
            Versi {POLICY_VERSION}
          </span>
          <span className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Berlaku sejak {POLICY_EFFECTIVE_DATE}
          </span>
        </div>
      </header>

      <div className="space-y-8">{children}</div>

      <footer className="mt-12 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p>
          Ada pertanyaan tentang dokumen ini? Kirim surel ke{" "}
          <a className="font-bold text-indigo-600 hover:underline dark:text-indigo-400" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>
            {PRIVACY_CONTACT_EMAIL}
          </a>
          .
        </p>
        <nav className="mt-4 flex flex-wrap gap-4 font-bold">
          {title.toLowerCase().includes("privasi") ? (
            <Link className="text-indigo-600 hover:underline dark:text-indigo-400" href={POLICY_PATHS.terms}>
              Baca Ketentuan Layanan →
            </Link>
          ) : (
            <Link className="text-indigo-600 hover:underline dark:text-indigo-400" href={POLICY_PATHS.privacy}>
              Baca Kebijakan Privasi →
            </Link>
          )}
          <Link className="text-zinc-500 hover:underline dark:text-zinc-400" href="/">
            ← Kembali ke beranda
          </Link>
        </nav>
      </footer>
    </article>
  );
}

export function LegalSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  const id = `bagian-${number}`;
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <h2 id={id} className="flex items-baseline gap-2 text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white">
        <span className="text-indigo-500 dark:text-indigo-400">{number}.</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
    </section>
  );
}

/** Daftar berpoin dengan gaya seragam, supaya isinya tetap ringkas ditulis. */
export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-indigo-400">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
