"use client";

import { useEffect, useState } from "react";
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Info,
  Trophy,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { LatexRenderer } from "@/components/ui/LatexRenderer";

export interface DailyQuizQuestion {
  id: string;
  questionText: string;
  // `options` adalah jsonb `{ A: "...", B: "...", ... }`. Diketik sebagai
  // `Record<string, string>` — bukan `any` — supaya `Object.entries` di bawah
  // mengembalikan kunci dan nilai bertipe `string`.
  options: Record<string, string>;
  // Tidak ada `answerKey` di sini, dan itu disengaja: server menilai setiap
  // jawaban dan baru mengirim kunci yang benar setelah jawaban itu tercatat.
}

/**
 * Tiga keadaan halaman, ditentukan server.
 *
 * Sebelum M18 komponen ini menerima `initialQuestions` (sampai 20 soal) dan
 * mengurus antrean, pengulangan soal yang salah, dan progres penguasaan. Semua
 * itu hilang bersama sesi dua puluh soal: yang tersisa hanya satu soal, satu
 * percobaan, dan satu hadiah.
 */
export type DailyQuizClientProps =
  | { status: "empty" }
  | { status: "ready"; question: DailyQuizQuestion }
  | { status: "done"; isCorrect: boolean };

type ClaimState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; message: string }
  | { state: "info"; message: string }
  | { state: "error"; message: string };

interface Verdict {
  correct: boolean;
  correctKey: string;
}

export default function DailyQuizClient(props: DailyQuizClientProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [claim, setClaim] = useState<ClaimState>({ state: "idle" });

  /**
   * Klaim hadiah harian. Idempoten di sisi server: indeks unik `points_log`
   * membuat klaim kedua tidak membayar apa pun, jadi aman dipanggil berkali-kali.
   *
   * `quiet` dipakai saat halaman dimuat dalam keadaan "sudah menjawab benar":
   * "hadiah sudah diklaim hari ini" adalah kabar baik, bukan pesan yang perlu
   * ditampilkan ulang setiap kunjungan. Kegagalan tetap ditampilkan.
   */
  // Deklarasi fungsi biasa dan **tanpa** setState sebelum `await`. Itu bukan
  // kebetulan: aturan `react-hooks/set-state-in-effect` menelusuri badan fungsi
  // ini dari dalam `useEffect` di bawah, dan satu `setState` sinkron saja sudah
  // cukup untuk membuatnya menuduh efek ini memicu render berantai. Penanda
  // "sedang mengklaim" karena itu dipasang di pemanggilnya (`handleCheck`), yang
  // memang tempatnya: yang perlu melihat status memuat adalah tombol yang baru
  // diklik, bukan klaim senyap saat halaman dimuat.
  async function claimDaily(quiet: boolean) {
    try {
      const res = await fetch("/api/quiz/daily-claim", { method: "POST" });
      if (!res.ok) {
        setClaim({
          state: "error",
          message: "Hadiah belum bisa diklaim. Coba muat ulang halaman.",
        });
        return;
      }
      const data = (await res.json()) as { success?: boolean; message?: string };
      if (quiet && !data.success) return;
      setClaim({
        state: data.success ? "ok" : "info",
        message: data.message ?? "Hadiah harian belum bisa diklaim.",
      });
    } catch {
      setClaim({
        state: "error",
        message: "Tidak ada koneksi. Coba muat ulang halaman.",
      });
    }
  }

  const alreadyCorrect = props.status === "done" && props.isCorrect;

  useEffect(() => {
    // Klaim senyap saat halaman dimuat dalam keadaan "sudah menjawab benar".
    // `claimDaily` tidak menyentuh state sebelum `await fetch`, jadi ini bukan
    // setState sinkron di badan efek; aturan `set-state-in-effect` menelusuri
    // badan fungsi yang dipanggil efek dan tidak bisa membedakannya.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (alreadyCorrect) void claimDaily(true);
  }, [alreadyCorrect]);

  async function handleCheck() {
    if (props.status !== "ready" || !selected || checking || verdict) return;

    setChecking(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { [props.question.id]: selected } }),
      });
      // `fetch` hanya menolak pada kegagalan jaringan; 400/429/500 sampai di
      // sini sebagai respons biasa. Tanpa `res.ok`, tombol "Cek Jawaban" akan
      // mengumumkan hasil untuk permintaan yang ditolak.
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        results?: { questionId: string; correct: boolean; correctKey: string }[];
      };
      const graded = data.results?.[0];

      if (!res.ok || !data.success || !graded) {
        setSubmitError(data.error ?? "Jawabanmu gagal diperiksa. Coba lagi.");
        return;
      }

      setVerdict({ correct: graded.correct, correctKey: graded.correctKey });

      if (graded.correct) {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.7 },
          zIndex: 60,
        });
        // Penanda memuat dipasang di sini, bukan di dalam `claimDaily`: hanya
        // klaim yang dipicu klik yang perlu menampilkan "sedang mengklaim".
        setClaim({ state: "loading" });
        void claimDaily(false);
      }
    } catch {
      setSubmitError("Tidak ada koneksi. Coba lagi.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2 text-zinc-900 dark:text-white">
          <BrainCircuit className="h-8 w-8 text-indigo-500" /> Kuis Harian
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-medium">
          Satu soal setiap hari. Jawab benar, dapat +25 V-Points.
        </p>
      </div>

      {props.status === "empty" && <EmptyCard />}

      {props.status === "done" && (
        <DoneCard isCorrect={props.isCorrect} claim={claim} />
      )}

      {props.status === "ready" && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
          <div
            className={`h-2 w-full transition-colors duration-300 ${
              !verdict
                ? "bg-indigo-500"
                : verdict.correct
                  ? "bg-nawa-success"
                  : "bg-red-500"
            }`}
          />

          <div className="p-6 sm:p-8">
            <div className="min-h-[120px] mb-8">
              <h3 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-zinc-100 leading-relaxed">
                <LatexRenderer text={props.question.questionText} />
              </h3>
            </div>

            <div className="space-y-3">
              {Object.entries(props.question.options).map(([key, text]) => {
                const isSelected = selected === key;
                const isCorrectAnswer = key === verdict?.correctKey;

                let btnClass =
                  "border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50";
                let icon = null;

                if (verdict) {
                  if (isCorrectAnswer) {
                    btnClass =
                      "border-nawa-success bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100 ring-1 ring-nawa-success";
                    icon = (
                      <CheckCircle2 className="h-5 w-5 text-nawa-success shrink-0" />
                    );
                  } else if (isSelected) {
                    btnClass =
                      "border-red-500 bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-100 ring-1 ring-red-500";
                    icon = <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
                  } else {
                    btnClass = "border-zinc-200 dark:border-zinc-800 opacity-40";
                  }
                } else if (isSelected) {
                  btnClass =
                    "border-nawa-primary bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-nawa-primary";
                }

                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    disabled={verdict !== null}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] disabled:cursor-default ${btnClass}`}
                  >
                    <div className="flex gap-3.5 items-start">
                      <span
                        className={`h-6 w-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                          verdict && isCorrectAnswer
                            ? "bg-emerald-600 text-white"
                            : verdict && isSelected
                              ? "bg-red-600 text-white"
                              : isSelected
                                ? "bg-nawa-primary text-white"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {key}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          verdict && isCorrectAnswer
                            ? "text-emerald-950 dark:text-emerald-100 font-semibold"
                            : verdict && isSelected
                              ? "text-red-950 dark:text-red-100 font-semibold"
                              : "text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        <LatexRenderer text={text} />
                      </span>
                    </div>
                    {icon}
                  </button>
                );
              })}
            </div>

            {submitError && (
              <p className="mt-5 text-sm font-semibold text-red-600 dark:text-red-400">
                {submitError}
              </p>
            )}

            {verdict && (
              <div
                className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${
                  verdict.correct
                    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                    : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                }`}
              >
                {verdict.correct
                  ? "Benar! Hadiah +25 V-Points masuk otomatis."
                  : `Belum tepat. Jawaban yang benar: ${verdict.correctKey}. Soal berikutnya besok pukul 03.00 WIB.`}
              </div>
            )}
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-3 justify-between items-center">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" /> Satu soal, satu percobaan
            </span>

            {!verdict && (
              <button
                onClick={() => void handleCheck()}
                disabled={!selected || checking}
                className="bg-nawa-primary hover:bg-nawa-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                {checking ? "Memeriksa..." : "Cek Jawaban"}{" "}
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}

            {verdict && (
              <Link
                href="/questions/practice"
                className="bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                Latihan soal lain
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-8 text-center">
      <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
        <Info className="h-7 w-7 text-zinc-500" />
      </div>
      <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
        Belum ada soal untuk hari ini
      </h2>
      <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">
        Bank soal yang sudah disetujui masih kosong. Kuis Harian kembali setelah
        ada soal yang lolos peninjauan.
      </p>
      <Link
        href="/questions/practice"
        className="inline-flex items-center gap-2 mt-6 bg-nawa-primary hover:bg-nawa-primary-hover text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
      >
        Latihan dari bank soal
      </Link>
    </div>
  );
}

function DoneCard({
  isCorrect,
  claim,
}: {
  isCorrect: boolean;
  claim: ClaimState;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-8 text-center">
      <div
        className={`mx-auto mb-4 h-14 w-14 rounded-2xl flex items-center justify-center ${
          isCorrect
            ? "bg-emerald-100 dark:bg-emerald-950/40"
            : "bg-red-100 dark:bg-red-950/40"
        }`}
      >
        {isCorrect ? (
          <Trophy className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
        )}
      </div>

      <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
        {isCorrect ? "Soal hari ini sudah kamu jawab benar" : "Soal hari ini sudah kamu jawab"}
      </h2>

      <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">
        {isCorrect
          ? "Hadiah harian sudah diklaim otomatis. Kembali besok pukul 03.00 WIB untuk soal berikutnya."
          : "Jawaban hari ini belum tepat, dan percobaannya sudah terpakai. Soal berikutnya besok pukul 03.00 WIB."}
      </p>

      {claim.state === "loading" && (
        <p className="text-xs font-semibold text-zinc-500 mt-4">Memproses hadiah...</p>
      )}
      {claim.state === "ok" && (
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-4">
          {claim.message}
        </p>
      )}
      {claim.state === "info" && (
        <p className="text-xs font-semibold text-zinc-500 mt-4">{claim.message}</p>
      )}
      {claim.state === "error" && (
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-4">
          {claim.message}
        </p>
      )}

      <div className="flex flex-wrap gap-3 justify-center mt-6">
        <Link
          href="/questions/practice"
          className="bg-nawa-primary hover:bg-nawa-primary-hover text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
        >
          Latihan soal lain
        </Link>
        <Link
          href="/leaderboard"
          className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95"
        >
          Lihat peringkat
        </Link>
      </div>
    </div>
  );
}
