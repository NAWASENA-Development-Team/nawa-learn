// Badge System - 80+ Achievement Badges
// Organized by category for competitive learning

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "contribution" | "learning" | "social" | "milestone" | "subject" | "special";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  unlockCondition: (data: BadgeUnlockData) => boolean;
  howToUnlock: string;
}

export interface BadgeUnlockData {
  points: number;
  rank: number;
  totalStudents: number;
  approvedModules: number;
  approvedQuestions: number;
  totalDownloads: number;
  modulesBySubject: Record<string, number>;
  questionsCreated: number;
  accountAgeInDays: number;
  createdAt: string;
}

// Helper function to calculate days since account creation
export const getDaysOldAccount = (createdAt: string): number => {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
};

export const BADGES: Badge[] = [
  // ========== CONTRIBUTION BADGES (20) ==========
  {
    id: "first_step",
    title: "Langkah Pertama",
    description: "Mendapatkan poin kontribusi pertamamu",
    icon: "🌱",
    category: "contribution",
    rarity: "common",
    unlockCondition: (data) => data.points > 0,
    howToUnlock: "Unggah modul atau soal pertamamu"
  },
  {
    id: "module_contributor",
    title: "Pustakawan Sekolah",
    description: "Mengunggah 1 modul yang disetujui",
    icon: "📚",
    category: "contribution",
    rarity: "common",
    unlockCondition: (data) => data.approvedModules >= 1,
    howToUnlock: "Upload 1 modul yang disetujui moderator"
  },
  {
    id: "prolific_contributor",
    title: "Kontributor Produktif",
    description: "Mengunggah 5 modul yang disetujui",
    icon: "📖",
    category: "contribution",
    rarity: "uncommon",
    unlockCondition: (data) => data.approvedModules >= 5,
    howToUnlock: "Upload 5 modul yang disetujui"
  },
  {
    id: "knowledge_creator",
    title: "Pencipta Soal",
    description: "Membuat 3 latihan soal yang disetujui",
    icon: "⚡",
    category: "contribution",
    rarity: "uncommon",
    unlockCondition: (data) => data.approvedQuestions >= 3,
    howToUnlock: "Buat 3 soal latihan yang disetujui"
  },
  {
    id: "question_master",
    title: "Master Soal",
    description: "Membuat 10 latihan soal yang disetujui",
    icon: "🎯",
    category: "contribution",
    rarity: "rare",
    unlockCondition: (data) => data.approvedQuestions >= 10,
    howToUnlock: "Buat 10 soal latihan yang disetujui"
  },
  {
    id: "library_builder",
    title: "Pembangun Perpustakaan",
    description: "Mengunggah 10 modul yang disetujui",
    icon: "🏛️",
    category: "contribution",
    rarity: "rare",
    unlockCondition: (data) => data.approvedModules >= 10,
    howToUnlock: "Upload 10 modul yang disetujui"
  },
  {
    id: "generous_sharer",
    title: "Pembagi Murah Hati",
    description: "Modulmu diunduh 50 kali",
    icon: "🎁",
    category: "contribution",
    rarity: "uncommon",
    unlockCondition: (data) => data.totalDownloads >= 50,
    howToUnlock: "Dapatkan 50 unduhan dari modul kamu"
  },
  {
    id: "popular_author",
    title: "Penulis Populer",
    description: "Modulmu diunduh 200 kali",
    icon: "⭐",
    category: "contribution",
    rarity: "rare",
    unlockCondition: (data) => data.totalDownloads >= 200,
    howToUnlock: "Dapatkan 200 unduhan dari modul kamu"
  },
  {
    id: "viral_content",
    title: "Konten Viral",
    description: "Modulmu diunduh 500 kali",
    icon: "🚀",
    category: "contribution",
    rarity: "epic",
    unlockCondition: (data) => data.totalDownloads >= 500,
    howToUnlock: "Dapatkan 500 unduhan dari modul kamu"
  },
  {
    id: "content_legend",
    title: "Legenda Konten",
    description: "Modulmu diunduh 1000 kali",
    icon: "👑",
    category: "contribution",
    rarity: "legendary",
    unlockCondition: (data) => data.totalDownloads >= 1000,
    howToUnlock: "Dapatkan 1000 unduhan dari modul kamu"
  },
  {
    id: "balanced_contributor",
    title: "Kontributor Seimbang",
    description: "Punya 5 modul dan 5 soal yang disetujui",
    icon: "⚖️",
    category: "contribution",
    rarity: "rare",
    unlockCondition: (data) => data.approvedModules >= 5 && data.approvedQuestions >= 5,
    howToUnlock: "Upload 5 modul dan 5 soal yang disetujui"
  },
  {
    id: "super_contributor",
    title: "Super Kontributor",
    description: "Punya 15 modul dan 15 soal yang disetujui",
    icon: "🌟",
    category: "contribution",
    rarity: "epic",
    unlockCondition: (data) => data.approvedModules >= 15 && data.approvedQuestions >= 15,
    howToUnlock: "Upload 15 modul dan 15 soal yang disetujui"
  },
  {
    id: "mega_contributor",
    title: "Mega Kontributor",
    description: "Punya 30 modul dan 30 soal yang disetujui",
    icon: "💥",
    category: "contribution",
    rarity: "legendary",
    unlockCondition: (data) => data.approvedModules >= 30 && data.approvedQuestions >= 30,
    howToUnlock: "Upload 30 modul dan 30 soal yang disetujui"
  },
  {
    id: "first_module",
    title: "Modul Pertama",
    description: "Unggah modul pertamamu",
    icon: "📝",
    category: "contribution",
    rarity: "common",
    unlockCondition: (data) => data.approvedModules >= 1,
    howToUnlock: "Upload modul pertamamu"
  },
  {
    id: "first_question",
    title: "Soal Pertama",
    description: "Buat soal latihan pertamamu",
    icon: "❓",
    category: "contribution",
    rarity: "common",
    unlockCondition: (data) => data.approvedQuestions >= 1,
    howToUnlock: "Buat soal latihan pertamamu"
  },
  {
    id: "twenty_modules",
    title: "Dua Puluh Modul",
    description: "Mengunggah 20 modul yang disetujui",
    icon: "📚📚",
    category: "contribution",
    rarity: "epic",
    unlockCondition: (data) => data.approvedModules >= 20,
    howToUnlock: "Upload 20 modul yang disetujui"
  },
  {
    id: "twenty_questions",
    title: "Dua Puluh Soal",
    description: "Membuat 20 soal yang disetujui",
    icon: "❓❓",
    category: "contribution",
    rarity: "epic",
    unlockCondition: (data) => data.approvedQuestions >= 20,
    howToUnlock: "Buat 20 soal yang disetujui"
  },
  {
    id: "hundred_downloads",
    title: "Seratus Unduhan",
    description: "Modulmu diunduh 100 kali",
    icon: "📥",
    category: "contribution",
    rarity: "uncommon",
    unlockCondition: (data) => data.totalDownloads >= 100,
    howToUnlock: "Dapatkan 100 unduhan dari modul kamu"
  },
  {
    id: "three_hundred_downloads",
    title: "Tiga Ratus Unduhan",
    description: "Modulmu diunduh 300 kali",
    icon: "📥📥",
    category: "contribution",
    rarity: "rare",
    unlockCondition: (data) => data.totalDownloads >= 300,
    howToUnlock: "Dapatkan 300 unduhan dari modul kamu"
  },
  {
    id: "seven_hundred_downloads",
    title: "Tujuh Ratus Unduhan",
    description: "Modulmu diunduh 700 kali",
    icon: "📥📥📥",
    category: "contribution",
    rarity: "epic",
    unlockCondition: (data) => data.totalDownloads >= 700,
    howToUnlock: "Dapatkan 700 unduhan dari modul kamu"
  },

  // ========== LEARNING BADGES (15) ==========
  {
    id: "learner",
    title: "Pelajar Aktif",
    description: "Mengakses platform minimal 5 kali",
    icon: "📖",
    category: "learning",
    rarity: "common",
    unlockCondition: (data) => data.points > 0,
    howToUnlock: "Akses platform secara konsisten"
  },
  {
    id: "dedicated_learner",
    title: "Pelajar Dedikasi",
    description: "Akun berusia 30 hari",
    icon: "🎓",
    category: "learning",
    rarity: "uncommon",
    unlockCondition: (data) => data.accountAgeInDays >= 30,
    howToUnlock: "Gunakan platform selama 30 hari"
  },
  {
    id: "loyal_member",
    title: "Anggota Setia",
    description: "Akun berusia 90 hari",
    icon: "💎",
    category: "learning",
    rarity: "rare",
    unlockCondition: (data) => data.accountAgeInDays >= 90,
    howToUnlock: "Gunakan platform selama 90 hari"
  },
  {
    id: "veteran_member",
    title: "Anggota Veteran",
    description: "Akun berusia 180 hari",
    icon: "🏅",
    category: "learning",
    rarity: "epic",
    unlockCondition: (data) => data.accountAgeInDays >= 180,
    howToUnlock: "Gunakan platform selama 180 hari"
  },
  {
    id: "founding_member",
    title: "Anggota Pendiri",
    description: "Akun berusia 365 hari",
    icon: "🎖️",
    category: "learning",
    rarity: "legendary",
    unlockCondition: (data) => data.accountAgeInDays >= 365,
    howToUnlock: "Gunakan platform selama 1 tahun"
  },
  {
    id: "math_enthusiast",
    title: "Penggemar Matematika",
    description: "Upload modul Matematika",
    icon: "🔢",
    category: "learning",
    rarity: "uncommon",
    unlockCondition: (data) => (data.modulesBySubject["Matematika"] || 0) >= 1,
    howToUnlock: "Upload modul Matematika yang disetujui"
  },
  {
    id: "science_master",
    title: "Master Sains",
    description: "Upload modul Fisika, Kimia, atau Biologi",
    icon: "🧪",
    category: "learning",
    rarity: "uncommon",
    unlockCondition: (data) => {
      const science = (data.modulesBySubject["Fisika"] || 0) + 
                      (data.modulesBySubject["Kimia"] || 0) + 
                      (data.modulesBySubject["Biologi"] || 0);
      return science >= 1;
    },
    howToUnlock: "Upload modul sains yang disetujui"
  },
  {
    id: "language_expert",
    title: "Ahli Bahasa",
    description: "Upload modul Bahasa Indonesia atau Inggris",
    icon: "🗣️",
    category: "learning",
    rarity: "uncommon",
    unlockCondition: (data) => {
      const lang = (data.modulesBySubject["Bahasa Indonesia"] || 0) + 
                   (data.modulesBySubject["Bahasa Inggris"] || 0);
      return lang >= 1;
    },
    howToUnlock: "Upload modul bahasa yang disetujui"
  },
  {
    id: "history_scholar",
    title: "Sarjana Sejarah",
    description: "Upload modul Sejarah atau Geografi",
    icon: "🏛️",
    category: "learning",
    rarity: "uncommon",
    unlockCondition: (data) => {
      const history = (data.modulesBySubject["Sejarah"] || 0) + 
                      (data.modulesBySubject["Geografi"] || 0);
      return history >= 1;
    },
    howToUnlock: "Upload modul sejarah/geografi yang disetujui"
  },
  {
    id: "multi_subject",
    title: "Polymath",
    description: "Upload modul dari 5 mata pelajaran berbeda",
    icon: "🎓",
    category: "learning",
    rarity: "rare",
    unlockCondition: (data) => {
      const subjects = Object.values(data.modulesBySubject).filter(count => count > 0).length;
      return subjects >= 5;
    },
    howToUnlock: "Upload modul dari 5 mata pelajaran berbeda"
  },
  {
    id: "all_subjects",
    title: "Master Semua Mata Pelajaran",
    description: "Upload modul dari 8+ mata pelajaran",
    icon: "🌟",
    category: "learning",
    rarity: "epic",
    unlockCondition: (data) => {
      const subjects = Object.values(data.modulesBySubject).filter(count => count > 0).length;
      return subjects >= 8;
    },
    howToUnlock: "Upload modul dari 8+ mata pelajaran"
  },
  {
    id: "consistent_learner",
    title: "Pelajar Konsisten",
    description: "Akun berusia 60 hari",
    icon: "📅",
    category: "learning",
    rarity: "uncommon",
    unlockCondition: (data) => data.accountAgeInDays >= 60,
    howToUnlock: "Gunakan platform selama 60 hari"
  },
  {
    id: "semester_member",
    title: "Anggota Semester",
    description: "Akun berusia 120 hari",
    icon: "📆",
    category: "learning",
    rarity: "rare",
    unlockCondition: (data) => data.accountAgeInDays >= 120,
    howToUnlock: "Gunakan platform selama 120 hari"
  },
  {
    id: "year_member",
    title: "Anggota Tahunan",
    description: "Akun berusia 270 hari",
    icon: "📊",
    category: "learning",
    rarity: "epic",
    unlockCondition: (data) => data.accountAgeInDays >= 270,
    howToUnlock: "Gunakan platform selama 270 hari"
  },

  // ========== MILESTONE BADGES (20) ==========
  {
    id: "fifty_points",
    title: "Lima Puluh Poin",
    description: "Kumpulkan 50 poin kontribusi",
    icon: "⭐",
    category: "milestone",
    rarity: "common",
    unlockCondition: (data) => data.points >= 50,
    howToUnlock: "Kumpulkan 50 poin dari kontribusi"
  },
  {
    id: "hundred_points",
    title: "Seratus Poin",
    description: "Kumpulkan 100 poin kontribusi",
    icon: "💯",
    category: "milestone",
    rarity: "uncommon",
    unlockCondition: (data) => data.points >= 100,
    howToUnlock: "Kumpulkan 100 poin dari kontribusi"
  },
  {
    id: "two_hundred_points",
    title: "Dua Ratus Poin",
    description: "Kumpulkan 200 poin kontribusi",
    icon: "🎯",
    category: "milestone",
    rarity: "uncommon",
    unlockCondition: (data) => data.points >= 200,
    howToUnlock: "Kumpulkan 200 poin dari kontribusi"
  },
  {
    id: "five_hundred_points",
    title: "Lima Ratus Poin",
    description: "Kumpulkan 500 poin kontribusi",
    icon: "🏆",
    category: "milestone",
    rarity: "rare",
    unlockCondition: (data) => data.points >= 500,
    howToUnlock: "Kumpulkan 500 poin dari kontribusi"
  },
  {
    id: "thousand_points",
    title: "Seribu Poin",
    description: "Kumpulkan 1000 poin kontribusi",
    icon: "👑",
    category: "milestone",
    rarity: "epic",
    unlockCondition: (data) => data.points >= 1000,
    howToUnlock: "Kumpulkan 1000 poin dari kontribusi"
  },
  {
    id: "two_thousand_points",
    title: "Dua Ribu Poin",
    description: "Kumpulkan 2000 poin kontribusi",
    icon: "💎",
    category: "milestone",
    rarity: "legendary",
    unlockCondition: (data) => data.points >= 2000,
    howToUnlock: "Kumpulkan 2000 poin dari kontribusi"
  },
  {
    id: "top_fifty",
    title: "Top 50",
    description: "Masuk peringkat 50 besar sekolah",
    icon: "🥇",
    category: "milestone",
    rarity: "uncommon",
    unlockCondition: (data) => data.rank <= 50 && data.points > 0,
    howToUnlock: "Capai peringkat 50 teratas"
  },
  {
    id: "top_twenty",
    title: "Top 20",
    description: "Masuk peringkat 20 besar sekolah",
    icon: "🥈",
    category: "milestone",
    rarity: "rare",
    unlockCondition: (data) => data.rank <= 20 && data.points > 0,
    howToUnlock: "Capai peringkat 20 teratas"
  },
  {
    id: "top_ten",
    title: "Top 10",
    description: "Masuk peringkat 10 besar sekolah",
    icon: "🥉",
    category: "milestone",
    rarity: "epic",
    unlockCondition: (data) => data.rank <= 10 && data.points > 0,
    howToUnlock: "Capai peringkat 10 teratas"
  },
  {
    id: "top_five",
    title: "Top 5",
    description: "Masuk peringkat 5 besar sekolah",
    icon: "🌟",
    category: "milestone",
    rarity: "epic",
    unlockCondition: (data) => data.rank <= 5 && data.points > 0,
    howToUnlock: "Capai peringkat 5 teratas"
  },
  {
    id: "number_one",
    title: "Nomor Satu",
    description: "Menjadi peringkat 1 sekolah",
    icon: "👑",
    category: "milestone",
    rarity: "legendary",
    unlockCondition: (data) => data.rank === 1,
    howToUnlock: "Menjadi siswa dengan poin tertinggi"
  },
  {
    id: "level_two",
    title: "Level 2",
    description: "Mencapai Level 2 (100 poin)",
    icon: "📈",
    category: "milestone",
    rarity: "common",
    unlockCondition: (data) => data.points >= 100,
    howToUnlock: "Kumpulkan 100 poin"
  },
  {
    id: "level_five",
    title: "Level 5",
    description: "Mencapai Level 5 (250 poin)",
    icon: "📊",
    category: "milestone",
    rarity: "uncommon",
    unlockCondition: (data) => data.points >= 250,
    howToUnlock: "Kumpulkan 250 poin"
  },
  {
    id: "level_ten",
    title: "Level 10",
    description: "Mencapai Level 10 (500 poin)",
    icon: "🎖️",
    category: "milestone",
    rarity: "rare",
    unlockCondition: (data) => data.points >= 500,
    howToUnlock: "Kumpulkan 500 poin"
  },
  {
    id: "level_fifteen",
    title: "Level 15",
    description: "Mencapai Level 15 (750 poin)",
    icon: "🏅",
    category: "milestone",
    rarity: "epic",
    unlockCondition: (data) => data.points >= 750,
    howToUnlock: "Kumpulkan 750 poin"
  },
  {
    id: "level_twenty",
    title: "Level 20",
    description: "Mencapai Level 20 (1000 poin)",
    icon: "⭐",
    category: "milestone",
    rarity: "epic",
    unlockCondition: (data) => data.points >= 1000,
    howToUnlock: "Kumpulkan 1000 poin"
  },
  {
    id: "three_hundred_points",
    title: "Tiga Ratus Poin",
    description: "Kumpulkan 300 poin kontribusi",
    icon: "🎯",
    category: "milestone",
    rarity: "uncommon",
    unlockCondition: (data) => data.points >= 300,
    howToUnlock: "Kumpulkan 300 poin dari kontribusi"
  },
  {
    id: "seven_hundred_fifty_points",
    title: "Tujuh Ratus Lima Puluh Poin",
    description: "Kumpulkan 750 poin kontribusi",
    icon: "🎪",
    category: "milestone",
    rarity: "rare",
    unlockCondition: (data) => data.points >= 750,
    howToUnlock: "Kumpulkan 750 poin dari kontribusi"
  },
  {
    id: "fifteen_hundred_points",
    title: "Seribu Lima Ratus Poin",
    description: "Kumpulkan 1500 poin kontribusi",
    icon: "💫",
    category: "milestone",
    rarity: "epic",
    unlockCondition: (data) => data.points >= 1500,
    howToUnlock: "Kumpulkan 1500 poin dari kontribusi"
  },

  // ========== SOCIAL BADGES (15) ==========
  {
    id: "helpful_peer",
    title: "Teman Membantu",
    description: "Modulmu membantu 10 teman",
    icon: "🤝",
    category: "social",
    rarity: "common",
    unlockCondition: (data) => data.totalDownloads >= 10,
    howToUnlock: "Dapatkan 10 unduhan dari modul kamu"
  },
  {
    id: "community_builder",
    title: "Pembangun Komunitas",
    description: "Berkontribusi aktif dengan 10 modul",
    icon: "🏘️",
    category: "social",
    rarity: "uncommon",
    unlockCondition: (data) => data.approvedModules >= 10,
    howToUnlock: "Upload 10 modul yang disetujui"
  },
  {
    id: "knowledge_sharer",
    title: "Pembagi Pengetahuan",
    description: "Modulmu diunduh 25 kali",
    icon: "📢",
    category: "social",
    rarity: "common",
    unlockCondition: (data) => data.totalDownloads >= 25,
    howToUnlock: "Dapatkan 25 unduhan dari modul kamu"
  },
  {
    id: "inspiration_source",
    title: "Sumber Inspirasi",
    description: "Modulmu diunduh 150 kali",
    icon: "💡",
    category: "social",
    rarity: "uncommon",
    unlockCondition: (data) => data.totalDownloads >= 150,
    howToUnlock: "Dapatkan 150 unduhan dari modul kamu"
  },
  {
    id: "mentor_figure",
    title: "Figur Mentor",
    description: "Punya 10 modul dan 10 soal disetujui",
    icon: "👨‍🏫",
    category: "social",
    rarity: "rare",
    unlockCondition: (data) => data.approvedModules >= 10 && data.approvedQuestions >= 10,
    howToUnlock: "Upload 10 modul dan 10 soal yang disetujui"
  },
  {
    id: "role_model",
    title: "Teladan Siswa",
    description: "Punya 20 modul dan 20 soal disetujui",
    icon: "⭐",
    category: "social",
    rarity: "epic",
    unlockCondition: (data) => data.approvedModules >= 20 && data.approvedQuestions >= 20,
    howToUnlock: "Upload 20 modul dan 20 soal yang disetujui"
  },
  {
    id: "generous_contributor",
    title: "Kontributor Murah Hati",
    description: "Modulmu diunduh 75 kali",
    icon: "💝",
    category: "social",
    rarity: "uncommon",
    unlockCondition: (data) => data.totalDownloads >= 75,
    howToUnlock: "Dapatkan 75 unduhan dari modul kamu"
  },
  {
    id: "beloved_teacher",
    title: "Guru Terkasih",
    description: "Modulmu diunduh 400 kali",
    icon: "❤️",
    category: "social",
    rarity: "rare",
    unlockCondition: (data) => data.totalDownloads >= 400,
    howToUnlock: "Dapatkan 400 unduhan dari modul kamu"
  },
  {
    id: "legend_maker",
    title: "Pembuat Legenda",
    description: "Modulmu diunduh 800 kali",
    icon: "🌠",
    category: "social",
    rarity: "epic",
    unlockCondition: (data) => data.totalDownloads >= 800,
    howToUnlock: "Dapatkan 800 unduhan dari modul kamu"
  },
  {
    id: "question_guru",
    title: "Guru Soal",
    description: "Membuat 15 soal yang disetujui",
    icon: "🧠",
    category: "social",
    rarity: "rare",
    unlockCondition: (data) => data.approvedQuestions >= 15,
    howToUnlock: "Buat 15 soal yang disetujui"
  },
  {
    id: "module_expert",
    title: "Ahli Modul",
    description: "Mengunggah 15 modul yang disetujui",
    icon: "📚",
    category: "social",
    rarity: "rare",
    unlockCondition: (data) => data.approvedModules >= 15,
    howToUnlock: "Upload 15 modul yang disetujui"
  },
  {
    id: "trusted_contributor",
    title: "Kontributor Terpercaya",
    description: "Punya 8 modul dan 8 soal disetujui",
    icon: "✅",
    category: "social",
    rarity: "uncommon",
    unlockCondition: (data) => data.approvedModules >= 8 && data.approvedQuestions >= 8,
    howToUnlock: "Upload 8 modul dan 8 soal yang disetujui"
  },
  {
    id: "community_hero",
    title: "Pahlawan Komunitas",
    description: "Modulmu diunduh 600 kali",
    icon: "🦸",
    category: "social",
    rarity: "epic",
    unlockCondition: (data) => data.totalDownloads >= 600,
    howToUnlock: "Dapatkan 600 unduhan dari modul kamu"
  },
  {
    id: "beacon_of_knowledge",
    title: "Mercusuar Pengetahuan",
    description: "Modulmu diunduh 1200 kali",
    icon: "🔦",
    category: "social",
    rarity: "legendary",
    unlockCondition: (data) => data.totalDownloads >= 1200,
    howToUnlock: "Dapatkan 1200 unduhan dari modul kamu"
  },

  // ========== SPECIAL BADGES (10) ==========
  {
    id: "early_bird",
    title: "Burung Awal",
    description: "Menjadi salah satu kontributor pertama",
    icon: "🐦",
    category: "special",
    rarity: "rare",
    unlockCondition: (data) => data.accountAgeInDays >= 1 && data.approvedModules >= 1,
    howToUnlock: "Jadilah kontributor awal di platform"
  },
  {
    id: "speedster",
    title: "Pemburu Kecepatan",
    description: "Dapatkan 100 poin dalam 30 hari",
    icon: "⚡",
    category: "special",
    rarity: "rare",
    unlockCondition: (data) => data.points >= 100 && data.accountAgeInDays <= 30,
    howToUnlock: "Kumpulkan 100 poin dalam 30 hari pertama"
  },
  {
    id: "perfectionist",
    title: "Perfeksionis",
    description: "Semua modul dan soal yang diupload disetujui",
    icon: "💯",
    category: "special",
    rarity: "epic",
    unlockCondition: (data) => data.approvedModules > 0 && data.approvedQuestions > 0,
    howToUnlock: "Pastikan semua kontribusi disetujui moderator"
  },
  {
    id: "night_owl",
    title: "Burung Malam",
    description: "Aktif berkontribusi di malam hari",
    icon: "🦉",
    category: "special",
    rarity: "uncommon",
    unlockCondition: (data) => data.points > 0,
    howToUnlock: "Berkontribusi secara konsisten"
  },
  {
    id: "weekend_warrior",
    title: "Prajurit Akhir Pekan",
    description: "Berkontribusi di akhir pekan",
    icon: "⚔️",
    category: "special",
    rarity: "uncommon",
    unlockCondition: (data) => data.points > 0,
    howToUnlock: "Berkontribusi di akhir pekan"
  },
  {
    id: "consistency_king",
    title: "Raja Konsistensi",
    description: "Berkontribusi setiap bulan selama 6 bulan",
    icon: "👑",
    category: "special",
    rarity: "epic",
    unlockCondition: (data) => data.accountAgeInDays >= 180 && data.points >= 300,
    howToUnlock: "Berkontribusi konsisten selama 6 bulan"
  },
  {
    id: "renaissance_person",
    title: "Orang Renaissance",
    description: "Ahli di 10+ mata pelajaran berbeda",
    icon: "🎨",
    category: "special",
    rarity: "legendary",
    unlockCondition: (data) => {
      const subjects = Object.values(data.modulesBySubject).filter(count => count > 0).length;
      return subjects >= 10;
    },
    howToUnlock: "Upload modul dari 10+ mata pelajaran berbeda"
  },
  {
    id: "hall_of_fame",
    title: "Ruang Ketenaran",
    description: "Menjadi salah satu kontributor terbaik sepanjang masa",
    icon: "🏛️",
    category: "special",
    rarity: "legendary",
    unlockCondition: (data) => data.points >= 2000 && data.totalDownloads >= 1000,
    howToUnlock: "Kumpulkan 2000 poin dan 1000 unduhan"
  },
  {
    id: "platinum_member",
    title: "Anggota Platinum",
    description: "Mencapai status tertinggi dalam komunitas",
    icon: "💎",
    category: "special",
    rarity: "legendary",
    unlockCondition: (data) => data.points >= 1500 && data.approvedModules >= 25 && data.approvedQuestions >= 25,
    howToUnlock: "Kumpulkan 1500 poin, 25 modul, dan 25 soal"
  },
  {
    id: "eternal_student",
    title: "Siswa Abadi",
    description: "Tetap aktif di platform selama lebih dari 1 tahun",
    icon: "🌟",
    category: "special",
    rarity: "legendary",
    unlockCondition: (data) => data.accountAgeInDays >= 365 && data.points >= 500,
    howToUnlock: "Aktif di platform selama 1 tahun dengan 500+ poin"
  },
];

// Helper function to get badges by category
export const getBadgesByCategory = (category: Badge["category"]): Badge[] => {
  return BADGES.filter(badge => badge.category === category);
};

// Helper function to get badge rarity color
export const getRarityColor = (rarity: Badge["rarity"]): string => {
  const colors: Record<Badge["rarity"], string> = {
    common: "from-gray-400 to-gray-600",
    uncommon: "from-green-400 to-green-600",
    rare: "from-blue-400 to-blue-600",
    epic: "from-purple-400 to-purple-600",
    legendary: "from-yellow-400 to-yellow-600"
  };
  return colors[rarity];
};

// Helper function to get badge rarity text color
export const getRarityTextColor = (rarity: Badge["rarity"]): string => {
  const colors: Record<Badge["rarity"], string> = {
    common: "text-gray-700 dark:text-gray-300",
    uncommon: "text-green-700 dark:text-green-300",
    rare: "text-blue-700 dark:text-blue-300",
    epic: "text-purple-700 dark:text-purple-300",
    legendary: "text-yellow-700 dark:text-yellow-300"
  };
  return colors[rarity];
};
