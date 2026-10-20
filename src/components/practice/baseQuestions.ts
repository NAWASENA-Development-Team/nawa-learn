// components/practice/baseQuestions.ts
// ─── Bank soal contoh bawaan ──────────────────────────────────────────────────
//
// Soal-soal ini hanya hidup di browser: tidak ada baris `questions` di belakang
// kuncinya. Itu sebabnya `answerKey` di sini **boleh** terlihat — penilaian
// kuis server mengabaikannya dan memakai kunci dari database, `answerKey` ini
// hanya dipakai sebagai fallback saat menampilkan layar hasil untuk kuis
// contoh (lihat `QuizResultsScreen`).
import type { Question } from "./types";

export const BASE_QUESTIONS: Question[] = [
  {
    id: "q1",
    subject: "Fisika",
    category: "Olimpiade",
    text: "Sebuah partikel bergerak melingkar beraturan dengan jari-jari lintasan 2 meter. Jika partikel tersebut melakukan 120 putaran per menit, maka percepatan sentripetal partikel tersebut adalah...",
    options: {
      A: "8π² m/s²",
      B: "16π² m/s²",
      C: "32π² m/s²",
      D: "64π² m/s²",
      E: "128π² m/s²"
    },
    answerKey: "C"
  },
  {
    id: "q2",
    subject: "Matematika",
    category: "UTBK",
    text: "Tentukan nilai limit x mendekati 0 untuk fungsi aljabar trigonometri berikut: (cos(4x) - 1) / (x · tan(2x)) adalah...",
    options: {
      A: "-4",
      B: "-2",
      C: "0",
      D: "2",
      E: "4"
    },
    answerKey: "A"
  },
  {
    id: "q3",
    subject: "Biologi",
    category: "Reguler",
    text: "Organel sel eukariotik ganda yang berperan aktif dalam proses sintesis lipid, metabolisme karbohidrat, detoksifikasi racun, serta menyimpan ion kalsium di dalam sel adalah...",
    options: {
      A: "Mitokondria",
      B: "Ribosom",
      C: "Retikulum Endoplasma Kasar",
      D: "Retikulum Endoplasma Halus",
      E: "Aparatus Golgi"
    },
    answerKey: "D"
  },
  {
    id: "q4",
    subject: "Kimia",
    category: "Olimpiade",
    text: "Sebanyak 10 gram senyawa hidrat tembaga(II) sulfat (CuSO₄·xH₂O) dipanaskan hingga semua air kristalnya menguap. Jika massa zat anhidrat yang tersisa adalah 6,4 gram, maka nilai x dalam rumus hidrat tersebut adalah... (Ar Cu=64, S=32, O=16, H=1)",
    options: {
      A: "1",
      B: "2",
      C: "3",
      D: "4",
      E: "5"
    },
    answerKey: "E"
  },
  {
    id: "q5",
    subject: "Matematika",
    category: "UTBK",
    text: "Dalam sebuah kotak terdapat 5 bola merah dan 3 bola putih. Jika diambil 2 bola secara acak sekaligus, peluang terambilnya minimal 1 bola merah adalah...",
    options: {
      A: "15/28",
      B: "20/28",
      C: "22/28",
      D: "25/28",
      E: "27/28"
    },
    answerKey: "D"
  }
];
