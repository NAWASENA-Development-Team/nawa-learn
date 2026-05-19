// lib/avatars.ts
// Shared avatar options — used by ProfileClient and LeaderboardClient

export interface AvatarOption {
  svg: string;
  bg: string;
  label: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  // Fantasy Theme
  { svg: "/avatars/wizard.svg",      bg: "from-purple-400 to-indigo-600",  label: "Penyihir Rumus" },
  { svg: "/avatars/knight.svg",      bg: "from-slate-400 to-slate-600",    label: "Ksatria Baja" },
  { svg: "/avatars/dragon.svg",      bg: "from-red-400 to-red-600",        label: "Naga Penjaga" },
  { svg: "/avatars/elf.svg",         bg: "from-green-400 to-green-600",    label: "Peri Hutan" },
  { svg: "/avatars/mage.svg",        bg: "from-purple-400 to-purple-600",  label: "Penyihir Rumus" },
  { svg: "/avatars/archer.svg",      bg: "from-amber-400 to-amber-600",    label: "Pemanah Mahir" },
  { svg: "/avatars/paladin.svg",     bg: "from-yellow-400 to-yellow-600",  label: "Kesatria Cahaya" },
  { svg: "/avatars/rogue.svg",       bg: "from-gray-400 to-gray-600",      label: "Pencuri Bayangan" },
  { svg: "/avatars/necromancer.svg", bg: "from-orange-800 to-gray-900",    label: "Penyihir Gelap" },
  { svg: "/avatars/bard.svg",        bg: "from-pink-400 to-pink-600",      label: "Penyanyi Legendaris" },
  // Sci-Fi Theme
  { svg: "/avatars/cyborg.svg",      bg: "from-cyan-400 to-blue-600",      label: "Cyborg Futuristik" },
  { svg: "/avatars/alien.svg",       bg: "from-green-400 to-green-600",    label: "Makhluk Asing" },
  { svg: "/avatars/robot.svg",       bg: "from-amber-400 to-orange-600",   label: "Robot Cerdas" },
  { svg: "/avatars/astronaut.svg",   bg: "from-indigo-400 to-indigo-600",  label: "Penjelajah Angkasa" },
  { svg: "/avatars/hacker.svg",      bg: "from-gray-800 to-gray-900",      label: "Hacker Jenius" },
  { svg: "/avatars/pilot.svg",       bg: "from-cyan-400 to-blue-600",      label: "Pilot Pemberani" },
  { svg: "/avatars/android.svg",     bg: "from-purple-400 to-purple-600",  label: "Android Canggih" },
  { svg: "/avatars/spaceman.svg",    bg: "from-red-400 to-red-600",        label: "Prajurit Luar Angkasa" },
  { svg: "/avatars/scientist.svg",   bg: "from-green-400 to-green-600",    label: "Ilmuwan Brilian" },
  { svg: "/avatars/engineer.svg",    bg: "from-amber-400 to-orange-600",   label: "Insinyur Handal" },
  { svg: "/avatars/explorer.svg",    bg: "from-amber-700 to-amber-900",    label: "Penjelajah Petualang" },
  { svg: "/avatars/guardian.svg",    bg: "from-pink-400 to-pink-600",      label: "Penjaga Galaksi" },
  { svg: "/avatars/mystic.svg",      bg: "from-purple-400 to-purple-600",  label: "Mistis Gaib" },
];
