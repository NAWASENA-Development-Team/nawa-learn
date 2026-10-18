// src/app/(dashboard)/profile/loading.tsx
// Bentuk skeleton-nya tinggal di `src/components/profile/ProfileSkeleton.tsx`
// karena `profile/[id]/loading.tsx` membutuhkan markup yang sama persis.
import ProfileSkeleton from "@/components/profile/ProfileSkeleton";

export default function ProfileLoading() {
  return <ProfileSkeleton />;
}
