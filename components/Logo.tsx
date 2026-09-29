export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect width="32" height="32" rx="9" fill="url(#acg)" />
      {/* Two sheets mid-swap: the conversion idea in one mark. */}
      <path d="M11 9.5h6.2L21 13.3V22a1.5 1.5 0 0 1-1.5 1.5H11A1.5 1.5 0 0 1 9.5 22V11A1.5 1.5 0 0 1 11 9.5Z"
            fill="#fff" fillOpacity=".94" />
      <path d="M17 9.7V13a.8.8 0 0 0 .8.8h3.1" fill="#fff" fillOpacity=".55" />
      <path d="M13.6 17.4h5m0 0-1.8-1.8m1.8 1.8-1.8 1.8"
            stroke="url(#acg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="acg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D5CF0" />
          <stop offset="1" stopColor="#16BD8A" />
        </linearGradient>
      </defs>
    </svg>
  );
}
