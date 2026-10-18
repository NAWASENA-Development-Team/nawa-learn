// scripts/verify-m14.mjs
// Read-only check that migration 0005 landed: the `bookmarks` table exists with
// both indexes, and the data that was already there is still there. Run with:
//   node --env-file=.env.local scripts/verify-m14.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const indexes = await sql`
  select indexname, tablename
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'bookmarks'
  order by indexname
`;

const [{ migrations }] = await sql`
  select count(*)::int as migrations from drizzle.__drizzle_migrations
`;
const [{ users }] = await sql`select count(*)::int as users from users`;
const [{ bookmarks }] = await sql`select count(*)::int as bookmarks from bookmarks`;

console.log(JSON.stringify({ migrations, users, bookmarks, indexes }, null, 2));
