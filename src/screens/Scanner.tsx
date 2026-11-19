import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { parseUpi, type UpiPayload } from '../lib/upi';
import { categoryForMcc, isOftenExcluded, lookupMcc } from '../lib/mcc';
import type { Merchant } from '../lib/types';
import { DeleteRow, Empty, FieldRow, Group, NavRow, Sheet, copyText, toast } from '../components/ui';
import { IAlert, IFlash, IImage, IScan, ISearch } from '../components/Icons';

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

// jsQR is only needed when the native BarcodeDetector is missing — load it on demand.
let jsqrMod: Promise<typeof import('jsqr')> | null = null;
const loadJsQR = () => (jsqrMod ??= import('jsqr'));

async function decodeImageData(img: ImageData) {
  const { default: jsQR } = await loadJsQR();
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

async function decodeFile(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return decodeImageData(ctx.getImageData(0, 0, c.width, c.height));
}

function MccBlock({ mcc }: { mcc: string }) {
  const info = mcc ? lookupMcc(mcc) : null;
  const p2p = !mcc || mcc === '0000';
  return (
    <div className="cell" style={{ alignItems: 'flex-start', gap: 14, padding: '14px 16px' }}>
      <div className="mcc-code num">{p2p ? '—' : mcc}</div>
      <div className="grow">
        <div className="foot muted" style={{ fontWeight: 600 }}>MERCHANT CATEGORY</div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{p2p ? 'Personal UPI ID (no MCC)' : info?.desc ?? 'Uncommon code'}</div>
        <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
          {info && <span className="pill gray">{info.group}</span>}
          {p2p && <span className="pill warn">Person-to-person</span>}
          {!p2p && isOftenExcluded(mcc) && <span className="pill warn"><IAlert width={12} height={12} /> Often excluded from rewards</span>}
        </div>
      </div>
    </div>
  );
}

export function Scanner() {
  const { data, saveMerchant, deleteMerchant } = useStore();
  const nav = useNav();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState('');
  const [torch, setTorch] = useState<boolean | null>(null);
  const [result, setResult] = useState<UpiPayload | null>(null);
  const [nonUpi, setNonUpi] = useState('');
  const [paste, setPaste] = useState('');
  const [lookup, setLookup] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Merchant | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    setTorch(null);
  }, []);

  useEffect(() => stop, [stop]);

  const handleText = useCallback((text: string) => {
    const p = parseUpi(text);
    if (p) {
      setResult(p);
      setNonUpi('');
      navigator.vibrate?.(30);
    } else {
      setResult(null);
      setNonUpi(text);
    }
  }, []);

  const start = async () => {
    setCamError('');
    setResult(null);
    setNonUpi('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Camera access needs HTTPS and a supported browser. You can upload a QR image instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setScanning(true);
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
      if (caps.torch) setTorch(false);

      const BD = (window as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
      let detector: Detector | null = null;
      try {
        detector = BD ? new BD({ formats: ['qr_code'] }) : null;
      } catch {
        detector = null;
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      let busy = false;
      let lastTick = 0;
      const tick = async (ts: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (busy || ts - lastTick < 120 || v.readyState < 2) return;
        lastTick = ts;
        busy = true;
        try {
          let text: string | null = null;
          if (detector) {
            const codes = await detector.detect(v);
            text = codes[0]?.rawValue ?? null;
          } else {
            const size = Math.min(v.videoWidth, v.videoHeight);
            const target = Math.min(720, size);
            canvas.width = canvas.height = target;
            ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, target, target);
            text = await decodeImageData(ctx.getImageData(0, 0, target, target));
          }
          if (text) {
            stop();
            handleText(text);
          }
        } catch {
          /* keep scanning */
        } finally {
          busy = false;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      setCamError(name === 'NotAllowedError' ? 'Camera permission was denied. Allow it in browser settings, or upload a QR image.' : 'Could not start the camera. Try uploading a QR image.');
      stop();
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      toast('Torch not available');
    }
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    stop();
    try {
      const text = await decodeFile(f);
      if (text) handleText(text);
      else toast('No QR code found in that image');
    } catch {
      toast('Could not read that image');
    }
  };

  const existing = result ? data.merchants.find((m) => m.vpa.toLowerCase() === result.vpa.toLowerCase()) : undefined;

  const save = async (andSpend = false) => {
    if (!result) return;
    const id = await saveMerchant({
      id: existing?.id,
      name: existing?.name || result.name || result.vpa,
      vpa: result.vpa,
      mcc: result.mcc,
      notes: existing?.notes ?? '',
      raw: result.raw,
      scannedAt: Date.now(),
    });
    toast(existing ? 'Merchant updated' : 'Merchant saved');
    if (andSpend) {
      nav.newSpend({
        merchantId: id,
        merchantName: existing?.name || result.name || result.vpa,
        amount: result.amount ? Number(result.amount) : undefined,
        category: result.mcc ? categoryForMcc(result.mcc) : undefined,
        payment: { type: 'upi' },
      });
    }
  };

  const merchants = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.merchants.filter((m) => !s || [m.name, m.vpa, m.mcc, lookupMcc(m.mcc)?.desc ?? ''].some((x) => x.toLowerCase().includes(s)));
  }, [data.merchants, q]);

  const lookupInfo = lookup.length >= 3 ? lookupMcc(lookup) : null;

  return (
    <div className="screen">
      <header className="topbar"><h1>Scan</h1></header>

      <div className="stack-lg">
        <div className="scanner">
          <video ref={videoRef} playsInline muted style={{ opacity: scanning ? 1 : 0 }} />
          {scanning ? (
            <>
              <div className="reticle" />
              <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn sm liquid" style={{ color: 'var(--label)' }} onClick={stop}>Cancel</button>
                {torch !== null && <button className="glass-btn liquid" style={{ color: torch ? 'var(--yellow)' : 'var(--label)' }} onClick={toggleTorch} aria-label="Toggle torch"><IFlash /></button>}
              </div>
            </>
          ) : (
            <div className="placeholder">
              <div>
                <IScan width={48} height={48} style={{ opacity: 0.9 }} />
                <div style={{ fontWeight: 600, fontSize: 20, marginTop: 12 }}>Scan a UPI QR code</div>
                <p className="foot" style={{ opacity: 0.7, margin: '6px 0 18px' }}>See the shop's merchant category code. Decoded on this device.</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn primary" onClick={start}>Open Camera</button>
                  <button className="btn" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }} onClick={() => fileRef.current?.click()}><IImage width={18} /> Photo</button>
                </div>
                {camError && <p className="foot" style={{ color: '#ff9b94', marginTop: 14 }}>{camError}</p>}
              </div>
            </div>
          )}
        </div>
        <input ref={fileRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

        {result && (
          <Group header="Result" footer={existing ? 'Already in your merchants — saving updates it.' : undefined}>
            <NavRow title={<b>{result.name || 'Unnamed payee'}</b>} subtitle={result.vpa} right={<button className="textbtn" onClick={() => copyText(result.vpa, 'UPI ID copied')}>Copy</button>} />
            <MccBlock mcc={result.mcc} />
            {result.amount && <NavRow title="Amount" value={`${result.currency ?? ''} ${result.amount}`} />}
            {result.note && <NavRow title="Note" value={result.note} />}
            <button className="cell tint" onClick={() => save(true)} style={{ fontWeight: 600 }}>Save & add spend</button>
            <button className="cell tint" onClick={() => save(false)}>{existing ? 'Update merchant' : 'Save merchant only'}</button>
            <button className="cell tint" onClick={start}>Scan another</button>
          </Group>
        )}

        {nonUpi && (
          <Group header="Not a UPI code"><div className="cell foot" style={{ wordBreak: 'break-all' }}>{nonUpi.slice(0, 300)}</div></Group>
        )}

        <Group header="Tools">
          <FieldRow label="Look up MCC"><input className="mono" inputMode="numeric" maxLength={4} placeholder="e.g. 5411" value={lookup} onChange={(e) => setLookup(e.target.value.replace(/\D/g, ''))} /></FieldRow>
          {lookup.length >= 3 && (lookupInfo ? <MccBlock mcc={lookup.padStart(4, '0')} /> : <div className="cell st">Not in the built-in table.</div>)}
          <div className="cell">
            <input style={{ textAlign: 'left' }} placeholder="Paste a upi:// link" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="UPI link" />
            <button className="textbtn" disabled={!paste.trim()} onClick={() => { handleText(paste); setPaste(''); }}>Decode</button>
          </div>
        </Group>

        <section>
          <div className="section-h"><h2>Merchants</h2><span className="muted foot">{data.merchants.length} saved</span></div>
          {data.merchants.length > 4 && (
            <div className="search" style={{ marginBottom: 10 }}><ISearch /><input className="input" placeholder="Search name, UPI ID or MCC" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search merchants" /></div>
          )}
          {data.merchants.length === 0 ? (
            <Empty icon="🏪" title="No merchants yet" text="Scan a shop's QR and save it to build your own MCC record." />
          ) : (
            <div className="group">
              {merchants.map((m) => (
                <button key={m.id} className="cell" style={{ ['--inset' as string]: '72px' }} onClick={() => setSelected(m)}>
                  <span className="tx-ic mono" style={{ width: 44, fontSize: 13, fontWeight: 700, color: 'var(--tint)' }}>{m.mcc || '—'}</span>
                  <span className="grow">
                    <div className="t ellipsis">{m.name || m.vpa}</div>
                    <div className="st ellipsis">{lookupMcc(m.mcc)?.desc ?? (m.mcc ? 'Unknown code' : 'No MCC')}</div>
                  </span>
                  {m.mcc && isOftenExcluded(m.mcc) && <IAlert width={16} style={{ color: 'var(--orange)', flex: 'none' }} />}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <MerchantSheet
          m={selected}
          onClose={() => setSelected(null)}
          onSave={async (patch) => { await saveMerchant({ ...selected, ...patch }); toast('Merchant updated'); setSelected(null); }}
          onDelete={async () => { await deleteMerchant(selected.id); toast('Merchant removed'); setSelected(null); }}
          onSpend={() => { const m = selected; setSelected(null); nav.newSpend({ merchantId: m.id, merchantName: m.name, category: m.mcc ? categoryForMcc(m.mcc) : undefined, payment: { type: 'upi' } }); }}
        />
      )}
    </div>
  );
}

function MerchantSheet({ m, onClose, onSave, onDelete, onSpend }: { m: Merchant; onClose: () => void; onSave: (p: Partial<Merchant>) => void; onDelete: () => void; onSpend: () => void }) {
  const [name, setName] = useState(m.name);
  const [mcc, setMcc] = useState(m.mcc);
  const [notes, setNotes] = useState(m.notes);
  return (
    <Sheet open onClose={onClose} title="Merchant" actions={<button className="textbtn bold" onClick={() => onSave({ name: name.trim(), mcc: mcc.trim(), notes })}>Save</button>}>
      <div className="stack-lg">
        <Group><MccBlock mcc={mcc} /></Group>
        <Group footer={`Saved ${new Date(m.scannedAt).toLocaleDateString()}. Correct the MCC if your card statement shows a different one.`}>
          <FieldRow label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></FieldRow>
          <NavRow title="UPI ID" value={m.vpa} onClick={() => copyText(m.vpa, 'UPI ID copied')} chevron={false} />
          <FieldRow label="MCC"><input className="mono" inputMode="numeric" maxLength={4} value={mcc} onChange={(e) => setMcc(e.target.value.replace(/\D/g, ''))} /></FieldRow>
        </Group>
        <Group header="Notes"><div className="cell"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 5% back on HDFC Millennia" /></div></Group>
        <div className="group"><button className="cell tint" onClick={onSpend}>Add spend here</button></div>
        <DeleteRow label="Delete merchant" onConfirm={onDelete} />
      </div>
    </Sheet>
  );
}
