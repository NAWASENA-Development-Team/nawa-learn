// src/app/terms/page.tsx
// Halaman publik (lihat PUBLIC_ROUTES di src/proxy.ts).
import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { PRIVACY_CONTACT_EMAIL, POLICY_PATHS } from "@/lib/policy";

export const metadata: Metadata = {
  title: "Ketentuan Layanan | NAWA-LEARN SMAN 2 Jonggol",
  description:
    "Aturan memakai NAWA-LEARN: apa yang boleh diunggah, bagaimana poin bekerja, dan apa yang terjadi kalau aturannya dilanggar.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Ketentuan Layanan"
      intro="Dengan membuat akun, kamu setuju memakai NAWA-LEARN sesuai aturan di bawah ini. Tujuannya sederhana: menjaga platform tetap aman dan bermanfaat untuk semua siswa."
    >
      <LegalSection number={1} title="Apa itu NAWA-LEARN">
        <p>
          NAWA-LEARN adalah platform belajar kolaboratif yang dikelola OSIS NAWASENA SMAN 2 Jonggol melalui
          Divisi ICT. Platform ini dipakai untuk berbagi modul, berlatih soal, dan mengikuti peringkat
          belajar. Layanan ini gratis dan ditujukan untuk warga sekolah.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Akunmu adalah tanggung jawabmu">
        <LegalList
          items={[
            <>Berikan data yang benar saat mendaftar, dan jangan memakai identitas orang lain.</>,
            <>Jangan berbagi kata sandi atau kode masuk dengan siapa pun, termasuk teman sekelas.</>,
            <>Semua aktivitas yang tercatat di akunmu dianggap kamu lakukan sendiri.</>,
            <>Kamu boleh menghapus akunmu sendiri kapan saja — caranya ada di halaman profil.</>,
          ]}
        />
      </LegalSection>

      <LegalSection number={3} title="Apa yang boleh kamu unggah">
        <p>
          Unggah karya yang kamu buat sendiri atau yang boleh kamu bagikan. Kalau memakai materi orang lain,
          cantumkan sumbernya.
        </p>
        <p>Yang <strong>tidak</strong> boleh diunggah:</p>
        <LegalList
          items={[
            <>Materi berhak cipta tanpa izin, termasuk buku bajakan dan soal ujian resmi yang belum boleh dipublikasikan.</>,
            <>Konten yang menyerang, melecehkan, atau merendahkan orang lain, termasuk SARA dan perundungan.</>,
            <>Konten dewasa, kekerasan, atau tautan ke situs semacam itu.</>,
            <>Berkas berbahaya: program jahat, skrip yang mencuri data, atau tautan yang menyamar.</>,
            <>Data pribadi orang lain tanpa izinnya (nomor telepon, alamat, nilai rapor, dsb).</>,
          ]}
        />
        <p>
          Semua modul dan soal masuk ke antrean moderasi lebih dulu. Moderator berhak menolak tanpa
          menjelaskan secara rinci, tetapi alasan penolakan akan dicatat.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Cara kerja poin dan peringkat">
        <LegalList
          items={[
            <>Poin XP diberikan untuk kontribusi dan latihan yang sah, dihitung di server.</>,
            <>Soal kuis dinilai di server dan hanya boleh dijawab sekali per soal; mengakali sistem ini adalah pelanggaran.</>,
            <>Ujian yang kamu buat sendiri <strong>tidak</strong> menghasilkan poin, supaya kamu tidak bisa memberi poin kepada dirimu sendiri.</>,
            <>Peringkat diperbarui berkala. Poin dapat dibatalkan bila terbukti diperoleh dengan cara curang.</>,
          ]}
        />
      </LegalSection>

      <LegalSection number={5} title="Isi yang kamu bagikan">
        <p>
          Kamu tetap pemilik karya yang kamu unggah. Dengan mengunggahnya, kamu memberi sekolah izin
          menampilkan, menyimpan, dan membagikannya di dalam platform untuk keperluan belajar.
        </p>
        <p>
          Kami bisa menyembunyikan atau menghapus unggahan yang melanggar aturan, dan menonaktifkan akun yang
          berulang kali melanggar. Untuk pelanggaran berat, akun bisa dinonaktifkan langsung.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Yang tidak kami janjikan">
        <LegalList
          items={[
            <>Platform ini disediakan apa adanya, sebagai sarana belajar tambahan — bukan pengganti pelajaran di kelas.</>,
            <>Nilai dan peringkat di sini tidak memengaruhi nilai rapor atau kelulusan.</>,
            <>Kami berusaha menjaga layanan tetap tersedia, tetapi perbaikan atau gangguan bisa terjadi tanpa pemberitahuan sebelumnya.</>,
            <>Modul dan soal dibuat oleh siswa. Kami memoderasi sebaik mungkin, tetapi tetap periksa ulang sebelum memakainya.</>,
          ]}
        />
      </LegalSection>

      <LegalSection number={7} title="Privasi">
        <p>
          Cara kami memperlakukan datamu diatur di <Link className="font-bold text-nawa-primary hover:underline dark:text-indigo-400" href={POLICY_PATHS.privacy}>Kebijakan Privasi</Link>,
          yang merupakan bagian dari ketentuan ini.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Perubahan ketentuan">
        <p>
          Ketentuan ini bisa berubah bila platform berkembang. Perubahan penting menaikkan nomor versi di
          atas dan akan meminta persetujuanmu kembali.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Kontak">
        <p>
          Pertanyaan, laporan pelanggaran, atau keberatan: <a className="font-bold text-nawa-primary hover:underline dark:text-indigo-400" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>,
          atau Divisi ICT OSIS NAWASENA SMAN 2 Jonggol.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
