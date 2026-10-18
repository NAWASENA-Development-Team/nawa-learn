// src/app/(dashboard)/profile/[id]/loading.tsx
// Sama dengan skeleton milik `/profile`: kartu profilnya identik, hanya id yang
// berbeda. Markup bersama itu ada di `src/components/profile/ProfileSkeleton.tsx`.
import ProfileSkeleton from "@/components/profile/ProfileSkeleton";

export default function ProfileIdLoading() {
  return <ProfileSkeleton />;
}
