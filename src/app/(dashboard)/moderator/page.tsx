// src/app/(dashboard)/moderator/page.tsx
// ─── The moderator gate ───────────────────────────────────────────────────────
// Access is decided here, on the server, from `users.role`. The panel UI lives in
// `src/components/moderator/ModeratorClient.tsx` and only ever mounts for a
// reviewer, so there is no "checking access" spinner and no client-side branch a
// browser could skip by not running the JavaScript.
//
// `notFound()` rather than a friendly "Akses Ditolak" card: a signed-in student
// who guesses this URL learns nothing about whether the panel exists, which is
// the same reason the deny-by-default proxy answers an unknown URL with a
// redirect instead of a 404. A legitimate reviewer always has the row this check
// reads — there is no "role not propagated yet" state to explain, because the
// role is read from the same row the check just fetched.
//
// Note that this is a *page*, not an API route: a page cannot return a `Response`,
// which is why it uses `getCurrentUser()` rather than `requireReviewer()`. The
// moderator APIs behind the panel each carry `requireReviewer()` themselves, so
// this gate is defence in depth rather than the only defence.
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { canReview } from "@/lib/authz";
import ModeratorClient from "@/components/moderator/ModeratorClient";

export default async function ModeratorPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !canReview(currentUser)) {
    notFound();
  }

  // `seatKind` is derived on the server from `season_role_key` and passed as a
  // prop; the client never decides which tabs it is allowed to see. A human
  // reviewer has a NULL key (granted via `db:promote`), a season seat does not.
  const seatKind = currentUser.seasonRoleKey === null ? "human" : "seat";

  return <ModeratorClient seatKind={seatKind} />;
}
