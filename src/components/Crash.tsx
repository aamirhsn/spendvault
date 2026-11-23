import { Component, type ReactNode } from 'react';

/** Last-resort screen: if anything throws while rendering, show what happened instead of a blank page.
 *  Your data is untouched — it lives encrypted in IndexedDB, which this never clears. */
export class CrashGuard extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  reload = async () => {
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = (await caches?.keys?.()) ?? [];
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch { /* ignore */ }
    location.reload();
  };
  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeContent: 'center', padding: 24, textAlign: 'center', gap: 12, fontFamily: '-apple-system, system-ui, sans-serif' }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ margin: 0 }}>Fiscus hit a problem</h2>
        <p style={{ margin: 0, color: '#6c6c70' }}>Your data is safe. Tap Reload to try again. If it keeps happening, send a screenshot of this screen.</p>
        <code style={{ fontSize: 12, color: '#c9003c', background: 'rgba(255,59,48,.08)', padding: 10, borderRadius: 10, textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {String(err.message || err)}
          {'\n'}
          {(err.stack || '').split('\n').slice(0, 4).join('\n')}
        </code>
        <button onClick={this.reload} style={{ margin: '8px auto 0', padding: '12px 28px', borderRadius: 99, border: 0, background: '#10a36b', color: '#fff', fontSize: 17, fontWeight: 600 }}>Reload</button>
      </div>
    );
  }
}
