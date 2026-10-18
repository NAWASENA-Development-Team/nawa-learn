"use client";

// src/app/global-error.tsx
// ─── Batas galat paling luar ──────────────────────────────────────────────────
// `error.tsx` menangkap galat di halaman dan layout di bawahnya, tetapi **tidak**
// bisa menangkap galat di `src/app/layout.tsx` itu sendiri — layout itulah yang
// merender batas tersebut, jadi bila ia gagal, tidak ada yang tersisa untuk
// menampilkannya. `global-error.tsx` menggantikan layout akar secara utuh, dan
// itulah satu-satunya alasan file ini ada.
//
// Konsekuensi yang menentukan bentuk file ini: karena layout akar digantikan,
// `globals.css` (yang diimpor di sana) **tidak ikut termuat**, sehingga seluruh
// kelas Tailwind di bawah ini tidak akan punya arti apa pun. Gaya di sini karena
// itu ditulis sebagai inline style biasa — bukan pilihan estetika, melainkan
// satu-satunya yang dijamin bekerja di halaman yang tidak punya stylesheet.
//
// `<html>` dan `<body>` juga wajib ditulis sendiri, dengan alasan yang sama.
// Paletnya sengaja gelap dan tetap: halaman ini muncul ketika sesuatu sudah
// salah, dan tema terang/gelap adalah salah satu hal yang mungkin gagal diketahui.
import { useEffect, type CSSProperties } from "react";

const BODY: CSSProperties = {
  margin: 0,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "#09090b",
  color: "#fafafa",
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  WebkitFontSmoothing: "antialiased",
};

const CARD: CSSProperties = {
  width: "100%",
  maxWidth: "28rem",
  padding: "40px 32px",
  borderRadius: "24px",
  border: "1px solid #27272a",
  background: "#18181b",
  textAlign: "center",
};

const BRAND: CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#818cf8",
  margin: 0,
};

const HEADING: CSSProperties = {
  margin: "14px 0 0",
  fontSize: "24px",
  lineHeight: 1.25,
  fontWeight: 800,
};

const PARAGRAPH: CSSProperties = {
  margin: "12px 0 0",
  fontSize: "14px",
  lineHeight: 1.6,
  color: "#a1a1aa",
};

const DIGEST: CSSProperties = {
  margin: "18px 0 0",
  padding: "8px 12px",
  borderRadius: "12px",
  background: "#09090b",
  border: "1px solid #27272a",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "11px",
  color: "#a1a1aa",
  wordBreak: "break-all",
};

const ACTIONS: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  justifyContent: "center",
  marginTop: "28px",
};

const PRIMARY_BUTTON: CSSProperties = {
  appearance: "none",
  border: "none",
  cursor: "pointer",
  borderRadius: "12px",
  padding: "10px 20px",
  fontSize: "13px",
  fontWeight: 700,
  fontFamily: "inherit",
  color: "#ffffff",
  background: "#4f46e5",
};

const SECONDARY_BUTTON: CSSProperties = {
  display: "inline-block",
  borderRadius: "12px",
  padding: "10px 20px",
  fontSize: "13px",
  fontWeight: 700,
  color: "#e4e4e7",
  textDecoration: "none",
  border: "1px solid #3f3f46",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Satu-satunya tujuan yang tersedia: konsol peramban. Tidak ada `logger`
    // di sini — modul itu server-only, dan tidak ada backend pelaporan galat
    // klien (Sentry sengaja belum dipasang). Yang menghubungkan laporan siswa
    // dengan baris log server adalah `digest` yang ditampilkan di bawah.
    console.error("root_layout_error", error);
  }, [error]);

  return (
    <html lang="id">
      <body style={BODY}>
        <main style={CARD}>
          <p style={BRAND}>NAWA-LEARN</p>
          <h1 style={HEADING}>Aplikasi gagal dimuat</h1>
          <p style={PARAGRAPH}>
            Terjadi kesalahan saat menyiapkan halaman ini. Coba muat ulang; bila
            terus berulang, laporkan kode kejadian di bawah kepada pengurus OSIS.
          </p>
          {error.digest ? <p style={DIGEST}>Kode kejadian: {error.digest}</p> : null}
          <div style={ACTIONS}>
            <button type="button" onClick={reset} style={PRIMARY_BUTTON}>
              Coba lagi
            </button>
            {/*
              Sengaja `<a>`, bukan `next/link`. Kalau layout akar yang gagal,
              router sisi klien justru bagian yang tidak bisa dipercaya; muat
              ulang penuh memaksa server merender ulang dari nol.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate full page load, see above */}
            <a href="/" style={SECONDARY_BUTTON}>
              Ke beranda
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
