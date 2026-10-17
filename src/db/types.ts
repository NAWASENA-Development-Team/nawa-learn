// src/db/types.ts
// ─── Bentuk database yang dipakai modul lintas-runtime ────────────────────────
// Aplikasi ini punya dua runtime database yang berbeda kelasnya: Neon HTTP di
// produksi (src/db/index.ts) dan PGlite di test. Keduanya adalah Drizzle
// `PgDatabase` dengan skema yang sama, jadi modul yang harus bekerja di
// keduanya — job retensi dan ekspor/hapus data akun — diketik terhadap kelas
// induknya.
//
// Mengetiknya sebagai `typeof db` dari src/db/index.ts akan mengikat modul itu ke
// Neon dan membuatnya mustahil diuji tanpa jaringan, yang persis kebalikan dari
// tujuannya.
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "@/db/schema";

export type AppDb = PgDatabase<PgQueryResultHKT, typeof schema>;
