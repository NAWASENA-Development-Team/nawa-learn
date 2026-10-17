// src/app/privacy/page.tsx
// Halaman publik (lihat PUBLIC_ROUTES di src/proxy.ts). Bahasa Indonesia, sengaja
// sederhana: pembacanya pelajar SMA, bukan pengacara.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { RETENTION_POLICY } from "@/lib/retention";
import {
  DATA_CONTROLLER,
  PRIVACY_CONTACT_EMAIL,
  POLICY_PATHS,
} from "@/lib/policy";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | NAWA-LEARN SMAN 2 Jonggol",
  description:
    "Data apa yang NAWA-LEARN simpan, kenapa, siapa yang bisa melihat, berapa lama disimpan, dan cara mengekspor atau menghapusnya.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Kebijakan Privasi"
      intro={`Kami menulis ini dengan bahasa sehari-hari supaya kamu benar-benar tahu apa yang terjadi dengan datamu. Pengendali data: ${DATA_CONTROLLER}.`}
    >
      <LegalSection number={1} title="Yang perlu kamu tahu dulu">
        <LegalList
          items={[
            <>Kami <strong>tidak menjual</strong> datamu dan <strong>tidak memasang iklan</strong>.</>,
            <>Kami hanya menyimpan apa yang benar-benar dipakai fitur yang ada.</>,
            <>Kamu bisa <strong>mengunduh semua datamu</strong> dan <strong>menghapus akunmu sendiri</strong> dari halaman profil, tanpa perlu menghubungi admin.</>,
            <>Akunmu butuh persetujuan ini satu kali. Kalau kebijakan berubah secara penting, kami akan meminta persetujuanmu lagi.</>,
          ]}
        />
      </LegalSection>

      <LegalSection number={2} title="Data apa yang kami simpan">
        <p>Hanya ini, dan hanya kalau kamu benar-benar memakainya:</p>
        <LegalList
          items={[
            <><strong>Identitas akun</strong> — nama tampilan, alamat surel, dan ID akun dari layanan masuk (Clerk). Surel dipakai untuk masuk dan untuk menghubungimu soal akun.</>,
            <><strong>Profil yang kamu isi sendiri</strong> — foto profil, bio, motto, dan pilihan avatar. Semuanya opsional.</>,
            <><strong>Karya yang kamu unggah</strong> — judul, mata pelajaran, kelas, dan tautan berkas modul; teks soal, pilihan jawaban, kunci jawaban, dan pembahasan.</>,
            <><strong>Aktivitas belajar</strong> — jawaban kuis, nilai ujian buatanmu, dan riwayat poin (V-Point).</>,
            <><strong>Laporan yang kamu kirim</strong> — jenis masalah dan uraiannya, kalau kamu melaporkan bug atau konten.</>,
            <><strong>Catatan teknis</strong> — waktu kamu menyetujui kebijakan ini, dan ID permintaan di log server saat terjadi error.</>,
          ]}
        />
        <p>
          Kami <strong>tidak</strong> meminta nomor telepon, NISN, alamat rumah, data kesehatan, atau data
          biometrik. Jangan pernah menuliskan hal-hal itu di bio, motto, atau deskripsi laporan.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Kenapa kami menyimpannya">
        <LegalList
          items={[
            <><strong>Persetujuanmu</strong> — akun, profil, karya, dan aktivitas belajarmu ada karena kamu setuju memakainya.</>,
            <><strong>Menjalankan layanan</strong> — poin, peringkat, dan antrean moderasi tidak bisa bekerja tanpa catatan aktivitas.</>,
            <><strong>Kepentingan sah yang terbatas</strong> — log error dan pembatasan permintaan (rate limit) dipakai untuk menjaga platform tetap hidup dan aman.</>,
          ]}
        />
        <p>
          Kami tidak memakai datamu untuk membuat profil perilaku, tidak mengirimkannya ke broker data, dan
          tidak memakainya untuk melatih model AI.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Siapa yang bisa melihat">
        <LegalList
          items={[
            <><strong>Siswa lain</strong> hanya melihat profil publikmu: nama tampilan, avatar, bio, motto, poin, peringkat, serta modul dan soal yang sudah disetujui. <strong>Alamat surelmu tidak pernah ditampilkan.</strong></>,
            <><strong>Moderator dan admin sekolah</strong> melihat antrean moderasi dan laporan, termasuk nama pengirimnya, karena itu tugas mereka.</>,
            <><strong>Penyedia layanan</strong> yang kami pakai untuk menjalankan platform: Clerk (masuk/akun), Neon (database), Vercel (hosting dan penyimpanan berkas), serta Upstash (pembatas permintaan) bila diaktifkan. Mereka memproses data atas nama kami, bukan untuk kepentingan mereka sendiri.</>,
          ]}
        />
        <p>Kami tidak mengirim datamu ke pihak lain, kecuali diwajibkan hukum yang berlaku.</p>
      </LegalSection>

      <LegalSection number={5} title="Berapa lama kami menyimpannya">
        <p>
          Data yang kamu lihat di profilmu disimpan selama akunmu ada. Sebagian catatan teknis punya masa
          simpan sendiri, dan sebuah tugas terjadwal menghapusnya secara otomatis:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 pr-4 font-bold text-zinc-900 dark:text-white">Jenis data</th>
                <th className="py-2 pr-4 font-bold text-zinc-900 dark:text-white">Disimpan</th>
                <th className="py-2 font-bold text-zinc-900 dark:text-white">Alasan</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_POLICY.map((rule) => (
                <tr key={rule.key} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4 align-top font-semibold">{rule.label}</td>
                  <td className="py-2 pr-4 align-top whitespace-nowrap">{rule.windowMonths} bulan</td>
                  <td className="py-2 align-top text-zinc-500 dark:text-zinc-400">{rule.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Modul, soal, dan ujian yang kamu bagikan tetap ada karena dibaca siswa lain. Kalau kamu menghapus
          akunmu, semuanya tetap tampil tetapi atribusinya berubah menjadi <strong>&ldquo;Anonim&rdquo;</strong>.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Hakmu">
        <LegalList
          items={[
            <><strong>Melihat</strong> — seluruh data yang kami simpan tentangmu bisa kamu unduh sebagai berkas JSON atau CSV di <Link className="font-bold text-indigo-600 hover:underline dark:text-indigo-400" href="/profile/privacy">halaman privasi profilmu</Link>.</>,
            <><strong>Memperbaiki</strong> — nama, foto, bio, dan motto bisa kamu ubah sendiri kapan saja di profilmu.</>,
            <><strong>Menghapus</strong> — tombol <em>Hapus akun saya</em> memutus akun Clerk-mu, mengosongkan identitas pribadimu, dan menghapus laporan serta riwayat poinmu. Tindakan ini permanen dan tidak bisa dibatalkan.</>,
            <><strong>Menarik persetujuan</strong> — menarik persetujuan sama dengan menghapus akun, karena tanpa persetujuan kami tidak punya dasar untuk menyimpan datamu.</>,
            <><strong>Mengajukan keberatan</strong> — kirim surel ke {PRIVACY_CONTACT_EMAIL}; kami menjawab paling lama 14 hari kerja.</>,
          ]}
        />
      </LegalSection>

      <LegalSection number={7} title="Cara kami melindungi data">
        <LegalList
          items={[
            <>Setiap halaman dan setiap API tertutup secara bawaan: tanpa sesi yang sah, permintaan ditolak sebelum sampai ke data.</>,
            <>Peran (siswa, kontributor, moderator, admin) diperiksa di sisi server di dalam setiap endpoint yang menyentuh data orang lain.</>,
            <>Log server menyensor kolom yang berisi data pribadi (surel, nama, bio, motto, foto) sebelum ditulis.</>,
            <>Kunci jawaban ujian tidak pernah dikirim ke browser; penilaian dilakukan di server.</>,
            <>Kata sandi tidak pernah melewati server kami — ditangani sepenuhnya oleh Clerk.</>,
          ]}
        />
      </LegalSection>

      <LegalSection number={8} title="Kalau kamu masih di bawah umur">
        <p>
          Sebagian besar pengguna NAWA-LEARN adalah pelajar. Karena itu kami sengaja mengumpulkan sesedikit
          mungkin: tanpa nomor telepon, tanpa alamat, tanpa NISN. Kami menyarankan kamu memberi tahu orang
          tua atau walimu bahwa kamu memakai platform ini. Kalau kamu atau orang tuamu ingin akunmu
          dihapus, gunakan tombol hapus akun atau kirim surel ke {PRIVACY_CONTACT_EMAIL} — kami
          akan menghapusnya tanpa meminta alasan.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Kalau terjadi kebocoran data">
        <p>
          Kami mencatat setiap dugaan kebocoran dan menilainya dalam <strong>1×24 jam</strong>. Kalau
          terbukti ada data pribadi yang terdampak, kami memberi tahu pengguna yang terdampak dan pihak
          sekolah paling lama <strong>3×24 jam (72 jam)</strong> sejak kami mengetahuinya, berisi: data apa
          yang terdampak, apa yang sudah kami lakukan, dan apa yang sebaiknya kamu lakukan. Prosedur
          lengkapnya ada di <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">docs/INCIDENT-RESPONSE.md</code>.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Kalau kebijakan ini berubah">
        <p>
          Setiap perubahan material menaikkan nomor versi di atas dan menghapus tanda persetujuanmu, sehingga
          kamu akan diminta menyetujui versi baru sebelum bisa memakai dashboard lagi. Kami tidak pernah
          mengubah kebijakan secara diam-diam.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Hubungi kami">
        <p>
          Pertanyaan, permintaan data, atau keberatan: <a className="font-bold text-indigo-600 hover:underline dark:text-indigo-400" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
          Dokumen pendamping: <Link className="font-bold text-indigo-600 hover:underline dark:text-indigo-400" href={POLICY_PATHS.terms}>Ketentuan Layanan</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
