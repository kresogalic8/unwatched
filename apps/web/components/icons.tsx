"use client";
/** Forty icons, one hand. 24-unit grid, 2-unit padding, stroke only, currentColor. Lifted from the Icons artboard. */
export const ICONS = {
  arrowUpRight: "M6 18L18 6 M6 6h12v12",
  arrowUp: "M12 20V4 M5 11l7-7 7 7",
  boat: "M3 15h18l-2 4H5z M6 15v-4h12v4 M9 11V8h6v3 M12 8V5",
  digest: "M4 6h16 M4 12h10 M4 18h7",
  letter: "M4 6h16v12H4z M4 7l8 6 8-6",
  town: "M3 20l6-3 6 3 6-3V5l-6 3-6-3-6 3z M9 4v13 M15 7v13",
  gazette: "M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5",
  you: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 4-6 8-6s8 2 8 6",
  coins: "M12 8a8 3 0 1 0 0-6 8 3 0 0 0 0 6z M4 5v6c0 2 4 3 8 3s8-1 8-3V5 M4 11v6c0 2 4 3 8 3s8-1 8-3v-6",
  credits: "M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17.5 6.5 21 8 13.5 3 9l6.5-.5z",
  possess: "M12 3a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V8a5 5 0 0 1 5-5z M7 21v-2a5 5 0 0 1 10 0v2 M12 13v4",
  watch: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  follow: "M12 21s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14",
  street: "M4 20V9l8-6 8 6v11 M9 20v-6h6v6",
  model: "M3 17h18v3H3z M6 17v-5l6-5 6 5v5 M10 17v-3h4v3",
  time: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  weather: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4 4 0 0 1 0 9H7z M9 21v1 M13 21v1 M17 21v1",
  night: "M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z",
  people: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21c0-4 3-6 7-6s7 2 7 6 M17 11a3 3 0 1 0 0-6 M22 21c0-3-2-5-5-6",
  trust: "M3 13c4-6 6 6 10 0s6 6 8 0",
  secret: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17v1",
  home: "M4 11l8-7 8 7v9h-5v-6h-6v6H4z",
  work: "M4 8h16v12H4z M9 8V5h6v3 M4 13h16",
  write: "M4 20h4l10-10-4-4L4 16z M12 8l4 4",
  send: "M3 11l18-8-7 18-2-8z",
  ticket: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z M14 6v12",
  book: "M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z",
  court: "M12 3v18 M5 8h14 M5 8l-3 6a3 3 0 0 0 6 0z M19 8l-3 6a3 3 0 0 0 6 0z",
  vote: "M5 12h14v9H5z M8 12V5h8v7 M11 8l1 1 2-2",
  brain: "M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h3V4z M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-3V4z",
  key: "M14 10a4 4 0 1 0-7 2l-4 4v3h3v-2h2v-2h2l1-1a4 4 0 0 0 3-4z M15 8a1 1 0 1 0 0-2",
  link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1 M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
  share: "M4 12v8h16v-8 M12 3v13 M8 7l4-4 4 4",
  warning: "M12 3l10 18H2z M12 10v4 M12 17v1",
  check: "M5 12l5 5L20 7",
  close: "M6 6l12 12 M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  plus: "M12 5v14 M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-5-5",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 2.6a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 2.6h5l.3-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z",
  postcard: "M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  download: "M12 4v11 M7 10l5 5 5-5 M5 20h14",
  rewind: "M4 12a8 8 0 1 0 2.3-5.6 M4 3v4h4 M12 8v4l3 2",
  play: "M7 5l12 7-12 7z",
  pause: "M8 5v14 M16 5v14",
  leave: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
} as const;
export type IconName = keyof typeof ICONS;

/** 16 in chips and labels, 20 and 24 in controls, 32 in empty states. Stroke thins as the icon grows so the hand stays the same. */
export function Icon({ name, size = 20, className = "", style, title }: { name: IconName; size?: 16 | 20 | 24 | 32; className?: string; style?: React.CSSProperties; title?: string }) {
  const sw = size === 16 ? 2.2 : size === 32 ? 1.8 : 2;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} style={style} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>{title && <title>{title}</title>}<path d={ICONS[name]} /></svg>;
}
