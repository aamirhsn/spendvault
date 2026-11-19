import type { Tab } from '../lib/nav';
import { ICard, IGift, IHome, IReceipt, IScan } from './Icons';

const TABS: { id: Tab; label: string; Icon: typeof IHome }[] = [
  { id: 'home', label: 'Home', Icon: IHome },
  { id: 'spends', label: 'Spends', Icon: IReceipt },
  { id: 'gifts', label: 'Gift Cards', Icon: IGift },
  { id: 'cards', label: 'Cards', Icon: ICard },
];

/** Round QR-scanner button on the left, then the glass tab bar. */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const idx = TABS.findIndex((t) => t.id === tab);
  return (
    <div className="tabbar-wrap">
      <button className={`fab liquid ${tab === 'scan' ? 'on' : ''}`} onClick={() => onChange('scan')} aria-label="Scan QR" aria-current={tab === 'scan' ? 'page' : undefined}>
        <IScan strokeWidth={2.2} />
      </button>
      <nav className="tabbar liquid" aria-label="Main" style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
        {idx >= 0 && <span className="tab-lens" style={{ width: `calc((100% - 8px) / ${TABS.length})`, transform: `translateX(${idx * 100}%)` }} />}
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => onChange(id)} aria-current={tab === id ? 'page' : undefined}>
            <Icon className="tab-ic" strokeWidth={tab === id ? 2.3 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
