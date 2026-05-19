// app/api/profile/update/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only allow these fields to be updated
  const allowed = ['avatarIndex', 'photoUrl', 'bio', 'motto'] as const;
  const updateData: Partial<{
    avatarIndex: number | null;
    photoUrl: string | null;
    bio: string | null;
    motto: string | null;
  }> = {};

  for (const key of allowed) {
    if (key in body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updateData as any)[key] = body[key] ?? null;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  try {
    await db.update(users).set(updateData).where(eq(users.clerkId, clerkId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
