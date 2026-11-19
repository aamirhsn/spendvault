// Card finishes — material presets that approximate how premium cards actually look
// (metal, matte, pearlescent). The card's own photo can replace these entirely.

export interface Finish {
  name: string;
  bg: string; // CSS background
  ink: string; // text / logo colour
  texture?: 'brushed' | 'carbon' | 'pearl' | 'wave';
  logo: 'white' | 'dark';
}

export const FINISHES: Record<string, Finish> = {
  'black-metal': { name: 'Black Metal', bg: 'linear-gradient(135deg,#3a3a3d 0%,#141416 38%,#0b0b0c 62%,#2a2a2d 100%)', ink: '#e8e8ea', texture: 'brushed', logo: 'white' },
  carbon: { name: 'Carbon', bg: 'linear-gradient(135deg,#26272b,#0f1012)', ink: '#ececee', texture: 'carbon', logo: 'white' },
  'silver-metal': { name: 'Platinum', bg: 'linear-gradient(135deg,#f3f4f6 0%,#c3c7cd 30%,#eceef1 55%,#a7acb4 100%)', ink: '#1d1d1f', texture: 'brushed', logo: 'dark' },
  'gold-metal': { name: 'Gold', bg: 'linear-gradient(135deg,#f6e3a8 0%,#c99d43 35%,#f3dc9a 60%,#a97d2a 100%)', ink: '#3a2806', texture: 'brushed', logo: 'dark' },
  'rose-gold': { name: 'Rose Gold', bg: 'linear-gradient(135deg,#f6d3c6 0%,#d29a86 40%,#f1c7b6 65%,#b77a66 100%)', ink: '#3b1d14', texture: 'brushed', logo: 'dark' },
  sapphire: { name: 'Sapphire', bg: 'linear-gradient(135deg,#2a5bd7 0%,#163a94 45%,#0b2163 100%)', ink: '#fff', texture: 'wave', logo: 'white' },
  midnight: { name: 'Midnight', bg: 'linear-gradient(135deg,#1e2b52 0%,#0d1633 55%,#070c1f 100%)', ink: '#fff', texture: 'wave', logo: 'white' },
  burgundy: { name: 'Burgundy', bg: 'linear-gradient(135deg,#8a1d3b 0%,#5a0f26 50%,#330716 100%)', ink: '#fff', texture: 'wave', logo: 'white' },
  emerald: { name: 'Emerald', bg: 'linear-gradient(135deg,#1c8a63 0%,#0d5a40 50%,#063726 100%)', ink: '#fff', texture: 'wave', logo: 'white' },
  plum: { name: 'Plum', bg: 'linear-gradient(135deg,#6d2a9c 0%,#43176a 55%,#260b3f 100%)', ink: '#fff', texture: 'wave', logo: 'white' },
  ocean: { name: 'Ocean', bg: 'linear-gradient(135deg,#1aa0c8 0%,#0c6e9b 50%,#08486a 100%)', ink: '#fff', texture: 'wave', logo: 'white' },
  coral: { name: 'Coral', bg: 'linear-gradient(135deg,#ff8a65 0%,#f2545b 55%,#c2304a 100%)', ink: '#fff', texture: 'wave', logo: 'white' },
  pearl: { name: 'Pearl White', bg: 'linear-gradient(135deg,#ffffff 0%,#eef0f6 50%,#e2e4ee 100%)', ink: '#1d1d1f', texture: 'pearl', logo: 'dark' },
  graphite: { name: 'Graphite', bg: 'linear-gradient(135deg,#5b5e66 0%,#3a3c42 55%,#25272b 100%)', ink: '#fff', texture: 'brushed', logo: 'white' },
};

// Older theme keys from v1 map onto the closest finish.
const LEGACY: Record<string, string> = { aurora: 'plum', sunset: 'coral', rose: 'rose-gold', gold: 'gold-metal', ruby: 'burgundy', sky: 'ocean' };

export const finishFor = (key: string): Finish => FINISHES[key] ?? FINISHES[LEGACY[key]] ?? FINISHES.midnight;

/** Finish key for a saved card. Cards created before finishes existed get a realistic one from their name. */
export function cardFinishKey(c: { theme: string; bank: string; name: string; finishChosen?: boolean }) {
  if (c.finishChosen && FINISHES[c.theme]) return c.theme;
  const suggested = suggestFinish(c.bank, c.name);
  if (suggested) return suggested;
  if (FINISHES[c.theme]) return c.theme;
  return LEGACY[c.theme] ?? 'midnight';
}

/** Suggest a finish from the bank + card name, matching how popular Indian cards look. */
export function suggestFinish(bank: string, name: string): string | null {
  const s = `${bank} ${name}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/infinia|reserve|diners black|black|marquee|elite|world safari|ultd|vistara infinite/, 'black-metal'],
    [/magnus|burgundy|wine/, 'burgundy'],
    [/regalia gold|\bgold\b|privilege/, 'gold-metal'],
    [/platinum|regalia|signature|premier/, 'silver-metal'],
    [/sapphiro|sapphire|select|atlas|horizon/, 'sapphire'],
    [/emeralde|emerald|green/, 'emerald'],
    [/rubyx|ruby|coral|red/, 'burgundy'],
    [/tata neu|neu|cashback|millennia|purple|plum/, 'plum'],
    [/amazon|flipkart|swiggy|airtel|ace/, 'carbon'],
    [/rose/, 'rose-gold'],
  ];
  for (const [re, f] of rules) if (re.test(s)) return f;
  return null;
}
