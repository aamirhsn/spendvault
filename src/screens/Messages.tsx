import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { PaymentType, SmsRule } from '../lib/types';
import { CATEGORIES } from '../lib/categories';
import { money, prettyDate, uid } from '../lib/format';
import { parseSms, seedRules, splitMessages, toDraft, type Draft } from '../lib/sms';
import { CatIcon } from '../components/CatIcon';
import { CBtn, DeleteRow, FieldRow, Group, NavRow, SaveBtn, Sheet, Toggle, copyText, toast } from '../components/ui';
import { IClipboard, IPlus, IRule, IWand } from '../components/Icons';
import { PAYMENT_LABELS, paymentLabel } from '../components/TxnRow';

/** Import spends from pasted bank SMS (or one handed over by an iOS Shortcut). */
export function MessagesSheet({ initialText, onClose }: { initialText?: string; onClose: () => void }) {
  const { data, saveTransactions, saveRules, updateSettings } = useStore();
  const [text, setText] = useState(initialText ?? '');
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [cats, setCats] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<null | 'rules' | 'auto'>(null);
  const fmt = (n: number) => money(n, data.settings.currency);

  // Give new users a useful starting set of rules (editable).
  useEffect(() => {
    if (!data.settings.rulesSeeded && (data.rules ?? []).length === 0) {
      saveRules(seedRules());
      updateSettings({ rulesSeeded: true });
    }
  }, [data.settings.rulesSeeded, data.rules, saveRules, updateSettings]);

  const drafts = useMemo<Draft[]>(() => {
    const seen = new Set(data.smsSeen ?? []);
    return splitMessages(text)
      .map(parseSms)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ ...toDraft(p, data.rules ?? [], data.cards), _dupe: seen.has(p.hash) }));
  }, [text, data.rules, data.cards, data.smsSeen]);
  const unparsed = text.trim() && drafts.length === 0;

  const isOn = (d: Draft) => off[d._hash] === undefined ? d._parsed.kind === 'debit' && !d._ignored && !d._dupe : !off[d._hash];
  const chosen = drafts.filter(isOn);

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) return toast('Clipboard is empty');
      setText((cur) => (cur.trim() ? `${cur.trim()}\n\n${t.trim()}` : t.trim()));
    } catch {
      toast('Allow paste, or long-press the box and choose Paste');
    }
  };

  const add = async () => {
    const items = chosen.map(({ _hash, _parsed, _ignored, _dupe, ...t }) => ({ ...t, category: cats[_hash] ?? t.category }));
    await saveTransactions(items, chosen.map((d) => d._hash));
    toast(`${items.length} spend${items.length === 1 ? '' : 's'} added`);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="From Messages" actions={<SaveBtn label={`Add ${chosen.length}`} onClick={() => chosen.length && add()} />}>
      <div className="stack-lg">
        <Group footer="Paste one or more bank / UPI / card alerts. Nothing leaves your device.">
          <div className="cell" style={{ alignItems: 'flex-start' }}>
            <textarea style={{ minHeight: 84 }} placeholder="e.g. Rs.250 debited from A/c XX1234 to VPA swiggy@icici…" value={text} onChange={(e) => { setText(e.target.value); setOff({}); }} aria-label="Bank messages" />
          </div>
          <button className="cell tint" onClick={paste}><IClipboard width={18} /> Paste from clipboard</button>
        </Group>

        {unparsed && <div className="group-f bad" style={{ marginTop: -12 }}>Couldn’t find a transaction amount in that text.</div>}

        {drafts.length > 0 && (
          <Group header={`Found ${drafts.length} · ${chosen.length} selected`}>
            {drafts.map((d) => {
              const on = isOn(d);
              const cat = cats[d._hash] ?? d.category;
              const note = d._parsed.kind === 'credit' ? 'Money received — not a spend' : d._dupe ? 'Already imported' : d._ignored ? 'Ignored by a rule' : null;
              return (
                <div key={d._hash} className="cell" style={{ ['--inset' as string]: '68px', opacity: on ? 1 : 0.55 }}>
                  <CatIcon name={cat} size={40} round />
                  <span className="grow">
                    <div className="t ellipsis" style={{ fontWeight: 500 }}>{d.description}</div>
                    <div className="st ellipsis">{prettyDate(d.date)} · {paymentLabel({ ...d, id: '', createdAt: 0, updatedAt: 0 }, data.cards)}</div>
                    {note ? <div className="tiny warn" style={{ marginTop: 2 }}>{note}</div> : (
                      <select value={cat} onChange={(e) => setCats((c) => ({ ...c, [d._hash]: e.target.value }))} style={{ textAlign: 'left', textAlignLast: 'left', color: 'var(--tint)', fontSize: 13, padding: 0, background: 'none', marginTop: 2, flex: 'none', display: 'block' }} aria-label="Category">
                        {CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}
                      </select>
                    )}
                  </span>
                  <span className="amt-col"><div className={`a ${d._parsed.kind === 'debit' ? 'neg' : 'pos'}`}>{d._parsed.kind === 'debit' ? '−' : '+'}{fmt(d.amount)}</div></span>
                  <Toggle on={on} onChange={(v) => setOff((o) => ({ ...o, [d._hash]: !v }))} label="Include" />
                </div>
              );
            })}
          </Group>
        )}

        {chosen.length > 0 && <button className="btn primary block" onClick={add}>Add {chosen.length} spend{chosen.length === 1 ? '' : 's'}</button>}

        <Group>
          <NavRow icon={<IRule />} iconBg="var(--indigo)" title="Rules" subtitle={`${(data.rules ?? []).length} rules · name, category & card`} onClick={() => setPanel('rules')} />
          <NavRow icon={<IWand />} iconBg="var(--orange)" title="Automate with Shortcuts" subtitle="Capture bank SMS as they arrive" onClick={() => setPanel('auto')} />
        </Group>
      </div>
      {panel === 'rules' && <RulesSheet onClose={() => setPanel(null)} />}
      {panel === 'auto' && <AutomationGuide onClose={() => setPanel(null)} />}
    </Sheet>
  );
}

export function RulesSheet({ onClose }: { onClose: () => void }) {
  const { data, saveRules } = useStore();
  const rules = data.rules ?? [];
  const [edit, setEdit] = useState<SmsRule | null>(null);
  return (
    <Sheet open onClose={onClose} title="Rules" actions={<CBtn icon={<IPlus />} label="Add rule" variant="tinted" onClick={() => setEdit({ id: uid(), match: '' })} />}>
      <div className="stack-lg">
        <Group footer="When a message contains the keyword, the spend gets that name, category and payment method. The first matching rule wins. Cards are matched automatically by their last 4 digits.">
          {rules.length === 0 && <div className="cell st">No rules yet.</div>}
          {rules.map((r) => (
            <button key={r.id} className="cell" style={{ ['--inset' as string]: '60px' }} onClick={() => setEdit(r)}>
              <CatIcon name={r.ignore ? 'Other' : r.category ?? 'Other'} size={32} />
              <span className="grow">
                <div className="t ellipsis">“{r.match}”</div>
                <div className="st ellipsis">{r.ignore ? 'Ignore these messages' : [r.name, r.category, r.paymentType && PAYMENT_LABELS[r.paymentType]].filter(Boolean).join(' · ') || 'No changes'}</div>
              </span>
            </button>
          ))}
        </Group>
      </div>
      {edit && (
        <RuleEditor
          rule={edit}
          onClose={() => setEdit(null)}
          onSave={async (r) => { await saveRules(rules.some((x) => x.id === r.id) ? rules.map((x) => (x.id === r.id ? r : x)) : [r, ...rules]); setEdit(null); }}
          onDelete={async () => { await saveRules(rules.filter((x) => x.id !== edit.id)); setEdit(null); }}
        />
      )}
    </Sheet>
  );
}

function RuleEditor({ rule, onClose, onSave, onDelete }: { rule: SmsRule; onClose: () => void; onSave: (r: SmsRule) => void; onDelete: () => void }) {
  const { data } = useStore();
  const [r, setR] = useState(rule);
  const set = (p: Partial<SmsRule>) => setR((x) => ({ ...x, ...p }));
  return (
    <Sheet open onClose={onClose} title="Rule" actions={<SaveBtn onClick={() => r.match.trim() ? onSave({ ...r, match: r.match.trim() }) : toast('Enter a keyword')} />}>
      <div className="stack-lg">
        <Group footer="Matches anywhere in the message, the merchant or the UPI ID. Not case-sensitive.">
          <FieldRow label="If message has"><input placeholder="e.g. swiggy" value={r.match} onChange={(e) => set({ match: e.target.value })} autoFocus={!rule.match} /></FieldRow>
        </Group>
        <Group>
          <div className="cell"><span className="grow">Ignore these messages</span><Toggle on={!!r.ignore} onChange={(v) => set({ ignore: v })} label="Ignore" /></div>
        </Group>
        {!r.ignore && (
          <Group header="Then set">
            <FieldRow label="Name"><input placeholder="Keep detected" value={r.name ?? ''} onChange={(e) => set({ name: e.target.value || undefined })} /></FieldRow>
            <FieldRow label="Category">
              <select value={r.category ?? ''} onChange={(e) => set({ category: e.target.value || undefined })}>
                <option value="">Keep detected</option>
                {CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Paid with">
              <select value={r.paymentType ?? ''} onChange={(e) => set({ paymentType: (e.target.value || undefined) as PaymentType | undefined, cardId: e.target.value === 'card' ? r.cardId : undefined })}>
                <option value="">Keep detected</option>
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </FieldRow>
            {r.paymentType === 'card' && (
              <FieldRow label="Card">
                <select value={r.cardId ?? ''} onChange={(e) => set({ cardId: e.target.value || undefined })}>
                  <option value="">Match by last 4</option>
                  {data.cards.map((c) => <option key={c.id} value={c.id}>{c.name || c.bank} ••{c.last4}</option>)}
                </select>
              </FieldRow>
            )}
          </Group>
        )}
        <DeleteRow label="Delete rule" onConfirm={onDelete} />
      </div>
    </Sheet>
  );
}

function AutomationGuide({ onClose }: { onClose: () => void }) {
  const url = `${location.origin}${location.pathname}#sms=`;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const [mode, setMode] = useState<'app' | 'safari'>(standalone ? 'app' : 'safari');
  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <div className="cell" style={{ alignItems: 'flex-start' }}>
      <span className="cbtn tinted" style={{ width: 28, height: 28, fontSize: 14, fontWeight: 700 }}>{n}</span>
      <span className="grow small" style={{ lineHeight: 1.45 }}>{children}</span>
    </div>
  );
  return (
    <Sheet open onClose={onClose} title="Automate">
      <div className="stack-lg">
        <div className="group-f" style={{ margin: '0 4px', fontSize: 15, color: 'var(--label)' }}>
          iPhone automations can’t be shared, so you set this up once in the <b>Shortcuts</b> app. It runs entirely on your phone.
        </div>
        <div className="seg full" role="tablist">
          <button className={mode === 'app' ? 'on' : ''} onClick={() => setMode('app')}>Home Screen app</button>
          <button className={mode === 'safari' ? 'on' : ''} onClick={() => setMode('safari')}>Safari</button>
        </div>
        {mode === 'app' ? (
          <Group header="1 · Make the shortcut" footer="The Home Screen app keeps its own data, so the shortcut hands over the SMS via the clipboard (cleared after 10 minutes).">
            <Step n={1}>Shortcuts → <b>+</b> → name it <b>Copy SMS for SpendVault</b>.</Step>
            <Step n={2}>Add <b>Copy to Clipboard</b> with <b>Shortcut Input</b>. Tap ▸ → <b>Local Only</b> on, <b>Expire</b> in 10 minutes.</Step>
            <Step n={3}>Add <b>Show Notification</b>: “Bank SMS copied — open SpendVault and tap 💬”.</Step>
          </Group>
        ) : (
          <Group header="1 · Make the shortcut" footer="The message goes after # in the link, which browsers never send to a server.">
            <Step n={1}>Shortcuts → <b>+</b> → name it <b>Log to SpendVault</b>.</Step>
            <Step n={2}>Add <b>URL Encode</b> with <b>Shortcut Input</b>.</Step>
            <Step n={3}>Add <b>Open URLs</b>: paste the link below, then insert <b>URL Encoded Text</b> after it.</Step>
            <div className="cell mono" style={{ fontSize: 13, wordBreak: 'break-all' }}>{url}</div>
            <button className="cell tint" onClick={() => copyText(url, 'Link copied')}>Copy link</button>
          </Group>
        )}
        <Group header="2 · Make the automation" footer="SpendVault always asks before saving. Your SMS Rules fill in names, categories and cards.">
          <Step n={1}>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Message</b>.</Step>
          <Step n={2}><b>Message Contains</b>: <b>debited</b> → <b>Run Immediately</b>.</Step>
          <Step n={3}>Add <b>Run Shortcut</b> → pick your shortcut → set its input to <b>Shortcut Input</b>.</Step>
          <Step n={4}>Repeat for <b>spent</b> (and <b>sent Rs</b> if your bank uses it).</Step>
        </Group>
        <div className="group-f center">Have a Mac? Ready-made shortcut files are in the project’s <b>docs/shortcuts</b> folder.</div>
      </div>
    </Sheet>
  );
}
