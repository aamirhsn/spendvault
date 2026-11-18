import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../lib/nav';
import { parseUpi, type UpiPayload } from '../lib/upi';
import { categoryForMcc, isOftenExcluded, lookupMcc } from '../lib/mcc';
import type { Merchant } from '../lib/types';
import { Empty, Field, Sheet, copyText, toast } from '../components/ui';
import { IAlert, ICopy, IFlash, IImage, IPlus, IScan, ISearch, IStore, ITrash } from '../components/Icons';

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
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
        <div className="mcc-badge">{p2p ? '—' : mcc}</div>
        <div className="grow" style={{ paddingBottom: 2 }}>
          <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 650 }}>Merchant category code</div>
          <div style={{ fontWeight: 650 }}>{p2p ? 'Personal VPA (no MCC)' : info?.desc ?? 'Unknown / uncommon code'}</div>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {info && <span className="chip accent">{info.group}</span>}
        {p2p && <span className="chip warn">P2P transfer — usually not a card/merchant spend</span>}
        {!p2p && isOftenExcluded(mcc) && <span className="chip warn"><IAlert width={12} height={12} /> Often excluded from card rewards</span>}
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
      <header className="topbar">
        <div>
          <h1>MCC Scanner</h1>
          <div className="sub">Scan any UPI QR to reveal its merchant category</div>
        </div>
      </header>

      <div className="stack-lg">
        <div className="glass" style={{ padding: 8, borderRadius: 34 }}>
          <div className="scanner">
            <video ref={videoRef} playsInline muted style={{ opacity: scanning ? 1 : 0 }} />
            {scanning ? (
              <>
                <div className="reticle" />
                <div className="laser" />
                {torch !== null && (
                  <button className="icon-btn" style={{ position: 'absolute', right: 14, bottom: 14, color: torch ? '#ffd23f' : '#fff' }} onClick={toggleTorch} aria-label="Toggle torch"><IFlash /></button>
                )}
                <button className="btn glassy sm" style={{ position: 'absolute', left: 14, bottom: 14, color: '#fff' }} onClick={stop}>Stop</button>
              </>
            ) : (
              <div className="placeholder">
                <div>
                  <div style={{ width: 74, height: 74, borderRadius: 24, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)' }}>
                    <IScan width={36} height={36} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>Point at a UPI QR code</div>
                  <p className="small" style={{ opacity: 0.75, margin: '6px 0 18px' }}>Decoded entirely on your device.</p>
                  <div className="row" style={{ justifyContent: 'center' }}>
                    <button className="btn primary" onClick={start}><IScan width={18} /> Start camera</button>
                    <button className="btn glassy" style={{ color: '#fff' }} onClick={() => fileRef.current?.click()}><IImage width={18} /> Image</button>
                  </div>
                  {camError && <p className="small" style={{ color: '#ffb4b4', marginTop: 14 }}>{camError}</p>}
                </div>
              </div>
            )}
          </div>
          <input ref={fileRef} className="hidden-input" type="file" accept="image/*" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>

        {result && (
          <section className="glass pad stack" style={{ animation: 'screenIn .4s var(--ease)' }}>
            <div className="row between">
              <div className="grow">
                <div style={{ fontWeight: 720, fontSize: 19 }} className="ellipsis">{result.name || 'Unnamed payee'}</div>
                <button className="small muted row" style={{ gap: 6 }} onClick={() => copyText(result.vpa, 'UPI ID copied')}>{result.vpa} <ICopy width={14} /></button>
              </div>
              {existing && <span className="chip good">Saved</span>}
            </div>
            <MccBlock mcc={result.mcc} />
            {(result.amount || result.note || result.txnRef || result.mode) && (
              <div className="kv">
                {result.amount && <div><div className="k">Amount</div><div className="v">{result.currency ?? ''} {result.amount}</div></div>}
                {result.mode && <div><div className="k">Mode</div><div className="v">{result.mode}</div></div>}
                {result.note && <div><div className="k">Note</div><div className="v">{result.note}</div></div>}
                {result.txnRef && <div><div className="k">Txn ref</div><div className="v small">{result.txnRef}</div></div>}
              </div>
            )}
            <div className="row">
              <button className="btn glassy grow" onClick={() => save(false)}><IStore width={18} /> {existing ? 'Update' : 'Save merchant'}</button>
              <button className="btn primary grow" onClick={() => save(true)}><IPlus width={18} /> Add spend</button>
            </div>
            <button className="btn sm" style={{ color: 'var(--text-2)' }} onClick={start}>Scan another</button>
          </section>
        )}

        {nonUpi && (
          <section className="glass pad">
            <div style={{ fontWeight: 700 }}>Not a UPI QR</div>
            <p className="small muted" style={{ wordBreak: 'break-all' }}>{nonUpi.slice(0, 300)}</p>
          </section>
        )}

        <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <section className="glass pad stack">
            <div style={{ fontWeight: 700 }}>Look up an MCC</div>
            <input className="input mono" inputMode="numeric" maxLength={4} placeholder="e.g. 5411" value={lookup} onChange={(e) => setLookup(e.target.value.replace(/\D/g, ''))} aria-label="MCC code" />
            {lookup.length >= 3 && (lookupInfo ? <MccBlock mcc={lookup.padStart(4, '0')} /> : <div className="small muted">Code not in the built-in table.</div>)}
          </section>
          <section className="glass pad stack">
            <div style={{ fontWeight: 700 }}>Paste a UPI link</div>
            <input className="input" placeholder="upi://pay?pa=…&mc=…" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="UPI link" />
            <button className="btn glassy" disabled={!paste.trim()} onClick={() => { handleText(paste); setPaste(''); }}>Decode</button>
          </section>
        </div>

        <section>
          <div className="section-title"><h2>Saved merchants</h2><span className="small muted">{data.merchants.length}</span></div>
          {data.merchants.length > 3 && (
            <div className="input-wrap" style={{ margin: '10px 0' }}>
              <input className="input" style={{ paddingLeft: 42, borderRadius: 999 }} placeholder="Search name, UPI ID or MCC" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search merchants" />
              <ISearch style={{ position: 'absolute', left: 14, top: 13, color: 'var(--text-3)' }} width={20} />
            </div>
          )}
          {data.merchants.length === 0 ? (
            <div style={{ marginTop: 8 }}><Empty icon="🏪" title="No merchants yet" text="Scan a shop's UPI QR and save it to build your own MCC record." /></div>
          ) : (
            <div className="glass list" style={{ marginTop: 8 }}>
              {merchants.map((m) => {
                const info = lookupMcc(m.mcc);
                return (
                  <button key={m.id} className="list-item" onClick={() => setSelected(m)}>
                    <span className="emoji mono" style={{ fontSize: 12.5, fontWeight: 800 }}>{m.mcc || '—'}</span>
                    <span className="grow">
                      <div className="t ellipsis">{m.name || m.vpa}</div>
                      <div className="d ellipsis">{info?.desc ?? (m.mcc ? 'Unknown code' : 'No MCC')} · {m.vpa}</div>
                    </span>
                    {m.mcc && isOftenExcluded(m.mcc) && <IAlert width={16} style={{ color: 'var(--warn)', flex: 'none' }} />}
                  </button>
                );
              })}
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
  const [del, setDel] = useState(false);
  return (
    <Sheet open onClose={onClose} title={m.name || m.vpa} actions={<button className="btn primary sm" onClick={() => onSave({ name: name.trim(), mcc: mcc.trim(), notes })}>Save</button>}>
      <div className="stack-lg">
        <MccBlock mcc={mcc} />
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="UPI ID"><div className="secret-row"><span className="v" style={{ fontFamily: 'var(--font)', letterSpacing: 0 }}>{m.vpa}</span><button className="icon-btn sm" onClick={() => copyText(m.vpa, 'UPI ID copied')} aria-label="Copy"><ICopy width={16} /></button></div></Field>
        <Field label="MCC" hint="Correct it if your card statement shows a different code."><input className="input mono" inputMode="numeric" maxLength={4} value={mcc} onChange={(e) => setMcc(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="Notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Gives 5% on HDFC Millennia" /></Field>
        <div className="tiny faint">First saved {new Date(m.scannedAt).toLocaleString()}</div>
        <button className="btn primary block" onClick={onSpend}><IPlus width={18} /> Add spend here</button>
        {del ? (
          <div className="row"><button className="btn glassy grow" onClick={() => setDel(false)}>Cancel</button><button className="btn danger grow" onClick={onDelete}>Delete</button></div>
        ) : (
          <button className="btn ghost-danger block" onClick={() => setDel(true)}><ITrash width={18} /> Delete merchant</button>
        )}
      </div>
    </Sheet>
  );
}
