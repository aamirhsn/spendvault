import {
  siAmericanexpress, siApple, siAxisbank, siBigbasket, siBookmyshow, siDinersclub, siDiscover, siGoogleplay,
  siHdfcbank, siHsbc, siIcicibank, siMastercard, siPaytm, siPhonepe, siStarbucks, siSwiggy, siUber, siVisa, siZomato,
} from 'simple-icons';
import { useStore } from './store';

// Logo sources, in priority order:
//   1. the user's own upload (stored encrypted in the vault)
//   2. bundled public-domain / CC0 logo files from Wikimedia Commons (public/logos, see CREDITS.md)
//   3. Simple Icons (CC0) brand marks
//   4. a typeset wordmark (rendered by the caller)

import { LOGO_FILES, BOXED } from './logoFiles';
export { LOGO_FILES };

type Icon = { path: string; title: string; hex: string };
const ICONS: Record<string, Icon> = {
  visa: siVisa, mastercard: siMastercard, amex: siAmericanexpress, diners: siDinersclub, discover: siDiscover,
  hdfc: siHdfcbank, icici: siIcicibank, axis: siAxisbank, hsbc: siHsbc, swiggy: siSwiggy, zomato: siZomato,
  bigbasket: siBigbasket, uber: siUber, bookmyshow: siBookmyshow, apple: siApple, googleplay: siGoogleplay,
  starbucks: siStarbucks, paytm: siPaytm, phonepe: siPhonepe,
};

const ALIASES: Record<string, string> = {
  americanexpress: 'amex', dinersclub: 'diners', statebankofindia: 'sbi', statebank: 'sbi', hdfcbank: 'hdfc', icicibank: 'icici',
  axisbank: 'axis', yesbank: 'yes', indusindbank: 'indusind', idfcfirstbank: 'idfcfirst', idfc: 'idfcfirst', idfcbank: 'idfcfirst',
  aubank: 'au', ausmallfinancebank: 'au', ausmallfinance: 'au', standardcharteredbank: 'standardchartered', scb: 'standardchartered',
  federalbank: 'federal', hsbcbank: 'hsbc', tatacliq: 'tatacliq', tataneuhdfc: 'tataneu', amazonpayicici: 'amazonpay',
  kotakmahindrabank: 'kotak', kotakmahindra: 'kotak', kotakbank: 'kotak',
  bob: 'bobcard', bankofbaroda: 'bobcard', bobfinancial: 'bobcard', bobcards: 'bobcard', baroda: 'bobcard',
  slicebank: 'slice', slicesmallfinancebank: 'slice', slicecard: 'slice',
  google: 'googleplay', googleplaystore: 'googleplay', mmt: 'makemytrip', shoppers: 'shoppersstop',
};

/** Normalise a brand / bank name to a lookup key: "HDFC Bank" → "hdfc", "Google Play" → "googleplay". */
export function logoKey(name: string) {
  const raw = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ALIASES[raw]) return ALIASES[raw];
  if (LOGO_FILES[raw] || ICONS[raw]) return raw;
  const stripped = raw.replace(/(bank|bankltd|limited|ltd|card|cards|giftcard|voucher)$/g, '');
  return ALIASES[stripped] ?? stripped;
}

export const hasLogo = (name: string, custom?: Record<string, string>) => {
  const k = logoKey(name);
  return !!(custom?.[k] || LOGO_FILES[k] || ICONS[k]);
};

const base = import.meta.env.BASE_URL;

/**
 * Brand logo. `tone` = 'color' (original colours), 'white' or 'dark' (single-colour for card metal).
 * Returns null when no logo is known so the caller can render its own fallback.
 */
export function Logo({ name, tone = 'color', className, style, alt, preferMark }: { name: string; tone?: 'color' | 'white' | 'dark'; className?: string; style?: React.CSSProperties; alt?: string; preferMark?: boolean }) {
  const { data } = useStore();
  const key = logoKey(name);
  const toneCls = tone === 'white' ? 'white-logo' : tone === 'dark' ? 'dark-logo' : '';
  const custom = data.logos?.[key];
  const file = LOGO_FILES[key];
  const icon = ICONS[key];
  const img = (src: string, cls: string) => <img src={src} alt={alt ?? name} className={`${cls} ${className ?? ''}`} style={style} loading="lazy" decoding="async" draggable={false} />;
  // Your own upload is always shown as-is.
  if (custom) return img(custom, '');
  // Official artwork: recoloured to a silhouette on card metal, unless it sits on its own background box.
  if (file && !(preferMark && icon) && (tone === 'color' || !BOXED.has(key))) return img(`${base}logos/${file}`, toneCls);
  if (icon) {
    const fill = tone === 'white' ? '#fff' : tone === 'dark' ? '#111' : `#${icon.hex}`;
    return (
      <svg viewBox="0 0 24 24" fill={fill} role="img" aria-label={alt ?? icon.title} className={className} style={{ aspectRatio: '1', ...style }}>
        <path d={icon.path} />
      </svg>
    );
  }
  if (file) return img(`${base}logos/${file}`, 'boxed-logo');
  return null;
}

/** Resize an uploaded image to a small PNG data URL for storage in the vault. */
export async function fileToDataUrl(file: File, max = 256, type: 'image/png' | 'image/jpeg' = 'image/png'): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL(type, 0.85);
}

const KNOWN_KEYS = (): string[] => [...new Set([...Object.keys(LOGO_FILES), ...Object.keys(ICONS)])];
/** Find a known brand mentioned in free text, e.g. "Swiggy order" → "swiggy". */
export function findBrand(text: string | undefined): string | null {
  if (!text) return null;
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const cands = new Set<string>(words);
  for (let i = 0; i < words.length - 1; i++) cands.add(words[i] + words[i + 1]);
  for (const k of KNOWN_KEYS()) if (k.length >= 3 && cands.has(k)) return k;
  for (const c of cands) if (ALIASES[c]) return ALIASES[c];
  return null;
}
