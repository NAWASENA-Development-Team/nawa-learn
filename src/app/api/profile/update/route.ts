// app/api/profile/update/route.ts
// The caller edits their own row, and nothing else.
//
// This route used to copy four "allowed" keys straight from the request body
// with no schema at all. That meant `photoUrl` could be a base64 data-URL of any
// size (the 2 MB check lived only in the browser), a `motto` longer than
// `varchar(200)` surfaced as a 500 instead of a 400, and `avatarIndex` could be
// negative or far past the end of AVATAR_OPTIONS. All four fields now have a
// schema and a limit.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { deleteObject, isOwnStorageUrl } from "@/lib/storage";
import { parseJsonBody } from "@/lib/validation";

export const maxDuration = 15;

export const BIO_MAX_LENGTH = 500;
export const MOTTO_MAX_LENGTH = 200;

/**
 * `photoUrl` may only be null (remove) or a URL inside our own blob store.
 *
 * Accepting an arbitrary https URL would let a student point their leaderboard
 * avatar at a third-party host — turning the leaderboard into a free image
 * delivery network and a tracking pixel that fires for every visitor.
 */
const updateSchema = z
  .object({
    avatarIndex: z.number().int().min(0).max(AVATAR_OPTIONS.length - 1).nullable().optional(),
    photoUrl: z
      .string()
      .max(2048)
      .refine(isOwnStorageUrl, { message: "photoUrl must point at our own storage" })
      .nullable()
      .optional(),
    bio: z.string().trim().max(BIO_MAX_LENGTH).nullable().optional(),
    motto: z.string().trim().max(MOTTO_MAX_LENGTH).nullable().optional(),
  })
  // An unknown key is a client bug, not something to silently ignore.
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No updatable fields provided",
  });

export async function POST(req: Request) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const dbUser = authz.user;

  // IP-scoped only: the handler updates the caller's own row, so the useful
  // abuse signal is "one address hammering the endpoint", not a user identity.
  const limit = await rateLimit(req, "profile/update", null);
  if (!limit.ok) return limit.response;

  const parsed = await parseJsonBody(req, updateSchema);
  if (!parsed.ok) return parsed.response;
  const update = parsed.data;

  try {
    // Only needed when the photo changes: the old object has to be removed, or a
    // deleted photo stays publicly readable at its old URL forever.
    let previousPhotoUrl: string | null = null;
    if ("photoUrl" in update) {
      const current = await db.query.users.findFirst({
        where: eq(users.id, dbUser.id),
        columns: { photoUrl: true },
      });
      previousPhotoUrl = current?.photoUrl ?? null;
    }

    await db.update(users).set(update).where(eq(users.id, dbUser.id));

    if (previousPhotoUrl && previousPhotoUrl !== update.photoUrl && isOwnStorageUrl(previousPhotoUrl)) {
      try {
        await deleteObject(previousPhotoUrl);
      } catch (error) {
        // The profile is already updated; an orphaned object is a storage
        // cleanup problem, not a failed request.
        log.warn("failed to delete replaced photo", { error });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Profile update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
