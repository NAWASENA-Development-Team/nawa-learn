// components/icons/NawaIcon.tsx
// Inline SVG — adaptive for light & dark mode via embedded CSS class rules.
// Presentation attributes can't use CSS variables, so we use className + <style>.
// IDs are prefixed "ni-" to avoid collisions in the DOM.

export default function NawaIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 800"
      className={className}
      aria-hidden="true"
    >
      {/*
        Adaptive colour rules.
        next-themes puts `.dark` on <html>; inline SVG inherits the same cascade,
        so `.dark .ni-*` selectors work exactly like any other page CSS.

        Light mode: frosted-crystal faces (light indigo-white) + dark text
        Dark  mode: original deep-navy faces + white text
      */}
      <style>{`
        .ni-face        { fill: #eef0ff; }
        .ni-face-inner  { fill: #dde3f8; }
        .ni-text-main   { fill: #1e2764; }
        .ni-wing-line   { stroke: rgba(30,41,100,0.35); }

        .dark .ni-face        { fill: #121A2F; }
        .dark .ni-face-inner  { fill: #080C16; }
        .dark .ni-text-main   { fill: #ffffff; }
        .dark .ni-wing-line   { stroke: rgba(255,255,255,0.5); }
      `}</style>

      <defs>
        <filter id="ni-magicGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="ni-subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <linearGradient id="ni-goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFE066" />
          <stop offset="50%"  stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#997A00" />
        </linearGradient>

        <linearGradient id="ni-cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#0066FF" />
        </linearGradient>
      </defs>

      {/* ── Background REMOVED — now transparent ── */}

      {/* Orbit rings — cyan/gold, visible on both modes */}
      <circle cx="400" cy="350" r="220" fill="none" stroke="url(#ni-cyanGrad)" strokeWidth="2" strokeDasharray="10 15" opacity="0.5" />
      <circle cx="400" cy="350" r="200" fill="none" stroke="url(#ni-goldGrad)" strokeWidth="1"  opacity="0.4" />

      {/* Decorative gold branches — amber, readable on both */}
      <g fill="url(#ni-goldGrad)" opacity="0.85">
        <path d="M 180 500 Q 120 350 240 180" fill="none" stroke="url(#ni-goldGrad)" strokeWidth="3" />
        <path d="M 155 400 Q 120 380 140 340 Q 175 360 155 400" />
        <path d="M 135 300 Q 95 270 120 230 Q 160 260 135 300" />
        <path d="M 160 210 Q 140 160 180 140 Q 200 190 160 210" />

        <path d="M 620 500 Q 680 350 560 180" fill="none" stroke="url(#ni-goldGrad)" strokeWidth="3" />
        <path d="M 645 400 Q 680 380 660 340 Q 625 360 645 400" />
        <path d="M 665 300 Q 705 270 680 230 Q 640 260 665 300" />
        <path d="M 640 210 Q 660 160 620 140 Q 600 190 640 210" />
      </g>

      {/* Crystal gem */}
      <g transform="translate(0, -20)">
        {/* Gold spike at top */}
        <path d="M 400 100 Q 430 180 400 240 Q 370 180 400 100" fill="url(#ni-goldGrad)" filter="url(#ni-subtleGlow)" />

        {/* Top face (trapezoid) */}
        <path className="ni-face" d="M 300 240 L 500 240 L 460 320 L 340 320 Z" stroke="url(#ni-cyanGrad)" strokeWidth="4" strokeLinejoin="round" />

        {/* Left wing face */}
        <path className="ni-face" d="M 300 240 L 220 420 L 320 390 Z" stroke="url(#ni-cyanGrad)" strokeWidth="4" strokeLinejoin="round" />
        {/* Right wing face */}
        <path className="ni-face" d="M 500 240 L 580 420 L 480 390 Z" stroke="url(#ni-cyanGrad)" strokeWidth="4" strokeLinejoin="round" />

        {/* Bottom inner face — slightly darker shade */}
        <path className="ni-face-inner" d="M 340 320 L 460 320 L 400 440 Z" stroke="url(#ni-goldGrad)" strokeWidth="4" strokeLinejoin="round" />

        {/* Cyan inner-glow facets */}
        <polygon points="360,340 390,350 370,370" fill="#00F0FF" filter="url(#ni-magicGlow)" />
        <polygon points="440,340 410,350 430,370" fill="#00F0FF" filter="url(#ni-magicGlow)" />

        {/* Gold bottom drip */}
        <polygon points="390,390 410,390 400,450" fill="url(#ni-goldGrad)" />
      </g>

      {/* Wings */}
      <g transform="translate(0, 30)">
        {/* Centre glow dot */}
        <circle cx="400" cy="465" r="12" fill="#00F0FF" filter="url(#ni-magicGlow)" />

        {/* Left wing */}
        <path d="M 260 480 Q 330 460 400 510 L 400 560 Q 330 510 260 530 Z" fill="url(#ni-cyanGrad)" opacity="0.8" />
        <path className="ni-wing-line" d="M 260 495 Q 330 475 400 525" fill="none" strokeWidth="2" />

        {/* Right wing */}
        <path d="M 540 480 Q 470 460 400 510 L 400 560 Q 470 510 540 530 Z" fill="url(#ni-cyanGrad)" opacity="0.6" />
        <path className="ni-wing-line" d="M 540 495 Q 470 475 400 525" fill="none" strokeWidth="2" />
      </g>

      {/* Wordmark — not visible at small navbar sizes, kept for full-size use */}
      <text
        className="ni-text-main"
        x="400" y="680"
        fontFamily="'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontSize="52" fontWeight="900"
        textAnchor="middle" letterSpacing="12"
      >
        NAWA
      </text>
      <text
        x="400" y="730"
        fontFamily="'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontSize="22" fontWeight="400"
        fill="#00CFFF"
        textAnchor="middle" letterSpacing="16"
      >
        LEARN
      </text>

      <path d="M 320 760 L 480 760" fill="none" stroke="url(#ni-goldGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
