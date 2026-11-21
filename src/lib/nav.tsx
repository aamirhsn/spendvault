import { createContext, useContext } from 'react';
import type { Transaction } from './types';

export type Tab = 'home' | 'spends' | 'scan' | 'gifts' | 'cards';

export type SpendDraft = Partial<Transaction> & { merchantName?: string };

export interface Nav {
  tab: Tab;
  go(tab: Tab): void;
  newSpend(draft?: SpendDraft): void;
  editSpend(t: Transaction): void;
  openSettings(): void;
  openMessages(text?: string): void;
  /** Read the clipboard (must be called from a tap) and open the SMS import with it. */
  pasteMessages(): void;
  /** A form another screen should open when it mounts: 'gift' | 'card'. */
  intent: Intent;
  goAdd(intent: 'gift' | 'card'): void;
  clearIntent(): void;
}
export type Intent = 'gift' | 'card' | null;

export const NavCtx = createContext<Nav | null>(null);
export const useNav = () => {
  const n = useContext(NavCtx);
  if (!n) throw new Error('Nav missing');
  return n;
};
