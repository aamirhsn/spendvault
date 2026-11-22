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
  { name: 'Investments', icon: '📈' },
  { name: 'Gifts & Donations', icon: '🎁' },
  { name: 'Transfers', icon: '🔄' },
  { name: 'Other', icon: '📦' },
];

export const categoryIcon = (name: string) => CATEGORIES.find((c) => c.name === name)?.icon ?? '📦';
/** True for a user-named category (picked via “Other”). */
export const isCustomCategory = (name: string) => !CATEGORIES.some((c) => c.name === name);

// Validated categorical palette (fixed order). Charts fold anything past slot 5 into "Other".
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
export const SERIES_OTHER = 'var(--s-other)';

// Gift card brands: primary brand colour and the ink colour that reads on it.
export const GIFT_BRANDS: { name: string; color: string; ink?: string }[] = [
  { name: 'Amazon', color: '#232f3e' },
  { name: 'Amazon Pay', color: '#232f3e' },
  { name: 'Flipkart', color: '#2874f0' },
  { name: 'Myntra', color: '#ff3f6c' },
  { name: 'Swiggy', color: '#fc8019' },
  { name: 'Zomato', color: '#e23744' },
  { name: 'Nykaa', color: '#fc2779' },
  { name: 'Ajio', color: '#2c4152' },
  { name: 'Tata CLiQ', color: '#1f1f22' },
  { name: 'Tata Neu', color: '#4a1a7a' },
  { name: 'Croma', color: '#0e8f74' },
  { name: 'BigBasket', color: '#689f1f' },
  { name: 'Blinkit', color: '#f8cb46', ink: '#1a1a1a' },
  { name: 'Zepto', color: '#3b0a6b' },
  { name: 'MakeMyTrip', color: '#0b5ec4' },
  { name: 'BookMyShow', color: '#c4242b' },
  { name: 'Uber', color: '#000000' },
  { name: 'Apple', color: '#1d1d1f' },
  { name: 'Google Play', color: '#01875f' },
  { name: 'Starbucks', color: '#00704a' },
  { name: 'Shoppers Stop', color: '#141414' },
  { name: 'Lifestyle', color: '#b5106e' },
  { name: 'Reliance Digital', color: '#0f3c91' },
  { name: 'Other', color: '#5856d6' },
];

export function giftBrand(brand: string) {
  return GIFT_BRANDS.find((b) => b.name.toLowerCase() === brand.toLowerCase()) ?? GIFT_BRANDS[GIFT_BRANDS.length - 1];
}
export const giftBackground = (color: string) => `linear-gradient(155deg, color-mix(in srgb, ${color} 78%, #ffffff) 0%, ${color} 55%, color-mix(in srgb, ${color} 85%, #000000) 100%)`;


/** Short identity for a gift card: “Amazon ••7788”. */
export const giftName = (g: { brand: string; codeTail?: string; code?: string }) => {
  const t = g.codeTail || (g.code ? g.code.replace(/[\s-]/g, '').slice(-4) : '');
  return t ? `${g.brand} ••${t}` : g.brand;
};
