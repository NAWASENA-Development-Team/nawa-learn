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
