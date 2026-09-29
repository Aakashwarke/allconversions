const base = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

export const IconUpload = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

export const IconDownload = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

export const IconX = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconCheck = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconAlert = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v4.5M12 15.8v.2" />
  </svg>
);

export const IconArrow = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <path d="M5 12h14m0 0-5-5m5 5-5 5" />
  </svg>
);

export const IconShield = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconBolt = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3Z" />
  </svg>
);

export const IconTag = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} {...base} aria-hidden="true">
    <path d="M3.5 11.2V5A1.5 1.5 0 0 1 5 3.5h6.2a1.5 1.5 0 0 1 1.06.44l7.8 7.8a1.5 1.5 0 0 1 0 2.12l-6.2 6.2a1.5 1.5 0 0 1-2.12 0l-7.8-7.8a1.5 1.5 0 0 1-.44-1.06Z" />
    <circle cx="8" cy="8" r="1.4" />
  </svg>
);
