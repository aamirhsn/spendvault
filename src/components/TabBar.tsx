import type { Tab } from '../lib/nav';
import { ICard, IGift, IHome, IReceipt, IScan } from './Icons';

const TABS: { id: Tab; label: string; Icon: typeof IHome }[] = [
  { id: 'home', label: 'Home', Icon: IHome },
  { id: 'spends', label: 'Spends', Icon: IReceipt },
  { id: 'scan', label: 'Scan', Icon: IScan },
  { id: 'gifts', label: 'Gift Cards', Icon: IGift },
  { id: 'cards', label: 'Cards', Icon: ICard },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const idx = TABS.findIndex((t) => t.id === tab);
  return (
    <div className="tabbar-wrap">
      <nav className="tabbar liquid" aria-label="Main">
        <span className="tab-lens" style={{ transform: `translateX(${idx * 100}%)` }} />
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => onChange(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon strokeWidth={tab === id ? 2.2 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
