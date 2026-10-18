// scripts/verify-m13.mjs
// Read-only check that migration 0004 landed: the seven indexes exist and the
// data that was already there is still there. Run with:
//   node --env-file=.env.local scripts/verify-m13.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const indexes = await sql`
  select indexname, tablename
  from pg_indexes
  where schemaname = 'public'
    and indexname in (
      'custom_exams_created_idx',
      'modules_uploader_idx',
      'questions_status_created_idx',
      'questions_uploader_idx',
      'reports_user_created_idx',
      'submissions_submitter_created_idx',
      'users_points_idx'
    )
  order by indexname
`;

const [{ migrations }] = await sql`
  select count(*)::int as migrations from drizzle.__drizzle_migrations
`;
const [{ users }] = await sql`select count(*)::int as users from users`;

console.log(JSON.stringify({ migrations, users, indexes }, null, 2));
