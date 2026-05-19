// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env');
  }

  // Get headers for Svix verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error: Missing Svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error: Invalid signature', { status: 400 });
  }

  const eventType = evt.type;

  // Helper: resolve the best display name from Clerk event data
  function resolveName(data: {
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    email_addresses?: { email_address: string }[];
    external_accounts?: { provider: string }[];
  }): string {
    const { first_name, last_name, username, email_addresses, external_accounts } = data;
    const isGoogleAuth = external_accounts?.some(
      (acc) => acc.provider === 'google' || acc.provider === 'oauth_google',
    );
    // Google OAuth → use real name from Google profile
    if (isGoogleAuth && (first_name || last_name)) {
      return `${first_name || ''} ${last_name || ''}`.trim();
    }
    // Username-based sign-up → use username as display name
    if (username) return username;
    // Last resort: name fields or email prefix
    const fromName = `${first_name || ''} ${last_name || ''}`.trim();
    if (fromName) return fromName;
    return email_addresses?.[0]?.email_address?.split('@')[0] || 'Student';
  }

  // Sync new user to our database
  if (eventType === 'user.created') {
    const { id, email_addresses } = evt.data;
    const email = email_addresses[0]?.email_address;
    const name = resolveName(evt.data as Parameters<typeof resolveName>[0]);

    try {
      await db.insert(users).values({
        clerkId: id,
        email: email,
        name: name,
        role: 'student',
        points: 0,
      });
      return new Response('User successfully synced to Neon', { status: 200 });
    } catch (error) {
      console.error('Database sync error:', error);
      return new Response('Error syncing user to database', { status: 500 });
    }
  }

  // Keep DB name in sync when user updates their Clerk profile
  if (eventType === 'user.updated') {
    const { id, email_addresses } = evt.data;
    const email = email_addresses[0]?.email_address;
    const name = resolveName(evt.data as Parameters<typeof resolveName>[0]);

    try {
      await db.update(users)
        .set({ name, email })
        .where(eq(users.clerkId, id));
      return new Response('User updated in Neon', { status: 200 });
    } catch (error) {
      console.error('Database update error:', error);
      return new Response('Error updating user in database', { status: 500 });
    }
  }

  return new Response('Webhook received', { status: 200 });
}
