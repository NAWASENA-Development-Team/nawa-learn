// tests/helpers/source.ts
// ─── Membaca sumber untuk gerbang, bukan untuk dijalankan ─────────────────────
//
// Beberapa tripwire di repo ini memeriksa **kode sumber**, bukan keluaran yang
// dirender: `pii-surface.test.ts` (kolom PII tidak boleh disentuh), `badges.test.ts`
// (katalog lencana tidak boleh masuk bundel klien), dan `route-boundaries.test.ts`
// (batas route harus ada di direktori yang benar). Semuanya punya masalah yang
// sama: sebuah komentar yang **menjelaskan** aturannya akan terbaca sebagai
// pelanggaran aturan itu.
//
// Itu bukan masalah teoretis. M14e menambahkan komentar di
// `api/moderator/hidden-badges/route.ts` yang menyebut kolom `email` justru untuk
// menerangkan kenapa kolom itu **tidak** dipilih — dan tripwire PII langsung
// memerah. Cara termudah membuatnya hijau adalah menghapus penjelasannya, yang
// persis kebalikan dari yang diinginkan. Jadi komentar dibuang lebih dulu.
//
// Penyapu ini bukan parser TypeScript: ia mengenali tiga bentuk yang dipakai repo
// ini (`//`, `/* … */`, dan `{/* … */}` di JSX). Itu cukup karena yang diperiksa
// hanya keberadaan sebuah frasa atau nama kolom, bukan struktur sintaks.
export function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `(^|[^:])` menjaga `https://` dan kawan-kawan: yang dianggap komentar
    // hanyalah `//` yang tidak didahului titik dua.
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
