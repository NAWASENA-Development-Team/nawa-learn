// tests/unit/pii-surface.test.ts
// ─── Permukaan PII, dijaga sebagai invarian (M12) ─────────────────────────────
// Minimisasi data bukan sesuatu yang "sudah dikerjakan" lalu selesai; ia sebuah
// sifat yang harus tetap benar setelah perubahan berikutnya. Test ini menjaga
// empat sifat yang, kalau rusak, rusaknya diam-diam:
//
//   1. **`users.email` tidak pernah keluar dari API.** Satu-satunya route yang
//      boleh menyentuhnya adalah webhook Clerk, yang menerimanya dari Clerk dan
//      menuliskannya ke database. Tidak ada route yang membacanya kembali untuk
//      dikirim ke klien — sebuah alamat surel di payload adalah PII yang
//      berpindah ke cache browser, devtools, dan log jaringan.
//   2. **Tidak ada `db.select()` tanpa daftar kolom.** Seleksi liar mulai
//      membawa kolom baru begitu skema bertambah — termasuk kolom PII yang
//      ditambahkan orang lain enam bulan kemudian.
//   3. **Baris audit hanya ditulis lewat satu helper.** Helper itulah yang
//      membatasi `before`/`after` pada skalar; sebuah `insert(auditLog)`
//      langsung di route akan menjadi salinan baris `users` di tabel kedua.
//   4. **Identitas hanya dikosongkan di satu tempat.** `clerk_id` yang diganti
//      tombstone harus terjadi di `accountData.ts` saja, supaya ekspor, hapus
//      mandiri, dan webhook tidak pernah punya definisi "anonim" yang berbeda.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(process.cwd(), "src");

function walk(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, extensions));
    } else if (extensions.some((extension) => entry.endsWith(extension))) {
      out.push(full);
    }
  }
  return out;
}

const relative = (file: string) => path.relative(SRC, file).replace(/\\/g, "/");
const read = (file: string) => readFileSync(file, "utf8");

const TS_FILES = walk(SRC, [".ts", ".tsx"]);
const API_FILES = TS_FILES.filter((file) => relative(file).startsWith("app/api/"));

/** Route that legitimately receives an email address from Clerk and stores it. */
const EMAIL_INGEST_ALLOWED = new Set(["app/api/webhooks/clerk/route.ts"]);

describe("email addresses stay inside the webhook", () => {
  it("is referenced by exactly one API route", () => {
    const offenders = API_FILES.filter(
      (file) => /\bemail\b/i.test(read(file)) && !EMAIL_INGEST_ALLOWED.has(relative(file)),
    ).map(relative);

    expect(offenders).toEqual([]);
  });

  it("is never returned as a response key from any API route", () => {
    // `NextResponse.json({ email: ... })` and `{ email: ... }` object literals
    // that reach a response. The webhook is exempt: it only ever *reads* Clerk's
    // `email_address` field into the database.
    const offenders = API_FILES.filter((file) => {
      if (EMAIL_INGEST_ALLOWED.has(relative(file))) return false;
      return /\bemail\s*:/i.test(read(file));
    }).map(relative);

    expect(offenders).toEqual([]);
  });

  it("keeps the address out of every moderator-facing response", () => {
    // The moderation surfaces are the ones most likely to "helpfully" add an
    // author's email to a queue row. None of them may.
    const moderatorFiles = API_FILES.filter((file) => relative(file).includes("moderator/"));

    expect(moderatorFiles.length).toBeGreaterThan(0);
    for (const file of moderatorFiles) {
      expect(read(file)).not.toMatch(/\bemail\b/i);
    }
  });
});

describe("no unbounded column selection", () => {
  it("never calls db.select() without an explicit column list", () => {
    // `db.select().from(users)` returns every column the table has *today*. The
    // column added tomorrow is the one that leaks.
    const offenders = TS_FILES.filter((file) => /\.select\(\)/.test(read(file))).map(relative);

    expect(offenders).toEqual([]);
  });
});

// The tripwire above found this one for real during M12: the public profile page
// called `db.select().from(questions)` — pulling `answer_key` into a page any
// visitor can open — and `db.query.users.findFirst({ where })` with no column
// list, which fetched `email` and both consent columns of *other* students. It
// then serialised `clerkId` to the client and printed its last four characters on
// a public certificate. None of that was visible in the rendered output, which is
// exactly why it survived nine milestones.
describe("the public profile page ships no identity", () => {
  const PAGE = "app/(dashboard)/profile/[id]/page.tsx";

  it("does not touch the email column at all", () => {
    // Kode, bukan prosa: komentar di berkas ini justru menyebut kolomnya untuk
    // menjelaskan mengapa ia tidak dibaca.
    const page = read(path.join(SRC, PAGE));

    expect(page).not.toMatch(/dbUser\.email/);
    expect(page).not.toMatch(/\bemail\s*:/);
    expect(page).not.toMatch(/consent(PolicyVersion|AcceptedAt)/);
  });

  it("does not hand the Clerk id to the client component", () => {
    expect(read(path.join(SRC, PAGE))).not.toMatch(/clerkId:\s*dbUser\.clerkId/);
  });

  it("does not accept email or clerkId as client props", () => {
    const client = read(path.join(SRC, "components/profile/ProfileClient.tsx"));

    expect(client).not.toMatch(/^\s*clerkId: string;$/m);
    expect(client).not.toMatch(/^\s*email: string;$/m);
  });
});

describe("audit rows are written through the helper only", () => {
  it("is the only module that inserts into audit_log", () => {
    const writers = TS_FILES.filter((file) => {
      const source = read(file);
      return /insert\(\s*schema\.auditLog|insert\(\s*auditLog|\.insert\(auditLog\)/.test(source);
    }).map(relative);

    expect(writers).toEqual(["lib/auditLog.ts"]);
  });

  it("is called by every moderation decision route", () => {
    const mustRecord = [
      "app/api/modules/approve/route.ts",
      "app/api/questions/approve/route.ts",
      "app/api/questions/reject/route.ts",
    ];

    for (const route of mustRecord) {
      const source = read(path.join(SRC, route));
      expect(source, `${route} must call recordAudit`).toContain("recordAudit(");
    }
  });

  it("is called when a role is changed from the CLI", () => {
    const source = read(path.join(SRC, "db/promote.ts"));
    expect(source).toContain("recordAudit(");
    expect(source).toContain('"user.role_change"');
  });
});

describe("identity is blanked in exactly one place", () => {
  it("writes the clerk_id tombstone only from accountData", () => {
    const writers = TS_FILES.filter((file) => /clerkId:\s*`deleted:/.test(read(file))).map(relative);

    expect(writers).toEqual(["lib/accountData.ts"]);
  });

  it("routes every erasure path through the same helper", () => {
    // Two doors, one implementation: self-service deletion and the Clerk
    // webhook. If either grew its own blanking code, the two would drift.
    const selfService = read(path.join(SRC, "app/api/profile/delete/route.ts"));
    expect(selfService).toContain("deleteAccountData(");

    const webhook = read(path.join(SRC, "app/api/webhooks/clerk/route.ts"));
    expect(webhook).toContain('evt.type === "user.deleted"');
    expect(webhook).toContain("anonymiseAccountByClerkId(");
  });
});
