// src/i18n/t.ts
// ─── Satu cara untuk membaca katalog ─────────────────────────────────────────
//
// `t("nav.modules")` — key bertitik menelusuri `messages`, dan path yang salah
// **gagal saat kompilasi**, bukan saat render. Tidak ada dependensi: ini peta
// objek biasa, jadi ia bekerja di server component, client component, dan tes
// dengan import yang sama. Saat ada locale kedua yang nyata, satu-satunya yang
// berubah adalah dari `messages` menjadi resolver per-locale; pemanggil tidak
// perlu disentuh.
//
// **Tidak ada interpolasi variabel** — niat. Kalimat yang membutuhkan elemen
// React di tengahnya (seperti paragraf persetujuan UU PDP yang tautannya harus
// bisa diklik) dipecah menjadi beberapa key, bukan dipaksa lewat template
// string. Interpolasi string tidak bisa menghasilkan `<Link>` tanpa
// `dangerouslySetInnerHTML`, dan itu pertukaran yang salah untuk satu kalimat.
import { messages, type Messages } from "./messages";

/** Semua path bertitik yang menuju sebuah leaf string, contoh: `"nav.modules"`. */
export type MessagePath<T = Messages, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : MessagePath<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Nilai leaf untuk sebuah path — selalu `string`. */
type Leaf<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Leaf<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Mengambil string dari katalog. Path yang tidak ada tidak akan lulus
 * kompilasi; jika somehow terjadi saat runtime (data dinamis), lempar dengan
 * key-nya agar langsung terlihat, bukan merender kosong.
 *
 * @example t("nav.modules") → "Modul"
 */
export function t<P extends MessagePath>(path: P): Leaf<Messages, P> {
  const value = resolve(path);
  if (typeof value !== "string") {
    throw new Error(`i18n: path "${path}" tidak ditemukan di katalog`);
  }
  return value as Leaf<Messages, P>;
}

function resolve(path: string): unknown {
  let node: unknown = messages;
  for (const segment of path.split(".")) {
    // `__proto__`/`constructor`/`prototype` ada di setiap objek, jadi `in` akan
    // menganggapnya "ditemukan" dan menelusuri rantai prototipe. Path selalu
    // literal saat kompilasi, tapi penjagaan ini tetap murah dan sejalan dengan
    // `examScoring` yang membuang key yang sama dari blob ujian.
    if (segment === "__proto__" || segment === "constructor" || segment === "prototype") {
      return undefined;
    }
    if (typeof node !== "object" || node === null || !(segment in node)) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}
