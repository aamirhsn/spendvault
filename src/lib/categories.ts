export interface Category {
  name: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { name: 'Food & Dining', icon: '🍽️' },
  { name: 'Groceries', icon: '🛒' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Fuel', icon: '⛽' },
  { name: 'Bills & Utilities', icon: '💡' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Subscriptions', icon: '🔁' },
  { name: 'Health', icon: '🩺' },
  { name: 'Personal Care', icon: '💇' },
  { name: 'Education', icon: '🎓' },
  { name: 'Rent', icon: '🏠' },
  { name: 'EMI & Loans', icon: '🏦' },
  { name: 'Gifts & Donations', icon: '🎁' },
  { name: 'Transfers', icon: '🔄' },
  { name: 'Other', icon: '📦' },
];

export const categoryIcon = (name: string) => CATEGORIES.find((c) => c.name === name)?.icon ?? '📦';

// Validated categorical palette (fixed order). Charts fold anything past slot 5 into "Other".
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
export const SERIES_OTHER = 'var(--s-other)';

// Brand background (two shades of the brand's main colour) + accent used for badges.
export const GIFT_BRANDS: { name: string; colors: [string, string]; accent: string }[] = [
  { name: 'Amazon', colors: ['#37475a', '#131a22'], accent: '#ff9900' },
  { name: 'Flipkart', colors: ['#2f80ff', '#1a56c9'], accent: '#ffe11b' },
  { name: 'Myntra', colors: ['#ff4f79', '#e0275a'], accent: '#ffb199' },
  { name: 'Swiggy', colors: ['#ff8a2a', '#f05a00'], accent: '#ffffff' },
  { name: 'Zomato', colors: ['#ef4f5f', '#cb202d'], accent: '#ffffff' },
  { name: 'Ajio', colors: ['#34495a', '#1b2a35'], accent: '#c9ab7f' },
  { name: 'Nykaa', colors: ['#ff3d8b', '#e2006a'], accent: '#ffffff' },
  { name: 'Tata CLiQ', colors: ['#2e2e33', '#121214'], accent: '#e6286a' },
  { name: 'Croma', colors: ['#19c79a', '#0b8f6f'], accent: '#0b2b25' },
  { name: 'BigBasket', colors: ['#8fcd2f', '#5a8f13'], accent: '#e3262b' },
  { name: 'Blinkit', colors: ['#14953a', '#0a6b1f'], accent: '#f8cb46' },
  { name: 'Zepto', colors: ['#6a22ad', '#3d0f68'], accent: '#ff3269' },
  { name: 'Uber', colors: ['#2a2a2a', '#000000'], accent: '#ffffff' },
  { name: 'MakeMyTrip', colors: ['#1470e0', '#08408a'], accent: '#ff4d4d' },
  { name: 'BookMyShow', colors: ['#e3343c', '#b3191f'], accent: '#ffffff' },
  { name: 'Apple', colors: ['#3a3a3c', '#111113'], accent: '#ffffff' },
  { name: 'Google Play', colors: ['#14966b', '#0b6248'], accent: '#ffffff' },
  { name: 'Starbucks', colors: ['#0a7d55', '#1e3932'], accent: '#ffffff' },
  { name: 'Shoppers Stop', colors: ['#2b2b2b', '#0e0e0e'], accent: '#c9a45c' },
  { name: 'Lifestyle', colors: ['#d4127f', '#702283'], accent: '#ffffff' },
  { name: 'Reliance Digital', colors: ['#1450b8', '#0a2a66'], accent: '#ff3b3f' },
  { name: 'Other', colors: ['#6a5cff', '#3b2fc9'], accent: '#ffffff' },
];

const giftBrand = (brand: string) =>
  GIFT_BRANDS.find((b) => b.name.toLowerCase() === brand.toLowerCase()) ?? GIFT_BRANDS[GIFT_BRANDS.length - 1];
export const giftBrandColors = (brand: string): [string, string] => giftBrand(brand).colors;
export const giftBrandAccent = (brand: string) => giftBrand(brand).accent;

/** Readable ink colour on top of a given background hex. */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111' : '#fff';
}

export const CARD_THEMES: Record<string, [string, string]> = {
  midnight: ['#1c1f2b', '#3a4160'],
  ocean: ['#0f4c81', '#22a6b3'],
  aurora: ['#5b2be0', '#22c1c3'],
  sunset: ['#ff5f6d', '#ffc371'],
  rose: ['#b0306a', '#f093fb'],
  emerald: ['#0b6e4f', '#5bd6a0'],
  gold: ['#7a5c13', '#e5c06b'],
  graphite: ['#2d2d2d', '#6b6b6b'],
  ruby: ['#7b0d1e', '#e63946'],
  sky: ['#4facfe', '#00c6fb'],
};
