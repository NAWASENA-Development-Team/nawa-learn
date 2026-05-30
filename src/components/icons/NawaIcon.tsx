// components/icons/NawaIcon.tsx
export default function NawaIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 120 120" 
      width="100%" 
      height="100%"
      className={className}
      aria-hidden="true"
    >
      <style>{`
        .ni-core { fill: #4f46e5; } /* indigo-600 */
        .ni-layers { fill: rgba(79, 70, 229, 0.75); }
        .ni-dots { fill: rgba(79, 70, 229, 0.40); }

        .dark .ni-core { fill: #FFFFFF; }
        .dark .ni-layers { fill: rgba(255, 255, 255, 0.75); }
        .dark .ni-dots { fill: rgba(255, 255, 255, 0.40); }
      `}</style>

      <defs>
        <filter id="arcane-learn-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g transform="translate(0, 0)">
        <polygon 
          className="ni-core"
          points="60,45 68,58 60,75 52,58" 
          filter="url(#arcane-learn-glow)" 
        />

        <g className="ni-layers">
          <polygon points="56,40 35,30 40,45 52,47" />
          <polygon points="64,40 85,30 80,45 68,47" />
        </g>

        <g className="ni-layers">
          <polygon points="30,50 48,55 45,70 32,65" />
          <polygon points="90,50 72,55 75,70 88,65" />
          <polygon points="35,70 48,75 42,90 38,85" />
          <polygon points="85,70 72,75 78,90 82,85" />
        </g>

        <g className="ni-dots">
          <circle cx="50" cy="95" r="5" />
          <circle cx="70" cy="95" r="5" />
        </g>
      </g>
    </svg>
  );
}
