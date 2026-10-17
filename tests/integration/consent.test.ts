// tests/integration/consent.test.ts
// The consent gate is two halves that must agree: the layout that refuses to
// render a dashboard without agreement, and the endpoint that records it. A bug
// in either direction is a compliance failure — a gate that never fires records
// nothing, and an endpoint that trusts the client records the wrong thing.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
const redirectState = vi.hoisted(() => ({ target: undefined as string | undefined }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
// Next's `redirect()` never returns — it throws a sentinel the framework
// catches. The mock records the target and throws too, so the layout cannot fall
// through to rendering after deciding to redirect.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirectState.target = to;
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import { auth, currentUser } from "@clerk/nextjs/server";
import * as schema from "@/db/schema";
import { POST as acceptConsent } from "@/app/api/consent/accept/route";
import DashboardLayout from "@/app/(dashboard)/layout";
import { POLICY_VERSION } from "@/lib/policy";

const authMock = vi.mocked(auth);
const currentUserMock = vi.mocked(currentUser);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
  currentUserMock.mockReset();
  redirectState.target = undefined;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function post(body: unknown): Request {
  return new Request("https://nawa.test/api/consent/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

async function readConsent(userId: string) {
  return db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { consentPolicyVersion: true, consentAcceptedAt: true },
  });
}

describe("POST /api/consent/accept — identity", () => {
  it("answers 401 without a session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await acceptConsent(post({ accept: true, policyVersion: POLICY_VERSION }));

    expect(response.status).toBe(401);
  });
});

describe("POST /api/consent/accept — the body cannot overstate agreement", () => {
  it("rejects an unchecked box: `accept` must be literal true", async () => {
    signIn(uniqueId("clerk"));

    const response = await acceptConsent(post({ accept: false, policyVersion: POLICY_VERSION }));

    expect(response.status).toBe(400);
  });

  it("rejects a client that names a policy version that does not exist", async () => {
    signIn(uniqueId("clerk"));

    const response = await acceptConsent(post({ accept: true, policyVersion: "9.9" }));

    expect(response.status).toBe(400);
  });

  it("rejects a body with no version at all", async () => {
    signIn(uniqueId("clerk"));

    const response = await acceptConsent(post({ accept: true }));

    expect(response.status).toBe(400);
  });

  it("rejects an unknown key rather than ignoring it", async () => {
    signIn(uniqueId("clerk"));

    const response = await acceptConsent(
      post({ accept: true, policyVersion: POLICY_VERSION, acceptedAt: "1999-01-01" }),
    );

    expect(response.status).toBe(400);
  });

  it("answers 400, never 500, for malformed JSON", async () => {
    signIn(uniqueId("clerk"));

    const response = await acceptConsent(post("{ not json"));

    expect(response.status).toBe(400);
  });
});

describe("POST /api/consent/accept — recording", () => {
  it("stamps the current version and time on an existing row", async () => {
    const user = await seedUser(db, {});
    signIn(user.clerkId);

    const response = await acceptConsent(post({ accept: true, policyVersion: POLICY_VERSION }));
    const body = (await response.json()) as {
      ok: boolean;
      policyVersion: string;
      acceptedAt: string;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.ok).toBe(true);
    expect(body.policyVersion).toBe(POLICY_VERSION);

    const row = await readConsent(user.id);
    expect(row?.consentPolicyVersion).toBe(POLICY_VERSION);
    expect(row?.consentAcceptedAt).not.toBeNull();
    expect(body.acceptedAt).toBe(new Date(row!.consentAcceptedAt!).toISOString());
  });

  it("re-accepts after a policy bump, overwriting the old version", async () => {
    const user = await seedUser(db, {});
    await db
      .update(schema.users)
      .set({ consentPolicyVersion: "0.9", consentAcceptedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(schema.users.id, user.id));
    signIn(user.clerkId);

    const response = await acceptConsent(post({ accept: true, policyVersion: POLICY_VERSION }));

    expect(response.status).toBe(200);
    const row = await readConsent(user.id);
    expect(row?.consentPolicyVersion).toBe(POLICY_VERSION);
  });

  it("provisions the row when the webhook has not run yet, instead of trapping the user", async () => {
    const clerkId = uniqueId("clerk");
    const email = `${clerkId}@example.test`;
    signIn(clerkId);
    currentUserMock.mockResolvedValue({
      id: clerkId,
      emailAddresses: [{ emailAddress: email }],
      username: "budi",
    } as never);

    const response = await acceptConsent(post({ accept: true, policyVersion: POLICY_VERSION }));

    expect(response.status).toBe(200);
    const row = await db.query.users.findFirst({ where: eq(schema.users.clerkId, clerkId) });
    expect(row).toBeDefined();
    expect(row?.email).toBe(email);
    expect(row?.consentPolicyVersion).toBe(POLICY_VERSION);
  });

  it("answers 401 when the row is missing and Clerk gives us no profile to build one from", async () => {
    signIn(uniqueId("clerk"));
    currentUserMock.mockResolvedValue(null as never);

    const response = await acceptConsent(post({ accept: true, policyVersion: POLICY_VERSION }));

    expect(response.status).toBe(401);
  });
});

describe("DashboardLayout — the consent gate", () => {
  /** Calls the layout and reports where it tried to send the caller. */
  async function visit(): Promise<string | undefined> {
    redirectState.target = undefined;
    try {
      await DashboardLayout({ children: null });
    } catch {
      // The mock redirect throws, exactly as the real one does.
    }
    return redirectState.target;
  }

  it("sends an anonymous visitor to sign-in", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    expect(await visit()).toBe("/sign-in");
  });

  it("sends a session with no database row to /consent, not into the dashboard", async () => {
    signIn(uniqueId("clerk"));

    expect(await visit()).toBe("/consent");
  });

  it("sends a row that never accepted the policy to /consent", async () => {
    const user = await seedUser(db, {});
    signIn(user.clerkId);

    expect(await visit()).toBe("/consent");
  });

  it("sends a row that accepted an older policy version to /consent", async () => {
    const user = await seedUser(db, {});
    await db
      .update(schema.users)
      .set({ consentPolicyVersion: "0.9" })
      .where(eq(schema.users.id, user.id));
    signIn(user.clerkId);

    expect(await visit()).toBe("/consent");
  });

  it("lets a row with the current consent version through", async () => {
    const user = await seedUser(db, {});
    await db
      .update(schema.users)
      .set({ consentPolicyVersion: POLICY_VERSION })
      .where(eq(schema.users.id, user.id));
    signIn(user.clerkId);

    expect(await visit()).toBeUndefined();
  });
});
