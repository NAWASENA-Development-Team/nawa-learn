---
name: NAWA-LEARN
description: Gamified Collaborative Learning Platform for SMAN 2 Jonggol
colors:
  primary: "#4f46e5"
  primary-hover: "#4338ca"
  secondary: "#7c3aed"
  secondary-hover: "#6d28d9"
  success: "#10b981"
  error: "#f43f5e"
  warning: "#f59e0b"
  surface-light: "#ffffff"
  surface-light-muted: "#f4f4f5"
  surface-dark: "#09090b"
  surface-dark-card: "#18181b"
  border-light: "#e4e4e7"
  border-dark: "#27272a"
  text-light-primary: "#18181b"
  text-light-muted: "#71717a"
  text-dark-primary: "#ffffff"
  text-dark-muted: "#a1a1aa"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light-primary}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  input-text:
    backgroundColor: "{colors.surface-light-muted}"
    textColor: "{colors.text-light-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card-container:
    backgroundColor: "{colors.surface-light}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: NAWA-LEARN

## Overview

**Creative North Star: "Arcane Academy"**

NAWA-LEARN is a high-tech scholastic sanctum built for the students of SMAN 2 Jonggol. It bridges rigorous academic discipline with the vibrant, rewarding momentum of modern role-playing gamification. Rather than feeling like a sterile institutional portal or a toy-like children's game, the interface evokes the quiet authority of an illuminated digital study hall: high-contrast surfaces, razor-sharp typography, and radiant violet-indigo accents that celebrate intellectual mastery and collaborative peer contribution.

The atmosphere is tactile, encouraging, and distraction-free. Study surfaces—whether a complex physics module reader or a high-stakes timed UTBK practice exam—prioritize cognitive ergonomics, readability, and immediate feedback. Gamified layers (such as 22+ fantasy and sci-fi avatar portraits, 80+ achievement badges across five rarity tiers, and podium leaderboards) serve as honorable markers of diligence rather than noisy clutter.

**Key Characteristics:**
- **Luminous Energy on Clean Slate**: Dynamic gradients (`#4f46e5` to `#7c3aed`) reserved for focal actions, milestone celebrations, and brand anchors, grounded in obsidian dark modes (`#09090b`) and crisp daylight whites (`#ffffff`).
- **Tactile Micro-Feedback**: Physical feel with slight active-scale presses (`scale-[0.98]`), gentle hover lifts (`-translate-y-0.5`), and smooth theme transitions.
- **Academic Clarity First**: Uncompromising readability for LaTeX formulas, PDF guides, and multiple-choice drill cards, framed by generous rounded corners (`12px` to `24px`).
- **Verified Tier Hierarchy**: Consistent chromatic coding for achievements and difficulties—Common (Slate), Uncommon (Emerald), Rare (Blue), Epic (Purple), and Legendary (Amber/Gold).

## Colors

The palette balances deep intellectual indigo and celestial violet accents with neutral surfaces that ensure high-legibility reading across light and dark modes.

### Primary
- **Arcane Indigo** (`#4f46e5` / `rgb(79, 70, 229)`): The core anchor of the system. Used for primary CTAs, active navigation indicators, key progress gauges, and focus rings. Represents focused intellectual energy.
- **Deep Indigo** (`#4338ca` / `rgb(67, 56, 202)`): Primary hover and active interaction state.

### Secondary
- **Celestial Violet** (`#7c3aed` / `rgb(124, 58, 237)`): Gradient partner to Arcane Indigo. Used across brand typography gradients, hero glows, and special achievement highlights.
- **Deep Violet** (`#6d28d9` / `rgb(109, 40, 217)`): Secondary hover state for multi-stop gradients.

### Neutral
- **Pure Frost** (`#ffffff`): Light mode page background and elevated card surface.
- **Subtle Tint Canvas** (`#f4f4f5` / `rgb(244, 244, 245)`): Light mode secondary container and input field fill.
- **Obsidian Pitch** (`#09090b` / `rgb(9, 9, 11)`): Dark mode global canvas.
- **Dark Surface Card** (`#18181b` / `rgb(24, 24, 27)`): Dark mode elevated surface for cards, dropdowns, and exam panels.
- **Border Light** (`#e4e4e7` / `rgb(228, 228, 231)`): 1px structural hairpins defining light cards and dividers.
- **Border Dark** (`#27272a` / `rgb(39, 39, 42)`): 1px structural hairpins defining dark mode panels and inputs.
- **Text Light Primary** (`#18181b`): High-contrast primary reading text in light mode.
- **Text Light Muted** (`#71717a`): Secondary captions, timestamps, and metadata in light mode.
- **Text Dark Primary** (`#ffffff`): High-contrast primary reading text in dark mode.
- **Text Dark Muted** (`#a1a1aa`): Secondary captions and labels in dark mode.

### Status & Rarity
- **Emerald Mastery** (`#10b981`): Success notifications, verified module badges, Uncommon rarity tier, and correct answer indicators.
- **Amber Champion** (`#f59e0b`): Points gains, contributor flair, Legendary rarity tier, and warning states.
- **Rose Critical** (`#f43f5e`): Timed exam countdown warnings (< 5 min), error alerts, and incorrect answer feedback.
- **Sky Scholar** (`#0ea5e9`): Informational notices and Rare achievement badges.
- **Arcane Epic** (`#a855f7`): Epic rarity tier badges and high-level rank frames.

### Named Rules
**The Gradient Signature Rule.** Gradients combining Arcane Indigo and Celestial Violet are reserved strictly for high-intent actions (primary hero buttons, active nav indicators, brand logos). Plain utility actions, pagination buttons, and inputs must remain solid or tonal.
**The Rarity Luminescence Rule.** Achievement badges and avatar borders must strictly reflect their rarity tier color; never apply arbitrary ad-hoc gradients that confuse achievement significance.

## Typography

**Display Font:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif  
**Body Font:** `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif  
**Mono Font:** ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace  

**Character:** Modern, clean, and highly geometric with optimized legibility for scientific formulas, multi-line questions, and rapid scanning.

### Hierarchy
- **Display** (Font Weight: 900, Size: `clamp(2.25rem, 5vw, 4.5rem)`, Line Height: 1.08, Letter Spacing: `-0.025em`): Hero headlines and major portal banners.
- **Headline** (Font Weight: 800, Size: `clamp(1.75rem, 3vw, 2.5rem)`, Line Height: 1.2, Letter Spacing: `-0.02em`): Section headings, modal titles, and feature category headers.
- **Title** (Font Weight: 700, Size: `1.25rem` / `20px`, Line Height: 1.35, Letter Spacing: `-0.015em`): Card titles, question stems, and leaderboard student names.
- **Body** (Font Weight: 400 / 500, Size: `1rem` / `16px`, Line Height: 1.6, Letter Spacing: normal): Explanations, module descriptions, policy text, max line length 65–75ch for prose.
- **Label / Overline** (Font Weight: 700, Size: `0.75rem` / `12px`, Line Height: 1.0, Letter Spacing: `0.05em`, Uppercase): Category tags, difficulty badges, status markers, timer countdowns.

### Named Rules
**The KaTeX Formula Integration Rule.** All mathematical and scientific notation must inherit the ambient text color and scale proportionately to its enclosing type container without vertical baseline clipping.
**The Dynamic Clamp Rule.** Top-level hero titles must use responsive fluid sizing via `clamp()` to prevent unsightly line breaks and word clipping on narrow mobile viewports.

## Layout

The layout uses a centered container model with strict responsive breakpoints and consistent vertical rhythm.

- **Global Container**: Maximum width `max-w-7xl` (`1280px`), horizontally centered with responsive horizontal gutters (`px-4` on mobile, `px-6` on tablet, `px-8` on desktop).
- **Narrow Container**: `max-w-3xl` or `max-w-4xl` for focused experiences (practice quiz runner, privacy settings, submit forms).
- **Rhythm & Grid**: 4px baseline unit. Common gap scales:
  - Micro spacing: `gap-1.5` (`6px`) to `gap-3` (`12px`) for badge rows and button internals.
  - Component spacing: `gap-4` (`16px`) to `gap-6` (`24px`) for card grids.
  - Section spacing: `py-12` (`48px`) to `py-20` (`80px`) on landing and dashboard sections.
- **Breakpoints**:
  - `sm`: `640px` (two-column stat grids, horizontal button stacks)
  - `md`: `768px` (desktop navbar transition, 4-column metrics)
  - `lg`: `1024px` (multi-column module and question split view)
  - `xl`: `1280px` (maximum container bounds)

### Named Rules
**The Mobile Thumb Reach Rule.** In mobile viewports, interactive confirmation controls (such as next question, submit quiz, and filter toggles) must span full width or sit within effortless thumb reach at the lower portion of the screen.

## Elevation & Depth

NAWA-LEARN favors clean planar surfaces at rest, elevated through crisp 1px borders, subtle ambient background glows, and tactile responsive lift.

- **At-Rest State**: Cards and interactive containers sit flush on the background canvas, framed by a delicate 1px boundary (`border-zinc-200/80` in light, `border-zinc-800/80` in dark).
- **Ambient Glows**: Soft diffuse radial blurs (`blur-[80px]` with indigo/violet at 10–15% opacity) sit in hero backgrounds and behind featured podium winners to generate an atmospheric aura without creating visual noise.
- **Active Lift**: Interactive cards and buttons employ physical hover lifts (`-translate-y-0.5` or `-translate-y-1`) accompanied by saturated shadow expansion.

### Shadow Vocabulary
- **Subtle Surface** (`box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`): Standard at-rest container shadow for light mode cards.
- **Interactive Card Hover** (`box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.08), 0 8px 10px -6px rgba(79, 70, 229, 0.04)`): Lifted card state indicating clickable modules and practice sessions.
- **Primary CTA Bloom** (`box-shadow: 0 10px 20px -3px rgba(79, 70, 229, 0.25)`): Vibrant colored glow under primary action buttons.
- **Podium Gold Aura** (`box-shadow: 0 0 25px 0 rgba(245, 158, 11, 0.3)`): Rank 1 leaderboard winner frame.

### Named Rules
**The Tactile Lift Rule.** Hover elevation must always pair a shadow bloom with a slight upward translation (`-translate-y-0.5`) and an immediate active depression (`active:scale-[0.98]`).
**The Restraint in Glow Rule.** Glowing colored shadows are permitted only on elements with high primary or milestone significance (primary buttons, active question selection, Rank 1–3 podiums). Ordinary cards must never use colored shadows.

## Shapes

Forms are friendly, soft, and modern, using generous corner radii that soften high-density academic information.

- **Primary Buttons & Controls**: `rounded-xl` (`12px`) for standard buttons, text inputs, and filter chips.
- **Hero Actions & Important Panels**: `rounded-2xl` (`16px`) for primary CTAs and exam question cards.
- **Major Containers & Modals**: `rounded-3xl` (`24px`) for feature banners, module preview panels, and avatar modal dialogs.
- **Pills & Avatars**: `rounded-full` (`9999px`) for difficulty tags, status badges, and circular avatar frames.
- **Borders**: Uniform hairline `1px` borders across all panels, with semi-transparent alphas (`/80`) to allow background tones to harmonize smoothly.

### Named Rules
**The Nested Radius Hierarchy Rule.** When a rounded element sits inside another rounded container, the inner radius must be strictly smaller than the outer radius (e.g., an inner `12px` control inside a `24px` card) to preserve visual concentricity.

## Components

### Buttons

- **Primary Action**:
  - Shape: `rounded-xl` (`12px`) or `rounded-2xl` (`16px`)
  - Fill: Linear gradient `from-indigo-600 to-violet-600` (`#4f46e5` → `#7c3aed`), text `#ffffff`, font weight `700`.
  - Padding: `12px 24px` (or `16px 32px` on Hero CTA).
  - Shadow: `shadow-md shadow-indigo-500/25` expanding to `shadow-indigo-500/40` on hover.
  - Transitions: `transition-all duration-200`, `hover:-translate-y-0.5`, `active:scale-[0.98]`.
- **Secondary / Outline**:
  - Shape: `rounded-xl` (`12px`)
  - Fill: White (`#ffffff`) in light mode / Zinc-900 (`#18181b`) in dark mode.
  - Border: `1px solid` Zinc-200 / Zinc-700.
  - Text: Zinc-700 / Zinc-200, font weight `600`.
  - Hover: Background shifts to Zinc-50 / Zinc-800 with `-translate-y-0.5`.

### Chips & Badges

- **Category / Difficulty Tags**:
  - Pill shape (`rounded-full`), padding `4px 10px`.
  - Font size: `10px` or `12px` with uppercase tracking (`font-bold tracking-wider`).
  - Palette: Indigo-50 / Indigo-950 for Subject, Amber-50 / Amber-950 for Exam Category, Emerald-50 / Emerald-950 for Easy, Amber-50 for Medium, Rose-50 for Hard.
- **Achievement Badges**:
  - Rounded square icon box (`12px` radius) with tier-colored radial gradient.
  - Locked badges display a padlock icon or "???" with muted opacity (`0.6`) and dark slate backgrounds.

### Cards & Containers

- **Corner Style**: `rounded-2xl` (`16px`) or `rounded-3xl` (`24px`).
- **Background**: `#ffffff` (light) / `#18181b` (dark).
- **Border**: `1px solid` `#e4e4e7` (light) / `#27272a` (dark).
- **Internal Padding**: `20px` to `32px` (`p-5` to `p-8`).
- **Interactive State**: Border transitions to Indigo-300 / Indigo-700 with subtle shadow bloom on hover.

### Inputs / Fields

- **Search & Form Inputs**:
  - Shape: `rounded-xl` (`12px`).
  - Fill: `#f4f4f5` (light) / `#09090b` (dark).
  - Border: `1px solid` `#e4e4e7` (light) / `#27272a` (dark).
  - Typography: `14px` (`text-sm`), text-zinc-900 / text-white.
  - Focus Ring: `border-indigo-500` with subtle focus shadow glow; `outline: none`.

### Navigation

- **Main Navigation Bar**:
  - Sticky at viewport top (`sticky top-0 z-50`).
  - Height: `64px` (`h-16`).
  - Background: Frosted glass `#ffffff/90` (light) / `#09090b/90` (dark) with `backdrop-blur-md`.
  - Border: `border-b border-zinc-200/80` (light) / `border-zinc-800/80` (dark).
  - Active Link Indicator: Indigo background tint with an absolute centered `1px` bottom border line.
- **Theme Toggle**:
  - Tactile button with animated Sun/Moon rotation and custom circular clip-path transition originating from button center across the viewport.

### Signature Component: Arcane Nawa Crest & Podium Avatar Frame

- **Nawa Crest (`NawaIcon`)**:
  - Sharded geometric crystal with glowing arcane core (`#4f46e5` in light, `#ffffff` in dark).
  - Employs SVG Gaussian blur filter (`arcane-learn-glow`) representing scholastic insight.
- **Leaderboard Podium Frames**:
  - Rank 1: Golden radiance gradient (`from-amber-400 via-yellow-300 to-amber-500`) with crown icon and amber aura.
  - Rank 2–3: Silver/Bronze metallic luster.
  - Ranks 4–10: Celestial fuchsia/purple border frames.

## Do's and Don'ts

### Do:
- **Do** wrap all mathematical expressions, variables, and formulas in KaTeX renderer components to ensure consistent typography and symbol alignment.
- **Do** maintain a strict 1px hairline border on cards and dialogs in both light and dark modes to guarantee planar structural clarity.
- **Do** pair interactive hover transitions with matching active depression states (`active:scale-[0.98]`) to give buttons and options a tangible, tactile weight.
- **Do** reserve high-saturation indigo-to-violet gradients exclusively for primary CTAs, active states, and brand crests.
- **Do** display achievement badges with their verified rarity tier colors (Common = Slate, Uncommon = Green, Rare = Blue, Epic = Purple, Legendary = Amber/Gold).

### Don't:
- **Don't** use pure solid black (`#000000`) for dark mode surfaces; always use dark obsidian zinc (`#09090b` for canvas, `#18181b` for cards) to preserve border contrast.
- **Don't** apply garish, neon box-shadows on unselected cards, form inputs, or static content panels.
- **Don't** reveal answers, explanations, or grading keys on practice question cards prior to server evaluation.
- **Don't** invent non-standard corner radii (such as mixing 4px, 14px, and 30px in the same view); stick strictly to the established scale (`8px`, `12px`, `16px`, `24px`, `full`).
- **Don't** hide critical action buttons off-screen on mobile devices; adhere to the Mobile Thumb Reach Rule.
