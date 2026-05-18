<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Avatar System

### 22+ Custom SVG Avatars
The profile page now features 22+ custom SVG avatars with fantasy and sci-fi themes:

**Fantasy Avatars (10):**
- Wizard (Penyihir Rumus)
- Knight (Ksatria Baja)
- Dragon (Naga Penjaga)
- Elf (Peri Hutan)
- Mage (Penyihir Rumus)
- Archer (Pemanah Mahir)
- Paladin (Kesatria Cahaya)
- Rogue (Pencuri Bayangan)
- Necromancer (Penyihir Gelap)
- Bard (Penyanyi Legendaris)

**Sci-Fi Avatars (13):**
- Cyborg (Cyborg Futuristik)
- Alien (Makhluk Asing)
- Robot (Robot Cerdas)
- Astronaut (Penjelajah Angkasa)
- Hacker (Hacker Jenius)
- Pilot (Pilot Pemberani)
- Android (Android Canggih)
- Spaceman (Prajurit Luar Angkasa)
- Scientist (Ilmuwan Brilian)
- Engineer (Insinyur Handal)
- Explorer (Penjelajah Petualang)
- Guardian (Penjaga Galaksi)
- Mystic (Mistis Gaib)

### Avatar Implementation
- Location: `public/avatars/*.svg`
- Avatar picker in `src/components/profile/ProfileClient.tsx`
- Users can select avatars from the profile page
- Selected avatar is saved to localStorage
- Each avatar has a unique gradient background color

### Moderator Panel Security
- Moderator panel is hidden from public navigation (removed from navbar)
- Password-protected access: default password is `nawa2024`
- Can be changed in `src/app/(dashboard)/moderator/page.tsx` (MODERATOR_PASSWORD constant)
- Session-based authentication using sessionStorage

## Badge System (80+ Achievements)

### Overview
Comprehensive competitive badge system with 80+ achievements organized into 5 categories. Students can compete to collect badges by contributing, learning, and engaging with the platform.

### Badge Categories

**1. Contribution Badges (20 badges)**
Earned by uploading modules and creating questions:
- First Step, Module Contributor, Prolific Contributor
- Knowledge Creator, Question Master, Library Builder
- Generous Sharer, Popular Author, Viral Content, Content Legend
- Balanced Contributor, Super Contributor, Mega Contributor
- First Module, First Question, Twenty Modules, Twenty Questions
- Hundred Downloads, Three Hundred Downloads, Seven Hundred Downloads

**2. Learning Badges (15 badges)**
Earned by consistent learning and account longevity:
- Learner, Dedicated Learner, Loyal Member, Veteran Member, Founding Member
- Math Enthusiast, Science Master, Language Expert, History Scholar
- Multi Subject, All Subjects
- Consistent Learner, Semester Member, Year Member

**3. Milestone Badges (20 badges)**
Earned by reaching point and ranking milestones:
- Fifty Points, Hundred Points, Two Hundred Points, Three Hundred Points
- Five Hundred Points, Seven Hundred Fifty Points, Thousand Points, Fifteen Hundred Points, Two Thousand Points
- Top 50, Top 20, Top 10, Top 5, Number One
- Level 2, Level 5, Level 10, Level 15, Level 20

**4. Social Badges (15 badges)**
Earned by helping the community and gaining popularity:
- Helpful Peer, Community Builder, Knowledge Sharer, Inspiration Source
- Mentor Figure, Role Model, Generous Contributor, Beloved Teacher
- Legend Maker, Question Guru, Module Expert, Trusted Contributor
- Community Hero, Beacon of Knowledge

**5. Special Badges (10 badges)**
Rare and unique achievements:
- Early Bird, Speedster, Perfectionist, Night Owl, Weekend Warrior
- Consistency King, Renaissance Person, Hall of Fame
- Platinum Member, Eternal Student

### Rarity Levels
- **Common** (Gray): Basic achievements
- **Uncommon** (Green): Moderate difficulty
- **Rare** (Blue): Challenging achievements
- **Epic** (Purple): Very difficult achievements
- **Legendary** (Gold): Extremely difficult achievements

### Implementation Details
- Location: `src/lib/badges.ts`
- Badge evaluation in: `src/components/profile/ProfileClient.tsx`
- Dynamic unlock conditions based on:
  - Points accumulated
  - Leaderboard rank
  - Number of approved modules/questions
  - Total downloads
  - Modules by subject
  - Account age in days

### Badge Display
- Organized by category in profile page
- Shows progress per category (X / Y badges unlocked)
- Unlocked badges display with rarity gradient and icon
- Locked badges show how to unlock them
- Hover effects and smooth transitions

### Adding New Badges
To add new badges, edit `src/lib/badges.ts`:
1. Add badge object to `BADGES` array
2. Define unlock condition function
3. Set category, rarity, icon, and description
4. Badges automatically appear in profile
