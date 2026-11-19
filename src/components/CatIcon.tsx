import type { ReactNode } from 'react';

// Category glyphs (24px line icons) with a signature colour each. Shown as a tinted rounded square.
const G = (d: ReactNode) => d;
const GLYPHS: Record<string, { color: string; g: ReactNode }> = {
  'Food & Dining': { color: '#ff8a00', g: G(<><path d="M7 3v8a2 2 0 0 0 2 2v8M7 3v5M10.5 3v5a3.5 3.5 0 0 1-3.5 3.5" /><path d="M17 21V3c-2.2 1.2-3.5 3.6-3.5 7v3H17" /></>) },
  Groceries: { color: '#1fb36b', g: G(<><path d="M3 4h2.2l2.3 11h11l2-8H6.3" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></>) },
  Shopping: { color: '#ec4899', g: G(<><path d="M5 8h14l-1 13H6z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>) },
  Travel: { color: '#3b82f6', g: G(<path d="M10.5 21l1.5-6.5L5 12V9.5l7 1.5L11 5c-.2-1.3.4-2 1-2s1.2.7 1 2l-1 6 7-1.5V12l-7 2.5 1.5 6.5" />) },
  Fuel: { color: '#ef4444', g: G(<><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10" /><path d="M14 8h2a2 2 0 0 1 2 2v6.5a1.5 1.5 0 0 0 3 0V8l-3-3" /></>) },
  'Bills & Utilities': { color: '#f59e0b', g: G(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />) },
  Entertainment: { color: '#8b5cf6', g: G(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9.5v5l4.5-2.5z" /></>) },
  Subscriptions: { color: '#6366f1', g: G(<><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" /></>) },
  Health: { color: '#f43f5e', g: G(<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.4 12 20 12 20z" />) },
  'Personal Care': { color: '#d946ef', g: G(<><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></>) },
  Education: { color: '#0ea5e9', g: G(<><path d="M2.5 9 12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11M21.5 9v5" /></>) },
  Rent: { color: '#14b8a6', g: G(<><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5M10 20v-5h4v5" /></>) },
  'EMI & Loans': { color: '#64748b', g: G(<><path d="M3 9.5 12 4l9 5.5M4 20h16M6 10v7M10 10v7M14 10v7M18 10v7" /></>) },
  'Gifts & Donations': { color: '#e11d48', g: G(<><rect x="3.5" y="9" width="17" height="11.5" rx="1.5" /><path d="M12 9v11.5M3.5 13h17M12 9S10.5 4 8 4a2.5 2.5 0 0 0 0 5zM12 9s1.5-5 4-5a2.5 2.5 0 0 1 0 5z" /></>) },
  Transfers: { color: '#0d9488', g: G(<><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" /></>) },
  Other: { color: '#8e8e93', g: G(<><circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" /></>) },
};

export const categoryColor = (name: string) => (GLYPHS[name] ?? GLYPHS.Other).color;

export function CatIcon({ name, size = 40, round, solid }: { name: string; size?: number; round?: boolean; solid?: boolean }) {
  const { color, g } = GLYPHS[name] ?? GLYPHS.Other;
  return (
    <span
      className="cat-ic"
      style={{
        width: size, height: size, borderRadius: round ? '50%' : size * 0.3,
        background: solid ? color : `color-mix(in srgb, ${color} 15%, var(--card))`, color: solid ? '#fff' : color,
        boxShadow: solid ? 'none' : `inset 0 0 0 0.5px color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.52} height={size * 0.52} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{g}</svg>
    </span>
  );
}
