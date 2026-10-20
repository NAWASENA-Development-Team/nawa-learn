// components/submit/types.ts
// ─── Konstanta bersama formulir kontribusi ───────────────────────────────────
//
// Dipakai oleh formulir modul dan formulir soal (daftar mata pelajaran), serta
// oleh modal picker Google Drive (daftar berkas tiruannya). Ditarik ke file
// sendiri agar keduanya tidak masing-masing menyimpan salinan daftar — dua
// salinan pasti berubah arah.

import * as z from "zod";

/** Mata pelajaran standar SMAN 2 Jonggol. */
export const SUBJECTS = [
  "Matematika", "Fisika", "Kimia", "Biologi",
  "Sejarah", "Geografi", "Ekonomi", "Sosiologi",
  "Bahasa Indonesia", "Bahasa Inggris", "Informatika"
];

export const moduleSchema = z.object({
  title: z.string().min(5, "Judul minimal harus 5 karakter"),
  subject: z.string().min(2, "Mata pelajaran wajib dipilih atau diisi"),
  grade: z.string().min(1, "Kelas wajib dipilih"),
  category: z.string().min(2, "Kategori wajib dipilih"),
  // https only. `data:` used to be accepted here, which is how base64 documents
  // ended up in a Postgres text column; binary content now goes through
  // /api/uploads and comes back as a URL.
  contentUrl: z.string().refine(
    (val) => /^https?:\/\/.+/.test(val),
    { message: "Wajib menyertakan URL file/dokumen yang valid atau unggah berkas terlebih dahulu" }
  ),
});

export type ModuleFormData = z.infer<typeof moduleSchema>;

export interface MockDriveFile {
  name: string;
  size: string;
  type: "PDF" | "DOCX" | "PPTX";
  link: string;
}

/**
 * Berkas tiruan untuk picker Google Drive.
 *
 * Ini **bukan** integrasi Drive sungguhan — Google Drive API butuh OAuth yang
 * platform ini tidak punya. Daftarnya tetap ada supaya alur unggahnya bisa
 * dicoba; tautan yang benar-benar disimpan adalah yang ditempel pengguna di
 * tab Drive, dan `modules.content_url` hanya menerima `http(s)`.
 */
export const MOCK_DRIVE_FILES: MockDriveFile[] = [
  { name: "Ringkasan_Fisika_Kuantum_Lengkap_XI.pdf", size: "4.2 MB", type: "PDF", link: "https://drive.google.com/file/d/1A2B3C-fisika-kuantum/view" },
  { name: "Soal_Latihan_UTBK_Matematika_2026.docx", size: "1.8 MB", type: "DOCX", link: "https://drive.google.com/file/d/1X9Y8Z-utbk-matematika/view" },
  { name: "Catatan_Biologi_Sel_dan_Genetika_X.pdf", size: "6.5 MB", type: "PDF", link: "https://drive.google.com/file/d/1M5N6O-biologi-sel/view" },
  { name: "Slide_Presentasi_Sejarah_Kemerdekaan_XII.pptx", size: "12.4 MB", type: "PPTX", link: "https://drive.google.com/file/d/1P2Q3R-sejarah/view" },
  { name: "Bank_Soal_Kimia_Unsur_Materi_Reguler.pdf", size: "3.1 MB", type: "PDF", link: "https://drive.google.com/file/d/1K7L8M-kimia-unsur/view" }
];
