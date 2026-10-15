// src/db/promote.ts
// ─── Role bootstrap ───────────────────────────────────────────────────────────
// Grants (or revokes) reviewer access. Needed because moderator access is now
// derived purely from `users.role` — there is no password gate any more.
//
// Usage:
//   npm run db:promote -- someone@example.com moderator
//   npm run db:promote -- someone@example.com admin
//   npm run db:promote -- user_2abc123 contributor   # also accepts a Clerk id
//
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const VALID_ROLES = ["guest", "student", "contributor", "moderator", "admin"] as const;
type Role = (typeof VALID_ROLES)[number];

async function main() {
  const [identifier, roleArg = "moderator"] = process.argv.slice(2);

  if (!identifier) {
    console.error("Usage: npm run db:promote -- <email-or-clerk-id> [role]");
    console.error(`Roles: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  if (!(VALID_ROLES as readonly string[]).includes(roleArg)) {
    console.error(`Invalid role "${roleArg}". Allowed: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }
  const role = roleArg as Role;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  const target =
    (await db.query.users.findFirst({
      where: eq(schema.users.email, identifier),
      columns: { id: true, name: true, email: true, clerkId: true, role: true },
    })) ??
    (await db.query.users.findFirst({
      where: eq(schema.users.clerkId, identifier),
      columns: { id: true, name: true, email: true, clerkId: true, role: true },
    })) ??
    null;

  if (!target) {
    console.error(`No user found for "${identifier}" (tried email, then clerk id).`);
    process.exit(1);
  }

  if (target.role === role) {
    console.log(`"${target.name}" (${target.email}) is already "${role}". Nothing to do.`);
    process.exit(0);
  }

  await db.update(schema.users).set({ role }).where(eq(schema.users.id, target.id));

  console.log(`Updated "${target.name}" (${target.email}): ${target.role} → ${role}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error updating role:", err);
  process.exit(1);
});
