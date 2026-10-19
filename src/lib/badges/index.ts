// src/lib/badges/index.ts
// ─── Permukaan lencana yang aman untuk browser ────────────────────────────────
//
// Barrel ini sengaja **tidak** mengekspor `catalog.ts` maupun `evaluate.ts`.
// Keduanya berisi 85 fungsi kondisi, termasuk delapan syarat lencana rahasia, dan
// sebuah barrel yang mengekspornya berarti setiap komponen klien yang hanya butuh
// `getRarityColor` ikut membawa seluruh katalog ke bundel browser.
//
// Aturannya sederhana: komponen klien mengimpor dari `@/lib/badges`; kode server
// mengimpor `@/lib/badges/evaluate` secara eksplisit. `tests/unit/badges.test.ts`
// memindai sumber untuk memastikan tidak ada komponen klien yang melanggar.

export {
  BADGE_CATEGORY_ORDER,
  getRarityColor,
  getRarityTextColor,
  getSpecialtyBadge,
} from "./display";

export type {
  Badge,
  BadgeCategory,
  BadgeDisplay,
  BadgeRarity,
  BadgeUnlockData,
  SpecialtyStats,
} from "./types";
