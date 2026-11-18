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

export const GIFT_BRANDS: { name: string; colors: [string, string] }[] = [
  { name: 'Amazon', colors: ['#232f3e', '#ff9900'] },
  { name: 'Flipkart', colors: ['#2874f0', '#ffe11b'] },
  { name: 'Myntra', colors: ['#ff3f6c', '#f57b2c'] },
  { name: 'Swiggy', colors: ['#fc8019', '#ff5a1f'] },
  { name: 'Zomato', colors: ['#cb202d', '#e23744'] },
  { name: 'Ajio', colors: ['#2c4152', '#b19975'] },
  { name: 'Nykaa', colors: ['#fc2779', '#e80071'] },
  { name: 'Tata CLiQ', colors: ['#2b2b2b', '#da1c5c'] },
  { name: 'Croma', colors: ['#12daa8', '#0b8f6f'] },
  { name: 'BigBasket', colors: ['#84c225', '#4c7a12'] },
  { name: 'Blinkit', colors: ['#f8cb46', '#0c831f'] },
  { name: 'Zepto', colors: ['#5e1a9a', '#ff3269'] },
  { name: 'Uber', colors: ['#000000', '#3a3a3a'] },
  { name: 'MakeMyTrip', colors: ['#e7262b', '#0a5ec4'] },
  { name: 'BookMyShow', colors: ['#c4242b', '#f84464'] },
  { name: 'Apple', colors: ['#1d1d1f', '#86868b'] },
  { name: 'Google Play', colors: ['#01875f', '#4285f4'] },
  { name: 'Starbucks', colors: ['#00704a', '#1e3932'] },
  { name: 'Shoppers Stop', colors: ['#111111', '#c0a062'] },
  { name: 'Lifestyle', colors: ['#e6007e', '#702283'] },
  { name: 'Reliance Digital', colors: ['#0f3c91', '#e42529'] },
  { name: 'Other', colors: ['#6a5cff', '#22c1c3'] },
];

export const giftBrandColors = (brand: string): [string, string] =>
  GIFT_BRANDS.find((b) => b.name.toLowerCase() === brand.toLowerCase())?.colors ?? GIFT_BRANDS[GIFT_BRANDS.length - 1].colors;

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
