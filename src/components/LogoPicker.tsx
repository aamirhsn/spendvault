import { useRef } from 'react';
import { useStore } from '../lib/store';
import { Logo, LOGO_FILES, fileToDataUrl, hasLogo, logoKey } from '../lib/logos';
import { toast } from './ui';

/** A list cell to attach your own logo image to a bank / brand name (applies to every card with that name). */
export function LogoPicker({ name, label }: { name: string; label: string }) {
  const { data, setLogo } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const key = logoKey(name);
  const custom = !!data.logos?.[key];
  if (!name.trim()) return null;
  const known = hasLogo(name, data.logos);
  return (
    <div className="cell">
      <span className="logo-tile" style={{ width: 40, height: 40, borderRadius: 10, padding: 5, boxShadow: 'inset 0 0 0 .5px var(--sep)' }}>
        {known ? <Logo name={name} /> : <span className="mono-l" style={{ fontSize: 16 }}>{name.slice(0, 1).toUpperCase()}</span>}
      </span>
      <span className="grow">
        <div className="t">{label}</div>
        <div className="st">{custom ? 'Your upload' : known ? (LOGO_FILES[key] ? 'Official logo' : 'Built-in mark') : 'Not found — upload one'}</div>
      </span>
      <button type="button" className="textbtn" onClick={() => ref.current?.click()}>{custom ? 'Change' : 'Upload'}</button>
      {custom && <button type="button" className="textbtn" style={{ color: 'var(--red)' }} onClick={() => setLogo(key, null)}>Reset</button>}
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
            await setLogo(key, await fileToDataUrl(f));
            toast('Logo updated', { detail: `Used for every ${name} card.` });
          } catch {
            toast('Couldn’t use that image', { kind: 'error', detail: 'Try a PNG or JPG file.' });
          }
        }}
      />
    </div>
  );
}
