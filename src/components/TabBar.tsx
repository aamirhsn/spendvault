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
      <nav className="tabbar" aria-label="Main">
        <span className="tab-lens" style={{ transform: `translateX(${idx * 100}%)`, opacity: tab === 'scan' ? 0 : 1 }} />
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''} ${id === 'scan' ? 'scan' : ''}`} onClick={() => onChange(id)} aria-current={tab === id ? 'page' : undefined} aria-label={label}>
            {id === 'scan' ? (
              <span className="scan-dot"><Icon /></span>
            ) : (
              <Icon />
            )}
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
