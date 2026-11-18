import {
  siAmericanexpress, siApple, siAxisbank, siBigbasket, siBookmyshow, siDinersclub, siDiscover, siGoogleplay,
  siHdfcbank, siHsbc, siIcicibank, siMastercard, siPaytm, siPhonepe, siStarbucks, siSwiggy, siUber, siVisa, siZomato,
} from 'simple-icons';
import { useStore } from './store';

// Brand marks from Simple Icons (CC0). Brands not in that set fall back to a typeset
// wordmark, and any brand can be given a user-uploaded logo (stored encrypted in the vault).
type Icon = { path: string; title: string };

const ICONS: Record<string, Icon> = {
  visa: siVisa, mastercard: siMastercard, amex: siAmericanexpress, americanexpress: siAmericanexpress,
  diners: siDinersclub, dinersclub: siDinersclub, discover: siDiscover,
  hdfc: siHdfcbank, hdfcbank: siHdfcbank, icici: siIcicibank, icicibank: siIcicibank, axis: siAxisbank, axisbank: siAxisbank,
  hsbc: siHsbc, swiggy: siSwiggy, zomato: siZomato, bigbasket: siBigbasket, uber: siUber, bookmyshow: siBookmyshow,
  apple: siApple, googleplay: siGoogleplay, starbucks: siStarbucks, paytm: siPaytm, phonepe: siPhonepe,
};

/** Normalise a brand / bank name to a lookup key: "HDFC Bank" → "hdfc", "Google Play" → "googleplay". */
export function logoKey(name: string) {
  const k = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return k.replace(/(bank|bankltd|limited|ltd|card|cards)$/g, '') || k;
}

export const hasBuiltInLogo = (name: string) => !!(ICONS[logoKey(name)] ?? ICONS[name.toLowerCase().replace(/[^a-z0-9]/g, '')]);

export function BrandLogo({ name, height = 22, color = '#fff', fallback = true, className }: { name: string; height?: number; color?: string; fallback?: boolean; className?: string }) {
  const { data } = useStore();
  const key = logoKey(name);
  const custom = data.logos?.[key];
  if (custom) return <img src={custom} alt={name} className={className} style={{ height, width: 'auto', maxWidth: height * 4, objectFit: 'contain', display: 'block' }} />;
  const icon = ICONS[key] ?? ICONS[name.toLowerCase().replace(/[^a-z0-9]/g, '')];
  if (icon)
    return (
      <svg viewBox="0 0 24 24" height={height} width={height} fill={color} role="img" aria-label={icon.title} className={className} style={{ display: 'block', flex: 'none' }}>
        <path d={icon.path} />
      </svg>
    );
  if (!fallback) return null;
  return <span className={`wordmark ${className ?? ''}`} style={{ fontSize: height * 0.82, color }}>{name}</span>;
}

/** Card network mark, bottom-right of a card. */
export function NetworkLogo({ network, height = 30 }: { network: string; height?: number }) {
  const { data } = useStore();
  const key = logoKey(network);
  const custom = data.logos?.[key];
  if (custom) return <img src={custom} alt={network} style={{ height, width: 'auto', display: 'block' }} />;
  if (network === 'Mastercard')
    return (
      <svg viewBox="0 0 50 30" height={height} aria-label="Mastercard" role="img" style={{ display: 'block' }}>
        <circle cx="17" cy="15" r="13" fill="#eb001b" />
        <circle cx="33" cy="15" r="13" fill="#f79e1b" />
        <path d="M25 4.7a13 13 0 0 1 0 20.6 13 13 0 0 1 0-20.6z" fill="#ff5f00" />
      </svg>
    );
  if (network === 'Visa') return <BrandLogo name="visa" height={height * 1.25} />;
  if (network === 'RuPay') return <span className="wordmark rupay" style={{ fontSize: height * 0.62 }}>RuPay<span>›</span></span>;
  if (network === 'Other') return null;
  return <BrandLogo name={network} height={height} />;
}

/** Resize an uploaded image to a small PNG data URL for storage in the vault. */
export async function fileToLogo(file: File, max = 256): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
