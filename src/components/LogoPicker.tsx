import { useRef } from 'react';
import { useStore } from '../lib/store';
import { BrandLogo, fileToLogo, hasBuiltInLogo, logoKey } from '../lib/logos';
import { toast } from './ui';

/** Lets the user attach their own logo image to a bank / brand name (applies to every card of that name). */
export function LogoPicker({ name, label }: { name: string; label: string }) {
  const { data, setLogo } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const key = logoKey(name);
  const custom = !!data.logos?.[key];
  if (!name.trim()) return null;
  return (
    <div className="row" style={{ gap: 12 }}>
      <span style={{ width: 52, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: '#1d2233', padding: 6, flex: 'none' }}>
        <BrandLogo name={name} height={24} />
      </span>
      <div className="grow">
        <div className="small" style={{ fontWeight: 620 }}>{label}</div>
        <div className="tiny muted">{custom ? 'Your uploaded logo' : hasBuiltInLogo(name) ? 'Built-in logo' : 'No logo found — showing the name'}</div>
      </div>
      <button type="button" className="btn glassy sm" onClick={() => ref.current?.click()}>{custom ? 'Change' : 'Upload'}</button>
      {custom && <button type="button" className="btn sm" style={{ color: 'var(--bad)', padding: '0 8px' }} onClick={() => setLogo(key, null)}>Remove</button>}
      <input
        ref={ref}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        className="hidden-input"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            await setLogo(key, await fileToLogo(f));
            toast('Logo saved for ' + name);
          } catch {
            toast('Could not read that image');
          }
        }}
      />
    </div>
  );
}
