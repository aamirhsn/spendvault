import { CATEGORIES } from '../lib/categories';
import { useStore } from '../lib/store';
import { money } from '../lib/format';
import { FieldRow, Group, Sheet } from './ui';

/** Categories usually paid once a month, in one go. Excluded from the daily safe-to-spend pace. */
export const DEFAULT_FIXED = ['Rent', 'EMI & Loans', 'Investments', 'Bills & Utilities', 'Subscriptions'];
export const fixedCats = (s: { fixedCategories?: string[] }) => new Set(s.fixedCategories ?? DEFAULT_FIXED);

export const budgetColor = (pct: number) => (pct > 100 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : 'var(--green)');

/** Edit the overall monthly budget and a budget for each category. */
export function BudgetsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, updateSettings } = useStore();
  const s = data.settings;
  const cat = s.categoryBudgets ?? {};
  const sumCats = Object.values(cat).reduce((a, v) => a + (v || 0), 0);
  const parse = (v: string) => Number(v.replace(/\D/g, '')) || 0;
  const setCat = (name: string, v: number) => {
    const next = { ...cat };
    if (v) next[name] = v;
    else delete next[name];
    updateSettings({ categoryBudgets: next });
  };
  const fixed = fixedCats(s);
  const toggleFixed = (name: string) => {
    const next = new Set(fixed);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    updateSettings({ fixedCategories: CATEGORIES.map((c) => c.name).filter((n) => next.has(n)) });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Budgets">
      <div className="stack-lg">
        <Group footer="Your total spending limit for each month. Leave empty for no limit.">
          <FieldRow label="Monthly total"><input inputMode="numeric" placeholder="No limit" value={s.monthlyBudget || ''} onChange={(e) => updateSettings({ monthlyBudget: parse(e.target.value) })} /></FieldRow>
        </Group>
        <Group header="Fixed monthly costs" footer="Paid in one go, like rent or EMIs. Fiscus sets these aside first so they don't make the rest of the month look over budget.">
          <div className="fixed-chips">
            {CATEGORIES.filter((c) => c.name !== 'Other').map((c) => {
              const on = fixed.has(c.name);
              return (
                <button key={c.name} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleFixed(c.name)}>
                  {c.icon} {c.name}
                </button>
              );
            })}
          </div>
        </Group>
        <Group header="By category" footer={sumCats ? `Category budgets add up to ${money(sumCats, s.currency, { decimals: false })} a month.` : 'Set a monthly limit for the categories you want to watch.'}>
          {CATEGORIES.map((c) => (
            <FieldRow key={c.name} label={`${c.icon}  ${c.name}`}>
              <input inputMode="numeric" placeholder="—" value={cat[c.name] || ''} onChange={(e) => setCat(c.name, parse(e.target.value))} />
            </FieldRow>
          ))}
        </Group>
      </div>
    </Sheet>
  );
}
