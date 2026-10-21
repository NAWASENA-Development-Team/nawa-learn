// tests/unit/account-data-csv.test.ts
// The CSV half of "ekspor data saya" is pure, so it is pinned here without a
// database. Two properties matter and neither is cosmetic:
//
//   • a cell is always quoted, so a comma or a newline inside a question's text
//     cannot shift every following column;
//   • a cell that Excel would treat as a formula is defused, because question
//     text is written by *other users* and this file is opened on the exporter's
//     own machine.
import { describe, expect, it } from "vitest";
import {
  csvCell,
  exportUserDataCsv,
  type UserDataExport,
} from "@/lib/accountData";

describe("csvCell", () => {
  it("quotes a plain value", () => {
    expect(csvCell("Matematika")).toBe('"Matematika"');
  });

  it("doubles an embedded quote instead of breaking the cell", () => {
    expect(csvCell('kata "kutip"')).toBe('"kata ""kutip"""');
  });

  it("keeps commas and newlines inside the cell", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("baris\nbaru")).toBe('"baris\nbaru"');
  });

  it("defuses every character Excel treats as the start of a formula", () => {
    // `=HYPERLINK(...)` in a question's text is the real attack: it runs when
    // the exporter opens their own export in a spreadsheet.
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell("+1+1")).toBe('"\'+1+1"');
    expect(csvCell("-1+1")).toBe('"\'-1+1"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("\tcmd")).toBe('"\'\tcmd"');
    expect(csvCell("\rcmd")).toBe('"\'\rcmd"');
  });

  it("does not prefix a value that merely contains a risky character", () => {
    // The guard is anchored to the start; "a=b" is harmless text and must not
    // gain a stray apostrophe.
    expect(csvCell("a=b")).toBe('"a=b"');
  });
});

function fixture(): UserDataExport {
  return {
    exportedAt: "2026-10-17T00:00:00.000Z",
    policyVersion: "1.0",
    catatan: "Catatan untuk pembaca.",
    akun: {
      id: "u1",
      clerkId: "clerk_1",
      name: "Budi",
      email: "budi@example.test",
      role: "student",
      points: 120,
      seasonPoints: 40,
      createdAt: "2026-01-01T00:00:00.000Z",
      avatarIndex: 3,
      photoUrl: null,
      bio: "Belajar terus",
      motto: "Terus maju",
      levelFrame: "gold",
      consentPolicyVersion: "1.0",
      consentAcceptedAt: "2026-10-17T00:00:00.000Z",
    },
    modul: [
      {
        id: "m1",
        title: "Modul, dengan koma",
        subject: "Matematika",
        downloads: 5,
      },
    ],
    soal: [
      {
        id: "q1",
        questionText: "=SUM(A1:A2)",
        answerKey: "A",
        options: { A: "satu", B: "dua" },
      },
    ],
    ujian: [],
    poin: [{ id: "p1", action: "quiz_answer", delta: 10, refId: null }],
    pengajuan: [{ id: "s1", type: "module", status: "approved" }],
    laporan: [{ id: "r1", issueType: "bug", status: "pending" }],
    penanda: [{ moduleId: "m1", savedAt: "2026-10-17T00:00:00.000Z" }],
    surel: [
      {
        kind: "submission_approved",
        status: "sent",
        payload: { title: "Modul, dengan koma" },
        createdAt: "2026-10-17T00:00:00.000Z",
        sentAt: "2026-10-17T00:00:05.000Z",
      },
    ],
    harian: [{ windowStart: "2026-10-17T00:00:00.000Z", createdAt: "2026-10-17T00:00:00.000Z" }],
  };
}

describe("exportUserDataCsv", () => {
  it("starts with a header row and uses the long category,field,value shape", () => {
    const lines = exportUserDataCsv(fixture()).split("\r\n");
    expect(lines[0]).toBe('"kategori","kolom","nilai"');
    expect(lines[1]).toMatch(/^"modul\[0\]"/);
  });

  it("emits one row per field, so no table has to be flattened away", () => {
    const csv = exportUserDataCsv(fixture());
    // A field that only exists on one table is still present.
    expect(csv).toContain('"modul[0]","downloads","5"');
    expect(csv).toContain('"poin[0]","delta","10"');
    expect(csv).toContain('"laporan[0]","issueType","bug"');
    // The two categories M16 added are reached by the same generic loop, which
    // is exactly why they are asserted rather than assumed: a category that is
    // added to the export object but skipped here would be invisible in the one
    // file the student is told to keep.
    expect(csv).toContain('"surel[0]","kind","submission_approved"');
    expect(csv).toContain('"harian[0]","windowStart","2026-10-17T00:00:00.000Z"');
  });

  it("serialises a nested object as JSON rather than dropping it", () => {
    const csv = exportUserDataCsv(fixture());
    expect(csv).toContain('"soal[0]","options","{""A"":""satu"",""B"":""dua""}"');
  });

  it("defuses a formula hiding in user-written content", () => {
    const csv = exportUserDataCsv(fixture());
    expect(csv).toContain('"soal[0]","questionText","\'=SUM(A1:A2)"');
  });

  it("always includes the account block and the export metadata", () => {
    const csv = exportUserDataCsv(fixture());
    expect(csv).toContain('"akun","exportedAt","2026-10-17T00:00:00.000Z"');
    expect(csv).toContain('"akun","policyVersion","1.0"');
    expect(csv).toContain('"akun","email","budi@example.test"');
  });

  it("renders a null as an empty quoted cell, never the word null", () => {
    const csv = exportUserDataCsv(fixture());
    expect(csv).toContain('"akun","photoUrl",""');
    expect(csv).not.toContain('"akun","photoUrl","null"');
  });

  it("uses CRLF line endings, which is what Excel expects on Windows", () => {
    const csv = exportUserDataCsv(fixture());
    expect(csv).toContain("\r\n");
    // No bare LF: every newline in the structure is part of a CRLF pair.
    expect(csv.split("\r\n").length).toBe(csv.split("\n").length);
  });
});
