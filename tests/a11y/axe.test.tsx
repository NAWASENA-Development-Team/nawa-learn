// @vitest-environment jsdom
// tests/a11y/axe.test.tsx
// ─── axe-core di dalam suite, bukan di dalam browser (M15c) ───────────────────
// Audit aksesibilitas yang tidak pernah dijalankan sama saja dengan tidak ada,
// dan itu persis keadaan repo ini sampai M15c: "axe belum pernah dijalankan"
// tertulis di roadmap selama beberapa milestone.
//
// Kenapa bukan Playwright. Semua defect yang ditemukan ada di balik auth gate:
// `PUBLIC_ROUTES` hanya membuka `/`, `/sign-in`, `/sign-up`, `/privacy`, `/terms`,
// sementara 33 kontrol form hidup di `/submit`, `/practice`, `/profile`, dan
// `/moderator`. Job CI ini **hermetic** — `tests/unit/ci-gates.test.ts` gagal bila
// `secrets.*` masuk kembali (lihat C8 di docs/AUDIT-AND-ROADMAP.md) — sehingga
// browser sungguhan hanya akan mengaudit halaman pemasaran dan melaporkan hijau
// atas form yang tidak pernah ia lihat. Karena itu komponennya dirender langsung
// dengan `renderToStaticMarkup`, lalu HTML-nya diperiksa `axe-core` di dalam DOM
// jsdom. Nol secret, nol server, dan ikut `npm run test` yang sudah menjadi gate.
//
// Yang **tidak** bisa diperiksa di sini, dan karenanya tidak diklaim:
//   • `color-contrast` — jsdom tidak menghitung layout, jadi axe menjawab
//     "incomplete" untuk setiap teks. Dimatikan secara eksplisit di bawah.
//   • ukuran target sentuh dan tata letak responsif — butuh browser.
//   • perilaku pembaca layar sungguhan (NVDA/JAWS/VoiceOver) — butuh manusia.
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

// Komponen klien memanggil hook router; di luar app router hook itu melempar.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import ConsentForm from "@/components/legal/ConsentForm";
import { ModuleSubmitForm } from "@/components/submit/ModuleSubmitForm";
import { CreateExamModal } from "@/components/practice/CreateExamModal";
import PrivacyClient from "@/components/profile/PrivacyClient";
import LeaderboardClient from "@/components/leaderboard/LeaderboardClient";
import { ToastProvider } from "@/components/ui/Toast";

const RULES = {
  // jsdom tidak punya layout: axe melaporkan setiap teks sebagai "incomplete",
  // dan aturan yang tidak bisa dijawab lebih baik dimatikan daripada dibiarkan
  // menghasilkan alarm palsu yang membuat orang berhenti membaca hasilnya.
  "color-contrast": { enabled: false },
  "color-contrast-enhanced": { enabled: false },
};

async function audit(element: ReactElement) {
  const markup = renderToStaticMarkup(element);

  // Dirender ke dokumen jsdom milik test ini, bukan ke JSDOM baru: axe-core
  // memeriksa tipe `context` terhadap `Node` global, dan sebuah instance JSDOM
  // terpisah membawa kelas `Node`-nya sendiri — hasilnya "axe.run arguments are
  // invalid", bukan hasil audit.
  //
  // `lang` dan `<title>` diisi karena keduanya diperiksa aturan WCAG tingkat A;
  // tanpa itu setiap komponen gagal karena kekurangan halaman, bukan karena
  // kekurangan dirinya.
  document.documentElement.lang = "id";
  document.title = "NAWA-LEARN";
  document.body.innerHTML = markup;

  const results = await axe.run(document.body, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: RULES,
  });

  document.body.innerHTML = "";

  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

/** Pesan gagal yang bisa dibaca tanpa membuka devtools. */
function report(violations: Awaited<ReturnType<typeof audit>>): string {
  if (violations.length === 0) return "";
  return violations
    .map(
      (violation) =>
        `${violation.rule} (${violation.impact}): ${violation.help}\n    ${violation.nodes.join("\n    ")}`,
    )
    .join("\n");
}

/** Toast memakai context; komponen mana pun yang memanggil `useToast` butuh ini. */
function withToast(element: ReactElement) {
  return createElement(ToastProvider, null, element);
}

describe("axe: komponen yang dirender tidak punya pelanggaran WCAG A/AA", () => {
  it("ConsentForm — kotak centang persetujuan UU PDP", async () => {
    const violations = await audit(withToast(createElement(ConsentForm)));
    expect(violations, report(violations)).toEqual([]);
  });

  it("ModuleSubmitForm — 3 kontrol + unggahan modul", async () => {
    const violations = await audit(withToast(createElement(ModuleSubmitForm)));
    expect(violations, report(violations)).toEqual([]);
  });

  it("CreateExamModal — metadata ujian", async () => {
    const violations = await audit(
      withToast(createElement(CreateExamModal, { onClose: () => {}, onExamCreated: () => {} })),
    );
    expect(violations, report(violations)).toEqual([]);
  });

  it("PrivacyClient — ekspor dan hapus akun", async () => {
    const violations = await audit(
      withToast(
        createElement(PrivacyClient, {
          name: "Siswa Contoh",
          email: "siswa@example.com",
          policyVersion: "2026-01",
          consentVersion: "2026-01",
          consentAcceptedAt: "2026-01-01T00:00:00.000Z",
          consentIsCurrent: true,
          retention: [{ label: "Laporan", windowMonths: 12 }],
        }),
      ),
    );
    expect(violations, report(violations)).toEqual([]);
  });

  it("LeaderboardClient — pencarian dan filter", async () => {
    const violations = await audit(
      withToast(
        createElement(LeaderboardClient, {
          topUsers: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              name: "Siswa Contoh",
              points: 120,
              seasonPoints: 120,
              avatarIndex: 0,
              photoUrl: null,
            },
          ],
          loggedInUser: null,
          totalStudents: 1,
          seasonLabel: "Semester Ini",
        }),
      ),
    );
    expect(violations, report(violations)).toEqual([]);
  });
});

describe("axe: harness-nya sendiri tidak hijau secara hampa", () => {
  it("mendeteksi markup yang memang salah", async () => {
    // Gerbang yang selalu hijau tidak bisa dibedakan dari gerbang yang tidak
    // pernah jalan. Dua probe ini membuktikan `audit()` benar-benar memanggil
    // axe dan benar-benar membaca hasilnya — bukan sekadar mengembalikan array
    // kosong. Keduanya sengaja dibuat salah.
    // `<div aria-label>` tanpa peran: axe menandainya ketika elemen itu tidak
    // punya teks isi, karena nama ARIA-nya lalu tidak menggantikan apa pun.
    const prohibited = await audit(createElement("div", { "aria-label": "tanpa peran" }));
    expect(prohibited.map((violation) => violation.rule)).toContain("aria-prohibited-attr");

    const unlabelled = await audit(createElement("input", { type: "text" }));
    expect(unlabelled.map((violation) => violation.rule)).toContain("label");
  });
});
